import type { Contacts } from '@codestrap/developer-foundations-types';
import { FoundryClient } from '@codestrap/developer-foundations-types';

export async function searchContacts(
  fullName: string,
  company: string,
  token: string,
  ontologyRid: string,
  url: string,
  pageSize = 10,
): Promise<Contacts[]> {
  console.log(`searchContacts fullName: ${fullName} company: ${company}`);

  const apiKey = token;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const fullUrl = `${url}/api/v2/ontologies/${ontologyRid}/objects/Contacts/search`;

  const body = JSON.stringify({
    pageSize,
    where: {
      type: 'and',
      value: [
        {
          type: 'containsAnyTerm',
          field: 'fullName',
          value: fullName,
          fuzzy: true,
        },
        {
          type: 'containsAnyTerm',
          field: 'enterpriseName',
          value: company,
          fuzzy: true,
        },
      ],
    },
  });

  const apiResult = await fetch(fullUrl, {
    method: 'POST',
    headers: headers,
    body: body,
  });

  const apiResponse = (await apiResult.json()) as any;

  if (apiResponse.errorCode) {
    console.log(
      `errorInstanceId: ${apiResponse.errorCode} errorName: ${apiResponse.errorName} errorCode: ${apiResponse.errorCode}`,
    );
    throw new Error(
      `An error occurred while calling search Contacts errorInstanceId: ${apiResponse.errorInstanceId} errorCode: ${apiResponse.errorCode}`,
    );
  }

  return apiResponse.data as Contacts[];
}
