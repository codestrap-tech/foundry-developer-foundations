import { createConfidentialOauthClient } from '@osdk/oauth';
import { createClient } from '@osdk/client';
import { User, Users } from '@osdk/foundry.admin';
import { FoundryClient } from '@hello/types';

export function createFoundryClient(): FoundryClient {
  if (!process.env.OSDK_CLIENT_ID || !process.env.OSDK_CLIENT_SECRET) {
    throw new Error('missing required env vars');
  }

  // setup the OSDK
  const clientId: string = process.env.OSDK_CLIENT_ID;
  const url: string = process.env.FOUNDRY_STACK_URL;
  const ontologyRid: string = process.env.ONTOLOGY_RID;
  const clientSecret: string = process.env.OSDK_CLIENT_SECRET;
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

  return { auth, ontologyRid, url, client, getUser };
}
