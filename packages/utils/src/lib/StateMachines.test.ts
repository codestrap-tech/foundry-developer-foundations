import {
  simpleMachine,
  complexMachine,
} from './__fixtures__/DuplicateIdMachine';
import type { StateConfig } from '@codestrap/developer-foundations-types';
import { getUniqueStateIds } from './StateMachines';
let counter = 0;

jest.mock('./uuid', () => ({
  ...jest.requireActual('./uuid'),
  uuidv4: jest.fn(() => (++counter).toString()),
}));

afterAll(() => {
  jest.clearAllMocks();
});

beforeEach(() => (counter = 0));

describe('Testing the getUniqueStateIds function', () => {
  test('Testing Deuplication of a state machines without parellel states', async () => {
    const inputStates = simpleMachine as StateConfig[];
    const deduplicatedStates = getUniqueStateIds(inputStates);
    const serializedResults = JSON.stringify(deduplicatedStates);

    expect(serializedResults).toBe(
      '[{"id":"sendSlackMessage|1","transitions":[{"on":"CONTINUE","target":"sendSlackMessage|2"},{"on":"ERROR","target":"failure"}]},{"id":"sendSlackMessage|2","transitions":[{"on":"CONTINUE","target":"sendSlackMessage|3"},{"on":"ERROR","target":"failure"}]},{"id":"sendSlackMessage|3","transitions":[{"on":"CONTINUE","target":"success"},{"on":"ERROR","target":"failure"}]},{"id":"success","type":"final"},{"id":"failure","type":"final"}]',
    );
  });

  test('Testing Deuplication of a state machines with parellel states', async () => {
    const inputStates = complexMachine as StateConfig[];
    const deduplicatedStates = getUniqueStateIds(inputStates);
    const serializedResults = JSON.stringify(deduplicatedStates);

    expect(serializedResults).toBe(
      '[{"id":"sendSlackMessage|1","transitions":[{"on":"CONTINUE","target":"sendSlackMessage|2"},{"on":"ERROR","target":"failure"}]},{"id":"sendSlackMessage|2","transitions":[{"on":"CONTINUE","target":"parallelChecks|3"},{"on":"ERROR","target":"failure"}]},{"id":"parallelChecks|3","type":"parallel","states":[{"id":"RegulatoryCheck|5","transitions":[{"on":"CONTINUE","target":"success"},{"on":"ERROR","target":"failure"}],"parentId":"parallelChecks|3"},{"id":"ConcentrationEstimation|6","transitions":[{"on":"CONTINUE","target":"success"},{"on":"ERROR","target":"failure"}],"parentId":"parallelChecks|3"}],"onDone":"sendSlackMessage|4"},{"id":"sendSlackMessage|4","transitions":[{"on":"CONTINUE","target":"success"},{"on":"ERROR","target":"failure"}]},{"id":"success","type":"final"},{"id":"failure","type":"final"}]',
    );
  });
});
