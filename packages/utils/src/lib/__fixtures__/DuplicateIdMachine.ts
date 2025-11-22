// this fixture is used to test deduplication of duplicate state ID values
export const simpleMachine = [
  {
    id: 'sendSlackMessage',
    transitions: [
      {
        on: 'CONTINUE',
        target: 'sendSlackMessage',
      },
      {
        on: 'ERROR',
        target: 'failure',
      },
    ],
  },
  {
    id: 'sendSlackMessage',
    transitions: [
      {
        on: 'CONTINUE',
        target: 'sendSlackMessage',
      },
      {
        on: 'ERROR',
        target: 'failure',
      },
    ],
  },
  {
    id: 'sendSlackMessage',
    transitions: [
      {
        on: 'CONTINUE',
        target: 'success',
      },
      {
        on: 'ERROR',
        target: 'failure',
      },
    ],
  },
  {
    id: 'success',
    type: 'final',
  },
  {
    id: 'failure',
    type: 'final',
  },
];

export const complexMachine = [
  {
    id: 'sendSlackMessage',
    transitions: [
      {
        on: 'CONTINUE',
        target: 'sendSlackMessage',
      },
      {
        on: 'ERROR',
        target: 'failure',
      },
    ],
  },
  {
    id: 'sendSlackMessage',
    transitions: [
      {
        on: 'CONTINUE',
        target: 'parallelChecks',
      },
      {
        on: 'ERROR',
        target: 'failure',
      },
    ],
  },
  {
    id: 'parallelChecks',
    type: 'parallel',
    states: [
      {
        id: 'RegulatoryCheck',
        transitions: [
          { on: 'CONTINUE', target: 'success' },
          { on: 'ERROR', target: 'failure' },
        ],
      },
      {
        id: 'ConcentrationEstimation',
        transitions: [
          { on: 'CONTINUE', target: 'success' },
          { on: 'ERROR', target: 'failure' },
        ],
      },
    ],
    onDone: 'sendSlackMessage',
  },
  {
    id: 'sendSlackMessage',
    transitions: [
      {
        on: 'CONTINUE',
        target: 'success',
      },
      {
        on: 'ERROR',
        target: 'failure',
      },
    ],
  },
  {
    id: 'success',
    type: 'final',
  },
  {
    id: 'failure',
    type: 'final',
  },
];
