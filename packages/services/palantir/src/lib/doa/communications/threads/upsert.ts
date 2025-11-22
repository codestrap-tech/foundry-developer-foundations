import type { Threads } from '@codestrap/developer-foundations-types';
import { FoundryClient } from '@codestrap/developer-foundations-types';

export async function upsertThread(
  messages: string,
  appId: string,
  token: string,
  ontologyRid: string,
  url: string,
  id?: string,
): Promise<Threads> {
  console.log(`upsertThread threadId: ${id}`);

  const apiKey = token;

  const fullUrl = `${url}/api/v2/ontologies/${ontologyRid}/actions/upsert-thread/apply`;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const body = JSON.stringify({
    parameters: {
      id,
      messages,
      appId,
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
    throw new Error('Failed to upsert thread message to the ontology.');
  }

  const threadId = result.edits.edits[0].primaryKey as string;

  const getUrl = `${url}/api/v2/ontologies/${ontologyRid}/objects/Threads/${threadId}`;
  const machineFetchResults = await fetch(getUrl, {
    method: 'GET',
    headers: headers,
  });

  const thread = (await machineFetchResults.json()) as Threads;

  return thread;
}
