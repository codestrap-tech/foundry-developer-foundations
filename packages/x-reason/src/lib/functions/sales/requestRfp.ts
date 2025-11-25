import { Context, MachineEvent } from '@codestrap/developer-foundations-types';
import { uuidv4 } from '@codestrap/developer-foundations-utils';
import {
  RangrRequestsDao,
  RfpRequestsDao,
  TYPES,
  RfpRequestResponse,
} from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';

function extractDomain(input: string) {
  const match = input.match(/<([^>]+)>/);
  return match ? match[1] : null;
}

function extractVendorName(input: string) {
  // eslint-disable-next-line regexp/optimal-quantifier-concatenation
  const match = input.match(/:\s*([\w\s]+)\s*</);
  return match ? match[1].trim() : null;
}

export async function requestRfp(
  context: Context,
  event?: MachineEvent,
  task?: string
): Promise<RfpRequestResponse> {
  const vendorName = extractVendorName(task!);
  const vendorId = extractDomain(task!);
  const message = 'We have received your RFP and will respond shortly';

  if (!vendorName || !vendorId) {
    throw new Error('Vendor name or id not found!');
  }

  // TODO handle all vendors. The only thing that should change in the code below is the four params for url, certs, etc
  // maybe just create a factory to get the clientId, clientSecret, ontologyRid, and url
  if (
    vendorId === 'axisdata.com' ||
    vendorId === 'rangrdata.com' ||
    vendorId === 'rangr.com' ||
    vendorId.indexOf('rangr.com') >= 0
  ) {
    // TODO inject ranger dao and execute
    const rangrRfpDao = container.get<RangrRequestsDao>(
      TYPES.RangrRfpRequestsDao
    );
    // submit to RANGR
    const rangrRfpResult = rangrRfpDao.submit(
      task!,
      context.machineExecutionId!
    );

    console.log(`RANGR returned the following response: ${rangrRfpResult}`);
  }

  // record the request in our system, this is useful for demos and for our records
  const rfpDao = container.get<RfpRequestsDao>(TYPES.RfpRequestsDao);
  await rfpDao.upsert(task!, message, vendorId, context.machineExecutionId!);

  return {
    // TODO replace with status and message from service
    status: 200,
    message,
    // Note: vendor name and ID are extract via the LLM above
    vendorName,
    vendorId,
    received: false,
    // TODO add executionId to context
    machineExecutionId: context.executionId,
    // TODO replace with reciept from service
    receipt: {
      id: uuidv4(),
      timestamp: new Date(),
    },
  };
}
