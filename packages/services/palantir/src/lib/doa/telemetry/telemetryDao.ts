import {
  type TelemetryDao,
} from '@codestrap/developer-foundations-types';
import { foundryClientFactory } from '../../factory/foundryClientFactory';
import { getClientType } from '../../utils/getClientType';

export function makeTelemetryDao(): TelemetryDao {
  const { getToken, url, ontologyRid } = foundryClientFactory(getClientType(), undefined);

  return async (inputJSON) => {
    const token = await getToken();
    const apiKey = token;

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };

    const body = JSON.stringify({
      parameters: {
        inputJSON,
      },
      options: {
        returnEdits: 'ALL',
      },
    });

    const apiResults = await fetch(
      `${url}/api/v2/ontologies/${ontologyRid}/actions/collect-telemetry/apply`,
      {
        method: 'POST',
        headers,
        body,
      }
    );

    const apiResponse = (await apiResults.json()) as any;

    if (apiResponse.errorCode) {
      console.log(
        `errorInstanceId: ${apiResponse.errorCode} errorName: ${apiResponse.errorName} errorCode: ${apiResponse.errorCode}`
      );
      throw new Error(
        `An error occurred while writing telemetry data errorInstanceId: ${apiResponse.errorInstanceId} errorCode: ${apiResponse.errorCode}`
      );
    }

    return JSON.stringify(apiResponse);
  };
}
