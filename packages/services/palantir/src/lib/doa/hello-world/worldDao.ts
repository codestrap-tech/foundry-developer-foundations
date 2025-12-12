import {
  SupportedFoundryClients,
  type WorldDao,
} from '@codestrap/developer-foundations-types';
import { foundryClientFactory } from '../../factory/foundryClientFactory';

export function makeWorldDao(): WorldDao {
  const { getToken, url, ontologyRid } = foundryClientFactory(
    process.env.FOUNDRY_CLIENT_TYPE || SupportedFoundryClients.PRIVATE,
    undefined,
  );

  return async ({ message, userId }) => {
    console.log(`makeWorldDao userId: ${userId}`);

    const apiKey = await getToken();

    const fullUrl = `${url}/api/v2/ontologies/${ontologyRid}/actions/say-hello/apply`;

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const body = JSON.stringify({
      parameters: {
        message,
      },
      options: {
        returnEdits: 'ALL',
      },
    });

    const apiResult = await fetch(fullUrl, {
      method: 'POST',
      headers: headers,
      body: body,
    });

    const result = (await apiResult.json()) as any;

    if (!result.edits || result.edits.edits.length === 0) {
      throw new Error('Failed to add hello message to the ontology.');
    }

    console.log(`create world action returned: ${result?.edits?.edits?.[0]}`);

    const worldId = result.edits.edits[0].primaryKey as string;

    const getUrl = `${url}/api/v2/ontologies/${ontologyRid}/objects/World/${worldId}`;
    const worldFetchResults = await fetch(getUrl, {
      method: 'GET',
      headers: headers,
    });

    const world = (await worldFetchResults.json()) as any;
    console.log(`the world ontology returned: ${JSON.stringify(world)}`);

    return { id: 'singleton', greeting: world.message };
  };
}
