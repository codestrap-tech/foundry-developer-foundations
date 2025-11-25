import { Bennie } from '../Bennie';
import { container } from '@codestrap/developer-foundations-di';
import type {
  Context,
  MachineEvent,
  StateConfig,
  MachineDao,
  RfpRequestResponse,
  RfpRequestsDao} from '@codestrap/developer-foundations-types';
import {
  TYPES,
} from '@codestrap/developer-foundations-types';
import type { State } from 'xstate';

if (!process.env.E2E) {
  test.skip('e2e test skipped in default run', () => {
    // won't run
  });
} else {
  describe('testing Bennie', () => {
    beforeAll(() => {
      jest.clearAllMocks();
    });

    it('Should generate two RFP requests, one for Northslope and one for RANGR. RANGR should request missing information', async () => {
      // real e2e test
      const bennie = new Bennie();

      const result = await bennie.askBennie(
        'Create an RFP for Northslope and RangrData to deliver a tariff solution on Foundry. The solution must include support for pricing models, simulations, and A/B testing of the outcomes. We expect this to be an 4 week engagement requiring 3 Python engineer, 1 TypeScript engineer, and 2 SME on developing pricing models. Then email me the responses.',
        process.env.FOUNDRY_TEST_USER
      );
      expect(result.executionId).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.status).toBe(200);

      const machineExecutionId = result.executionId;
      const rangrVendorId = 'rangrdata.com';
      const northslopeVendorId = 'northslopetech.com';

      // get the machine execution
      const machineDao = container.get<MachineDao>(TYPES.MachineDao);
      // allow this to throw if no machine execution is found
      let execution = await machineDao.read(result.executionId);

      let machine: StateConfig[] = execution.machine
        ? JSON.parse(execution.machine)
        : undefined;
      let stateDefinition: State<Context, MachineEvent> | undefined =
        execution.state
          ? (JSON.parse(execution.state) as State<Context, MachineEvent>)
          : undefined;

      if (!machine) {
        throw new Error(
          `no programmed state machine found for: ${machineExecutionId}`
        );
      }

      if (!stateDefinition) {
        throw new Error(`no state definition found for: ${machineExecutionId}`);
      }

      let context: Context = stateDefinition.context as Context;
      // find the requestRftp on the context associated with the supplied vendorId
      const vendorRfpRequest = Object.keys(context)
        .filter((key) => key.indexOf('requestRfp') >= 0)
        .map((key) => context[key])
        .filter((item) => item.vendorId === rangrVendorId)?.[0] as
        | RfpRequestResponse
        | undefined;
      // add the response to the requestRfp object.
      if (!vendorRfpRequest) {
        throw new Error(
          `Could not find matching RFP request for vendorId: ${rangrVendorId}`
        );
      }
      // get the rfp response and poll until RANGR send back missing information, ie rfpResponseStatus === 400
      const rfpDao = container.get<RfpRequestsDao>(TYPES.RfpRequestsDao);
      // find the associated RFPs
      const rangrRfpRequest = await rfpDao.search(
        machineExecutionId,
        rangrVendorId
      );

      let found = false;
      const maxAttempts = 10;
      let attempts = 0;

      while (!found && attempts < maxAttempts) {
        const rfp = await rfpDao.read(rangrRfpRequest.id);
        if (rfp.rfpResponseStatus === 400) {
          found = true;
        } else if (rfp.rfpResponseStatus === 200) {
          throw new Error('RANGR responses with 200 when 400 was expected');
        } else {
          await new Promise((res) => setTimeout(res, 30000)); // wait 30s
          attempts++;
        }
      }

      // send the thread message with the missing information
      const threadMessage = await bennie.sendThreadMessage(
        `The company is John Doe's Manufacturing and there address is 123 main street dallas tx, 75081 and the main contact is johndoe@johnsdoes.com.`,
        process.env.FOUNDRY_TEST_USER,
        machineExecutionId
      );
      expect(
        threadMessage.messages!.indexOf(
          '# RFPs for the following vendors were resubmitted:'
        )
      ).toBeGreaterThanOrEqual(0);

      // wait for the update from RANGR
      found = false;
      attempts = 0;

      while (!found && attempts < maxAttempts) {
        const rfp = await rfpDao.read(rangrRfpRequest.id);
        if (rfp.rfpResponseStatus === 200) {
          found = true;
        } else {
          await new Promise((res) => setTimeout(res, 30000)); // wait 30s
          attempts++;
        }
      }

      if (attempts > maxAttempts) {
        throw new Error(
          'Exceeded max attempts waiting for RANGR to respond to the resubmitted RFP'
        );
      }
      // submit the RFP responses, this will also advance the state machine
      const northSlopeRfpSubmissionResponse = await bennie.submitRfpResponse(
        `
### 📋 Proposed Staffing Plan

- **Engagement Director**: 0.25 FTE
- **Solutions Engineer – Senior**: 0.5 FTE
- **Solutions Engineer – Junior**: 1.0 FTE

**✅ Available Start Date**: June 17, 2025  
**💵 Estimated Weekly Cost**: $3,842.50  
**💰 Estimated Total Cost (8 weeks)**: $30,740.00
The earliest date when all required roles are simultaneously available is June 17, 2025, based on the provided availability information.

The weekly blended cost is calculated as follows:

Engagement Director: 0.25 FTE x $3,192 = $798
Solutions Engineer - Senior: 0.5 FTE x $3,192 = $1,596
Solutions Engineer - Junior: 1.0 FTE x $1,942 = $1,942
Total weekly cost: $798 + $1,596 + $1,942 = $3,842.50
Multiplying the weekly blended cost of $3,842.50 by the project duration of 8 weeks results in an estimated total cost of $30,740.00.
`,
        northslopeVendorId,
        machineExecutionId
      );

      expect(northSlopeRfpSubmissionResponse.status).toBe(200);

      // fetch the updated machine and assert the current state
      execution = await machineDao.read(result.executionId);

      machine = execution.machine ? JSON.parse(execution.machine) : undefined;
      stateDefinition = execution.state
        ? JSON.parse(execution.state)
        : undefined;

      if (!machine) {
        throw new Error(
          `no programmed state machine found for: ${machineExecutionId}`
        );
      }

      if (!stateDefinition) {
        throw new Error(`no state definition found for: ${machineExecutionId}`);
      }

      context = stateDefinition.context as Context;

      expect(stateDefinition.value).toBe('success');

      // submit the northslope response
    }, 300000);
  });
}
