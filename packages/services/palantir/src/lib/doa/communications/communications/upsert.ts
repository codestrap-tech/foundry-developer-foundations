import type {
  Communications} from '@codestrap/developer-foundations-types';
import {
  FoundryClient,
} from '@codestrap/developer-foundations-types';
import { uuidv4 } from '@codestrap/developer-foundations-utils';

export async function upsertCommunications(
  channel: string,
  formattedMessage: string,
  status: string,
  taskList: string,
  comType: string,
  owner: string,
  token: string,
  ontologyRid: string,
  url: string,
  questionPrompt?: string,
  tokens?: number,
  id: string = uuidv4()
): Promise<Communications> {
  if (id.length === 0) {
    id = uuidv4();
  }

  console.log(`upsertCommunications id: ${id}`);

  const apiKey = token;

  const fullURl = `${url}/api/v2/ontologies/${ontologyRid}/actions/upsert-communication/apply`;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const body = JSON.stringify({
    parameters: {
      channel,
      formattedMessage,
      status,
      taskList,
      comType,
      owner,
      questionPrompt,
      tokens,
      id,
    },
    options: {
      returnEdits: 'ALL',
    },
  });

  const apiResult = await fetch(fullURl, {
    method: 'POST',
    headers,
    body,
  });

  const result = (await apiResult.json()) as any;

  if (!result.edits || result.edits.edits.length === 0) {
    throw new Error('Failed to upsert communications to the ontolgoy.');
  }

  console.log(
    `upsert communications action returned: ${result?.edits?.edits?.[0]}`
  );

  const commsId = result.edits.edits[0].primaryKey as string;

  const getUrl = `${url}/api/v2/ontologies/${ontologyRid}/objects/Communications/${commsId}`;
  const fetchResults = await fetch(getUrl, {
    method: 'GET',
    headers: headers,
  });

  const comms = (await fetchResults.json()) as Communications;

  return comms;
}
