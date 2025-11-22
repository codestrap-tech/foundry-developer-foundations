import { createClient } from '@osdk/client';
import type { User } from '@osdk/foundry.admin';
import { Users } from '@osdk/foundry.admin';
import { createConfidentialOauthClient } from '@osdk/oauth';
import type {
  FoundryClient,
  Token,
} from '@codestrap/developer-foundations-types';
import { getRequestContext } from '@codestrap/developer-foundations-utils/src/lib/asyncLocalStorage';

// this is a utility method to manage usage of the Foundry Client and ensure we only get a singleton
// files in the palantir services package can't use the container to get the foundry client, nor should they really
// They are in the same package
let client: FoundryClient | undefined = undefined;

export function getFoundryClient(): FoundryClient {
  if (!client) {
    client = createFoundryClient();
  }

  return client;
}

function createFoundryClient(): FoundryClient {
  if (!process.env['OSDK_CLIENT_ID'] || !process.env['OSDK_CLIENT_SECRET']) {
    throw new Error(
      'missing required env vars: OSDK_CLIENT_ID, OSDK_CLIENT_SECRET',
    );
  }

  // setup the OSDK
  const clientId: string = process.env['OSDK_CLIENT_ID']!;
  const url: string = process.env['FOUNDRY_STACK_URL']!;
  const ontologyRid: string = process.env['ONTOLOGY_RID']!;
  const clientSecret: string = process.env['OSDK_CLIENT_SECRET']!;
  const scopes: string[] = [
    'api:use-ontologies-read',
    'api:use-ontologies-write',
    'api:use-admin-read',
    'api:use-connectivity-read',
    'api:use-connectivity-execute',
    'api:use-orchestration-read',
    'api:use-mediasets-read',
    'api:use-mediasets-write',
  ];

  const auth = createConfidentialOauthClient(
    clientId,
    clientSecret,
    url,
    scopes,
  );

  const client = createClient(url, ontologyRid, auth);

  const getUser = async () => {
    const context = getRequestContext();
    // check if a request has supplied a userId that this request should be grounded on
    if (context?.user?.id) {
      const user: User = await Users.get(client, context.user.id);
      return user;
    }

    const user: User = await Users.getCurrent(client);

    return user;
  };

  let token: Token | undefined;
  let tokenExpire: Date | undefined;
  let pendingRequest: Promise<Token> | undefined;

  auth.addEventListener('signIn', (evt) => {
    token = evt.detail; // Token
    tokenExpire = new Date(token.expires_at);
  });

  auth.addEventListener('signOut', (evt) => {
    token = undefined;
    tokenExpire = undefined;
  });

  const getToken = async function () {
    if (token && tokenExpire) {
      // add 60 seconds to account for processing time
      const skew = tokenExpire.getTime() + 60000;

      if (skew > new Date().getTime()) {
        return token.access_token;
      }
    }
    // avoid duplicate signin requests
    if (!pendingRequest) {
      pendingRequest = auth.signIn();
    }

    try {
      token = await pendingRequest;

      return token.access_token;
    } catch (e) {
      console.log(e);

      throw e;
    } finally {
      pendingRequest = undefined;
    }
  };

  return { auth, ontologyRid, url, client, getUser, getToken };
}
