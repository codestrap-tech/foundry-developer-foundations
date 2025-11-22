import type { FoundryClient } from '@codestrap/developer-foundations-types';
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
  if (
    !process.env['NEXT_PUBLIC_OSDK_CLIENT_ID'] ||
    !process.env['NEXT_PUBLIC_REDIRECT_URL'] ||
    !process.env['NEXT_PUBLIC_FOUNDRY_STACK_URL'] ||
    !process.env['NEXT_PUBLIC_ONTOLOGY_RID']
  ) {
    throw new Error(
      'missing required env vars: NEXT_PUBLIC_OSDK_CLIENT_ID, NEXT_PUBLIC_REDIRECT_URL, NEXT_PUBLIC_FOUNDRY_STACK_URL, NEXT_PUBLIC_ONTOLOGY_RID',
    );
  }

  const getUser = async () => {
    const context = getRequestContext();

    console.log(`public getUser called, returning: ${context?.user?.username}`);

    return context?.user;
  };

  // IMPORTANT: the createPublicOauthClient method requires running client side
  // hence we return stubs here and use a global to retrieve the token
  // This global will get overwritten upon every API request and is managed client side
  // so we "assume" it's valid and that the client is using the OSDK client to get refresh tokens
  const getToken = async function () {
    const context = getRequestContext();

    console.log(
      `public getToken called, returning length: ${context?.token?.length}`,
    );

    return context?.token;
  };

  const auth = {
    client: {},
    auth: {},
    ontologyRid: process.env['NEXT_PUBLIC_ONTOLOGY_RID'],
    url: process.env['NEXT_PUBLIC_FOUNDRY_STACK_URL'],
    getUser: () => 'undefined',
    getToken: () => 'undefined',
  };
  // @ts-expect-error we return a mock client since the actual auth is managed client side
  return {
    auth,
    ontologyRid: process.env['NEXT_PUBLIC_ONTOLOGY_RID'],
    url: process.env['NEXT_PUBLIC_FOUNDRY_STACK_URL'],
    client,
    getUser,
    getToken,
  };
}
