import type {
  MachineExecutions} from '@codestrap/developer-foundations-types';
import {
  FoundryClient
} from '@codestrap/developer-foundations-types';

export async function readMachineExecution(
  id: string,
  token: string,
  ontologyRid: string,
  url: string,
): Promise<MachineExecutions> {
  console.log(`readMachineExecution id: ${id}`);

  const apiKey = token;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const fullUrl = `${url}/api/v2/ontologies/${ontologyRid}/objects/MachineExecutions/${id}`;
  const machineFetchResults = await fetch(fullUrl, {
    method: 'GET',
    headers: headers,
  });

  const apiResponse = (await machineFetchResults.json()) as any;

  // NOT_FOUND errors are expected during polling operations. They are cluttering the console so I turned logging them off
  if (apiResponse.errorCode && apiResponse.errorCode !== 'NOT_FOUND') {
    console.log(
      `errorInstanceId: ${apiResponse.errorCode} errorName: ${apiResponse.errorName} errorCode: ${apiResponse.errorCode}`
    );
    throw new Error(
      `An error occurred while calling read machine errorInstanceId: ${apiResponse.errorInstanceId} errorCode: ${apiResponse.errorCode}`
    );
  }

  // trimming this out because the logs make these object massive
  // console.log(`the machine execution ontology returned: ${JSON.stringify(apiResponse)}`)

  return apiResponse as MachineExecutions;
}
