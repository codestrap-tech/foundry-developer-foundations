import type { Tickets } from '@codestrap/developer-foundations-types';
import { FoundryClient } from '@codestrap/developer-foundations-types';

export async function upsertTicket(
  token: string,
  ontologyRid: string,
  url: string,
  id: string,
  alertTitle: string,
  alertType: string,
  description: string,
  severity = 'Low',
  status = 'Open',
  points?: number,
  assignees?: string,
): Promise<Tickets> {
  console.log(`upsertTicket machineId: ${id}`);

  const apiKey = token;

  const fullUrl = `${url}/api/v2/ontologies/${ontologyRid}/actions/upsert-ticket/apply`;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const body = JSON.stringify({
    parameters: {
      id,
      alertTitle,
      alertType,
      description,
      severity,
      status,
      points,
      assignees,
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
    throw new Error('Failed to upsert ticket message to the ontolgoy.');
  }

  console.log(`upsert ticket action returned: ${result?.edits?.edits?.[0]}`);

  const ticketId = result.edits.edits[0].primaryKey as string;

  const getUrl = `${url}/api/v2/ontologies/${ontologyRid}/objects/Tickets/${ticketId}`;
  const ticketFetchResults = await fetch(getUrl, {
    method: 'GET',
    headers: headers,
  });

  const ticket = (await ticketFetchResults.json()) as Tickets;
  return ticket;
}
