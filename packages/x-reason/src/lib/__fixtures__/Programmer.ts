import type {
  StateConfig,
  Context,
  MachineEvent,
  Task,
} from '@codestrap/developer-foundations-types';

export const stateConfigArray: StateConfig[] = [
  {
    id: 'RecallSolutions',
    transitions: [
      { on: 'CONTINUE', target: 'GenerateIngredientsList' },
      { on: 'ERROR', target: 'failure' },
    ],
  },
  {
    id: 'GenerateIngredientsList',
    transitions: [
      { on: 'CONTINUE', target: 'IngredientDatabase' },
      { on: 'ERROR', target: 'failure' },
    ],
  },
  {
    id: 'IngredientDatabase',
    transitions: [
      { on: 'CONTINUE', target: 'parallelChecks' },
      { on: 'ERROR', target: 'failure' },
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
    onDone: 'FormulationSimulation',
  },
  {
    id: 'FormulationSimulation',
    transitions: [
      { on: 'CONTINUE', target: 'success' },
      { on: 'ERROR', target: 'failure' },
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

export const stateConfigResolvePastStates = JSON.parse(`[
  {
    "id": "getAvailableMeetingTimes",
    "task": "Get available times for meeting attendees - Attendees: Connor Deeks <connor.deeks@codestrap.me>, Dorian Smiley <dsmiley@codestrap.me>. Proposed date: 2025-07-25 at 3pm PDT. Duration: 1 hour. If all attendees are not available, resolve unavailable attendees.",
    "includesLogic": true,
    "transitions": [
      {
        "on": "CONTINUE",
        "target": "scheduleMeeting"
      },
      {
        "on": "CONTINUE",
        "target": "resolveUnavailableAttendees"
      },
      {
        "on": "ERROR",
        "target": "failure"
      }
    ]
  },
  {
    "id": "resolveUnavailableAttendees",
    "task": "Resolve unavailable attendees for the meeting - Attendees: Connor Deeks <connor.deeks@codestrap.me>, Dorian Smiley <dsmiley@codestrap.me>. If an agreed upon time has been reached target the get available meeting times state. Else target the pause state.",
    "includesLogic": true,
    "transitions": [
      {
        "on": "CONTINUE",
        "target": "getAvailableMeetingTimes"
      },
      {
        "on": "PAUSE",
        "target": "pause"
      },
      {
        "on": "ERROR",
        "target": "failure"
      }
    ]
  },
  {
    "id": "scheduleMeeting",
    "task": "Schedule a meeting - Subject: Discuss changes to Vicki - Attendees: Connor Deeks <connor.deeks@codestrap.me>, Dorian Smiley <dsmiley@codestrap.me>. Start time: 2025-07-25 at 3pm PDT. Duration: 1 hour.",
    "includesLogic": false,
    "transitions": [
      {
        "on": "CONTINUE",
        "target": "success"
      },
      {
        "on": "ERROR",
        "target": "failure"
      }
    ]
  },
  {
    "id": "success",
    "type": "final"
  },
  {
    "id": "failure",
    "type": "final"
  }
]`) as StateConfig[];

export function getFunctionCatalog(dispatch: (action: any) => void) {
  return new Map<string, Task>([
    [
      'readEmails',
      {
        description:
          'Retrieves the users email messages for a given time period.',
        implementation: async (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log('readEmails implementation in function catalog called');
          dispatch({ type: 'CONTINUE' });
        },
      },
    ],
    [
      'researchReport',
      {
        description:
          'Creates a research report based on the users instructions.',
        implementation: async (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log(
            'researchReport implementation in function catalog called'
          );
          dispatch({ type: 'CONTINUE' });
        },
      },
    ],
    [
      'createTask',
      {
        description:
          'Creates task assigments in our ticketing system. This tool should never be used for follow up communication such as reminder messages, emails, project reports etc. This tool is used to assign a bug report, feature, research task, chore, etc.',
        implementation: async (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log('createTask implementation in function catalog called');
          dispatch({ type: 'CONTINUE' });
        },
      },
    ],
    [
      'getAvailableMeetingTimes',
      {
        description:
          'Gets the available times for all required and optional meeting attendees',
        implementation: async (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log(
            'getAvailableMeetingTimes implementation in function catalog called'
          );
          dispatch({ type: 'CONTINUE' });
        },
      },
    ],
    [
      'resolveUnavailableAttendees',
      {
        description:
          'Resolves unavailable attendees for meeting requests where not all attendees are available.',
        implementation: async (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log(
            'resolveUnavailableAttendees implementation in function catalog called'
          );
          dispatch({ type: 'CONTINUE' });
        },
      },
    ],
    [
      'scheduleMeeting',
      {
        description:
          'Schudules a meeting using the provided time at which all attendees are available.',
        implementation: async (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log('scheduleMeeting function catalog implementation called');
          dispatch({ type: 'CONTINUE' });
        },
      },
    ],
    [
      'getProjectFiles',
      {
        description: 'Retrieves project files.',
        implementation: async (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log('getProjectFiles function catalog implementation called');
          dispatch({ type: 'CONTINUE' });
        },
      },
    ],
    [
      'getProjectStatusReport',
      {
        description:
          'Retrieves a cull project status report including estimated completion date, task lists, and timeline.',
        implementation: async (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log(
            'getProjectStatusReport function catalog implementation called'
          );
          dispatch({ type: 'CONTINUE' });
        },
      },
    ],
    [
      'sendEmail',
      {
        description: 'Sends an email.',
        implementation: async (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log('sendEmail function catalog implementation called');
          dispatch({ type: 'CONTINUE' });
        },
      },
    ],
    [
      'writeEmail',
      {
        description: 'Writes a draft email for review.',
        implementation: async (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log('writeEmail function catalog implementation called');
          dispatch({ type: 'CONTINUE' });
        },
      },
    ],
    [
      'writeSlackMessage',
      {
        description: 'Writes a draft slack message for review.',
        implementation: async (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log(
            'writeSlackMessage function catalog implementation called'
          );
          dispatch({ type: 'CONTINUE' });
        },
      },
    ],
    [
      'sendSlackMessage',
      {
        description: 'Sends a Slack Message',
        implementation: async (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log(
            'sendSlackMessage function catalog implementation called'
          );
          dispatch({ type: 'CONTINUE' });
        },
      },
    ],
    [
      'UnsafeQuestion',
      {
        description: 'Default state to display for unsafe questions',
        implementation: (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log('UnsafeQuestion implementation called');
          dispatch({ type: 'success' });
        },
      },
    ],
    [
      'UnsupportedQuestion',
      {
        description: 'Default state to display for unsupported questions',
        implementation: (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log('UnsupportedQuestion implementation called');
          dispatch({ type: 'success' });
        },
      },
    ],
  ]);
}
