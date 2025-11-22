import type { Contacts } from '@codestrap/developer-foundations-types';
import { FoundryClient } from '@codestrap/developer-foundations-types';

export async function readContact(
  id: string,
  token: string,
  ontologyRid: string,
  url: string,
): Promise<Contacts> {
  console.log(`readContact id: ${id}`);

  const apiKey = token;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const fullUrl = `${url}/api/v2/ontologies/${ontologyRid}/objects/Contacts/${id}`;
  const contactFetchResults = await fetch(fullUrl, {
    method: 'GET',
    headers: headers,
  });

  const apiResponse = (await contactFetchResults.json()) as any;

  if (apiResponse.errorCode) {
    console.log(
      `errorInstanceId: ${apiResponse.errorCode} errorName: ${apiResponse.errorName} errorCode: ${apiResponse.errorCode}`,
    );
    throw new Error(
      `An error occurred while calling read machine errorInstanceId: ${apiResponse.errorInstanceId} errorCode: ${apiResponse.errorCode}`,
    );
  }

  console.log(
    `the machine execution ontology returned: ${JSON.stringify(apiResponse)}`,
  );

  return apiResponse as Contacts;
}
