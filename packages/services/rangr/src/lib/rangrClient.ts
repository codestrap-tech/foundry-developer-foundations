import { createClient } from '@osdk/client';
import type { User } from '@osdk/foundry.admin';
import { Users } from '@osdk/foundry.admin';
import { createConfidentialOauthClient } from '@osdk/oauth';
import type {
  RangrClient,
  Token,
} from '@codestrap/developer-foundations-types';

let client: RangrClient | undefined = undefined;

export function getRangrClient(): RangrClient {
  if (!client) {
    client = createRangrClient();
  }

  return client;
}

function createRangrClient(): RangrClient {
  if (
    !process.env['RANGR_OSDK_CLIENT_ID'] ||
    !process.env['RANGR_OSDK_CLIENT_SECRET'] ||
    !process.env['RANGR_ONTOLOGY_RID'] ||
    !process.env['RANGR_OSDK_CLIENT_SECRET']
  ) {
    throw new Error('missing required env vars for RANGR');
  }

  // setup the OSDK
  const clientId: string = process.env['RANGR_OSDK_CLIENT_ID'] || '';
  const url: string = process.env['RANGR_FOUNDRY_STACK_URL'] || '';
  const ontologyRid: string = process.env['RANGR_ONTOLOGY_RID'] || '';
  const clientSecret: string = process.env['RANGR_OSDK_CLIENT_SECRET'] || '';
  const scopes: string[] = [
    'api:ontologies-read',
    'api:ontologies-write',
    'api:admin-read',
    'api:connectivity-read',
    'api:connectivity-write',
    'api:connectivity-execute',
    'api:mediasets-read',
    'api:mediasets-write',
  ];

  const auth = createConfidentialOauthClient(
    clientId,
    clientSecret,
    url,
    scopes,
  );
  const client = createClient(url, ontologyRid, auth);

  const getUser = async () => {
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
