import type { RangrRequestsDao } from '@codestrap/developer-foundations-types';
import { getRangrClient } from '../../rangrClient';
import { submitRangrRfp } from './delegates/rangr/submit';

export function makeRangrRfpRequestsDao(): RangrRequestsDao {
  const client = getRangrClient();

  return {
    // TODO code out all methods using OSDK API calls
    submit: async (rfp: string, machineExecutionId: string) => {
      const machine = await submitRangrRfp(rfp, machineExecutionId, client);

      return machine;
    },
  };
}
