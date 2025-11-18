import { createClient } from '@osdk/client';
import { User, Users } from '@osdk/foundry.admin';
import { createPublicOauthClient } from '@osdk/oauth';
import { FoundryClient, Token } from '@codestrap/developer-foundations-types';
import { env } from '../../../env';

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
  // setup the OSDK
  const clientId = env.NEXT_PUBLIC_OSDK_CLIENT_ID;
  const url = env.NEXT_PUBLIC_FOUNDRY_STACK_URL;
  const ontologyRid = env.NEXT_PUBLIC_ONTOLOGY_RID;
  const redirectUrl: string = window.location.href.split('?')[0]; // TODO: WHY???, should go from env
  console.log('🚀 ~ createFoundryClient ~ redirectUrl:', redirectUrl)
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
  //                                   client_id, url,redirectUrl, useHistory, loginPage, postLoginPage, scopes
  const auth = createPublicOauthClient(
    clientId,
    url,
    redirectUrl,
    true,
    redirectUrl,
    redirectUrl,
    scopes
  );
  const client = createClient(url, ontologyRid, auth);
  console.log('🚀 ~ createFoundryClient ~ client:', client)

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

  auth.addEventListener('refresh', (evt) => {
    token = evt.detail; // Token
    tokenExpire = new Date(token.expires_at);
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
