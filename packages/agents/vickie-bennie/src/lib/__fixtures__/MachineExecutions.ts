export const machineId = 'mock-execution-id';
export const machineId2 = 'mock-execution-id2';

export const mockExecution = {
  id: machineId,
  state: `{
            "actions":[{"type":"entry"}],
            "activities":{},
            "meta":{},
            "events":[],
            "value":"pause",
            "context":{
                "status":0,
                "requestId":"test",
                "stack":["sendEmail|2"],
                "sendEmail|2": {
                    "message": "Test message",
                    "channelId": "test-channel"
                }
            },
            "_event":{
                "name":"xstate.init",
                "data":{"type":"xstate.init"},
                "$$type":"scxml",
                "type":"external"
            },
            "_sessionid":"x:1",
            "event":{"type":"xstate.init"},
            "children":{},
            "done":false,
            "tags":[]
        }`,
  machine: `[
            {
                "id": "sendEmail|2",
                "transitions": [
                    {
                        "on": "CONTINUE",
                        "target": "sendSlackMessage|3"
                    },
                    {
                        "on": "pause",
                        "target": "pause"
                    },
                    {
                        "on": "ERROR",
                        "target": "failure"
                    }
                ]
            },
            {
                "id": "sendSlackMessage|3",
                "transitions": [
                    {
                        "on": "CONTINUE",
                        "target": "sendEmail|4"
                    },
                    {
                        "on": "ERROR",
                        "target": "failure"
                    }
                ]
            },
            {
                "id": "sendEmail|4",
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
        ]`,
};

const date = new Date();
// get tomorrow
date.setDate(date.getDate() + 1);
const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });

// this is the second state in the machine
export const mockExecution2 = {
  id: machineId2,
  state: `{
    "actions": [
        {
            "type": "entry"
        }
    ],
    "activities": {},
    "meta": {},
    "events": [],
    "value": "success",
    "context": {
        "requestId": "2117368a-3119-44dd-878b-d9ff886ae7f5",
        "status": 0,
        "childToParentStateMap": {},
        "machineExecutionId": "2618bc50-d865-4aaf-8625-a05eb608e4e3",
        "solution": "1. **Get available times for meeting attendees** - Attendees: Dorian Smiley <dsmiley@codestrap.me>, Connor Deeks <connor.deeks@codestrap.me>    Proposed date: 2025-7-25    Start Time: 3:00 PM    Duration: 1 hour    If all attendees are not available, resolve unavailable attendees  2. **Schedule a meeting** - Subject: Meeting with Dorian and Connor. - Attendees: Dorian Smiley <dsmiley@codestrap.me>, Connor Deeks <connor.deeks@codestrap.me>    Date: 2025-7-25    Start Time: 3:00 PM    Duration: 1 hour",
        "stack": [
            "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152",
            "resolveUnavailableAttendees|c47a4244-979e-4090-a325-89447368fd42",
            "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152",
            "resolveUnavailableAttendees|c47a4244-979e-4090-a325-89447368fd42",
            "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152",
            "resolveUnavailableAttendees|c47a4244-979e-4090-a325-89447368fd42",
            "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152",
            "resolveUnavailableAttendees|c47a4244-979e-4090-a325-89447368fd42",
            "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152",
            "resolveUnavailableAttendees|c47a4244-979e-4090-a325-89447368fd42",
            "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152",
            "resolveUnavailableAttendees|c47a4244-979e-4090-a325-89447368fd42",
            "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152",
            "resolveUnavailableAttendees|c47a4244-979e-4090-a325-89447368fd42",
            "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152",
            "scheduleMeeting|7f8824d7-bb8e-4bb3-a820-5ab9e7dc6533",
            "success"
        ],
        "stateId": "scheduleMeeting|7f8824d7-bb8e-4bb3-a820-5ab9e7dc6533",
        "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152": {
            "times": [
                {
                    "start": "2025-08-04T16:30:00.000Z",
                    "end": "2025-08-04T17:30:00.000Z",
                    "availableAttendees": [
                        "dsmiley@codestrap.me",
                        "connor.deeks@codestrap.me"
                    ],
                    "unavailableAttendees": []
                }
            ],
            "subject": "Meeting with Dorian and Connor",
            "durationInMinutes": 60,
            "allAvailable": true,
            "agenda": "Found 1 optimal time slots."
        },
        "resolveUnavailableAttendees|c47a4244-979e-4090-a325-89447368fd42": {
            "emailId": "1984e2ae93f40a57",
            "message": "Hi Dorian and Connor, Happy Sunday! I'm having trouble finding an available day/time that works for the both of you for our meeting about task list items 1 and 2. I have the following time as available but it looks like both of you are unavailable: Tue Jul 29 2025 10:00:00 GMT-0700 (Pacific Daylight Time). Please respond to this message with a proposed day/time that works. If you can move any existing meetings around to make the unavailable time work, that would be preferred. Thanks, Vickie.",
            "meetingSubject": "Meeting with Dorian and Connor.",
            "meetingDuration": 60,
            "dayTimes": "                  start: Tue Jul 29 2025 10:00:00 GMT-0700 (Pacific Daylight Time),         end: Tue Jul 29 2025 10:00:00 GMT-0700 (Pacific Daylight Time),         available: ,         unavailable: dsmiley@codestrap.me, connor.deeks@codestrap.me         ",
            "modelDialog": "Hi Dorian and Connor, Happy Sunday! I'm having trouble finding an available day/time that works for the both of you for our meeting about task list items 1 and 2. I have the following time as available but it looks like both of you are unavailable: Tue Jul 29 2025 10:00:00 GMT-0700 (Pacific Daylight Time). Please respond to this message with a proposed day/time that works. If you can move any existing meetings around to make the unavailable time work, that would be preferred. Thanks, Vickie.",
            "ts": 1753658092064,
            "resolution": "${dayName} at 4",
            "processEmail": true
        },
        "scheduleMeeting|7f8824d7-bb8e-4bb3-a820-5ab9e7dc6533": {
            "id": "pccjsddgde4kjalihqb6pnsohs",
            "htmlLink": "https://www.google.com/calendar/event?eid=cGNjanNkZGdkZTRramFsaWhxYjZwbnNvaHMgdmljaUBjb2Rlc3RyYXAubWU",
            "status": "confirmed"
        },
        "success": {
            "resolution": "${dayName} at 4",
            "processEmail": true
        }
    },
    "_event": {
        "name": "CONTINUE",
        "data": {
            "type": "CONTINUE",
            "payload": {
                "stateId": "scheduleMeeting|7f8824d7-bb8e-4bb3-a820-5ab9e7dc6533",
                "scheduleMeeting|7f8824d7-bb8e-4bb3-a820-5ab9e7dc6533": {
                    "id": "pccjsddgde4kjalihqb6pnsohs",
                    "htmlLink": "https://www.google.com/calendar/event?eid=cGNjanNkZGdkZTRramFsaWhxYjZwbnNvaHMgdmljaUBjb2Rlc3RyYXAubWU",
                    "status": "confirmed"
                }
            }
        },
        "$$type": "scxml",
        "type": "external"
    },
    "_sessionid": "x:9",
    "event": {
        "type": "CONTINUE",
        "payload": {
            "stateId": "scheduleMeeting|7f8824d7-bb8e-4bb3-a820-5ab9e7dc6533",
            "scheduleMeeting|7f8824d7-bb8e-4bb3-a820-5ab9e7dc6533": {
                "id": "pccjsddgde4kjalihqb6pnsohs",
                "htmlLink": "https://www.google.com/calendar/event?eid=cGNjanNkZGdkZTRramFsaWhxYjZwbnNvaHMgdmljaUBjb2Rlc3RyYXAubWU",
                "status": "confirmed"
            }
        }
    },
    "historyValue": {
        "current": "success",
        "states": {}
    },
    "history": {
        "actions": [
            {
                "type": "entry"
            }
        ],
        "activities": {},
        "meta": {},
        "events": [],
        "value": "scheduleMeeting|7f8824d7-bb8e-4bb3-a820-5ab9e7dc6533",
        "context": {
            "requestId": "2117368a-3119-44dd-878b-d9ff886ae7f5",
            "status": 0,
            "childToParentStateMap": {},
            "machineExecutionId": "2618bc50-d865-4aaf-8625-a05eb608e4e3",
            "solution": "1. **Get available times for meeting attendees** - Attendees: Dorian Smiley <dsmiley@codestrap.me>, Connor Deeks <connor.deeks@codestrap.me>    Proposed date: 2025-7-25    Start Time: 3:00 PM    Duration: 1 hour    If all attendees are not available, resolve unavailable attendees  2. **Schedule a meeting** - Subject: Meeting with Dorian and Connor. - Attendees: Dorian Smiley <dsmiley@codestrap.me>, Connor Deeks <connor.deeks@codestrap.me>    Date: 2025-7-25    Start Time: 3:00 PM    Duration: 1 hour",
            "stack": [
                "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152",
                "resolveUnavailableAttendees|c47a4244-979e-4090-a325-89447368fd42",
                "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152",
                "resolveUnavailableAttendees|c47a4244-979e-4090-a325-89447368fd42",
                "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152",
                "resolveUnavailableAttendees|c47a4244-979e-4090-a325-89447368fd42",
                "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152",
                "resolveUnavailableAttendees|c47a4244-979e-4090-a325-89447368fd42",
                "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152",
                "resolveUnavailableAttendees|c47a4244-979e-4090-a325-89447368fd42",
                "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152",
                "resolveUnavailableAttendees|c47a4244-979e-4090-a325-89447368fd42",
                "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152",
                "resolveUnavailableAttendees|c47a4244-979e-4090-a325-89447368fd42",
                "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152",
                "scheduleMeeting|7f8824d7-bb8e-4bb3-a820-5ab9e7dc6533",
                "success"
            ],
            "stateId": "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152",
            "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152": {
                "times": [
                    {
                        "start": "2025-08-04T16:30:00.000Z",
                        "end": "2025-08-04T17:30:00.000Z",
                        "availableAttendees": [
                            "dsmiley@codestrap.me",
                            "connor.deeks@codestrap.me"
                        ],
                        "unavailableAttendees": []
                    }
                ],
                "subject": "Meeting with Dorian and Connor",
                "durationInMinutes": 60,
                "allAvailable": true,
                "agenda": "Found 1 optimal time slots."
            },
            "resolveUnavailableAttendees|c47a4244-979e-4090-a325-89447368fd42": {
                "emailId": "1984e2ae93f40a57",
                "message": "Hi Dorian and Connor, Happy Sunday! I'm having trouble finding an available day/time that works for the both of you for our meeting about task list items 1 and 2. I have the following time as available but it looks like both of you are unavailable: Tue Jul 29 2025 10:00:00 GMT-0700 (Pacific Daylight Time). Please respond to this message with a proposed day/time that works. If you can move any existing meetings around to make the unavailable time work, that would be preferred. Thanks, Vickie.",
                "meetingSubject": "Meeting with Dorian and Connor.",
                "meetingDuration": 60,
                "dayTimes": "                  start: Tue Jul 29 2025 10:00:00 GMT-0700 (Pacific Daylight Time),         end: Tue Jul 29 2025 10:00:00 GMT-0700 (Pacific Daylight Time),         available: ,         unavailable: dsmiley@codestrap.me, connor.deeks@codestrap.me         ",
                "modelDialog": "Hi Dorian and Connor, Happy Sunday! I'm having trouble finding an available day/time that works for the both of you for our meeting about task list items 1 and 2. I have the following time as available but it looks like both of you are unavailable: Tue Jul 29 2025 10:00:00 GMT-0700 (Pacific Daylight Time). Please respond to this message with a proposed day/time that works. If you can move any existing meetings around to make the unavailable time work, that would be preferred. Thanks, Vickie.",
                "ts": 1753658092064,
                "resolution": "${dayName} at 4",
                "processEmail": true
            }
        },
        "_event": {
            "name": "CONTINUE",
            "data": {
                "type": "CONTINUE",
                "payload": {
                    "stateId": "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152",
                    "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152": {
                        "times": [
                            {
                                "start": "2025-08-04T16:30:00.000Z",
                                "end": "2025-08-04T17:30:00.000Z",
                                "availableAttendees": [
                                    "dsmiley@codestrap.me",
                                    "connor.deeks@codestrap.me"
                                ],
                                "unavailableAttendees": []
                            }
                        ],
                        "subject": "Meeting with Dorian and Connor",
                        "durationInMinutes": 60,
                        "allAvailable": true,
                        "agenda": "Found 1 optimal time slots."
                    }
                }
            },
            "$$type": "scxml",
            "type": "external"
        },
        "_sessionid": "x:1",
        "event": {
            "type": "CONTINUE",
            "payload": {
                "stateId": "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152",
                "getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152": {
                    "times": [
                        {
                            "start": "2025-08-04T16:30:00.000Z",
                            "end": "2025-08-04T17:30:00.000Z",
                            "availableAttendees": [
                                "dsmiley@codestrap.me",
                                "connor.deeks@codestrap.me"
                            ],
                            "unavailableAttendees": []
                        }
                    ],
                    "subject": "Meeting with Dorian and Connor",
                    "durationInMinutes": 60,
                    "allAvailable": true,
                    "agenda": "Found 1 optimal time slots."
                }
            }
        },
        "historyValue": {
            "current": "scheduleMeeting|7f8824d7-bb8e-4bb3-a820-5ab9e7dc6533",
            "states": {}
        },
        "children": {},
        "done": false,
        "changed": true,
        "tags": []
    },
    "children": {},
    "done": true,
    "tags": []
}`,
  machine: `
        [
            {
                "id": "sendEmail",
                "transitions": [
                    {
                        "on": "CONTINUE",
                        "target": "sendSlackMessage"
                    },
                    {
                        "on": "pause",
                        "target": "pause"
                    },
                    {
                        "on": "ERROR",
                        "target": "failure"
                    }
                ]
            },
            {
                "id": "sendSlackMessage",
                "transitions": [
                    {
                        "on": "CONTINUE",
                        "target": "getAvailableMeetingTimes"
                    },
                    {
                        "on": "ERROR",
                        "target": "failure"
                    }
                ]
            },
            {
                "id": "getAvailableMeetingTimes",
                "transitions": [
                    {
                        "on": "CONTINUE",
                        "target": "scheduleMeeting"
                    },
                    {
                        "on": "ERROR",
                        "target": "failure"
                    }
                ]
            },
            {
                "id": "scheduleMeeting",
                "transitions": [
                    {
                        "on": "CONTINUE",
                        "target": "sendEmail"
                    },
                    {
                        "on": "ERROR",
                        "target": "failure"
                    }
                ]
            },
            {
                "id": "sendEmail",
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
        ]
        `,
};

export const mockModifyFetchResponse = {
  validation: {
    result: 'VALID',
    submissionCriteria: [],
    parameters: {},
  },
  edits: {
    type: 'edits',
    edits: [
      {
        type: 'modifyObject',
        primaryKey: '310e5c75-9ccf-4b01-8d0b-f4bf9bf6667e',
        objectType: 'MachineExecutions',
      },
    ],
    addedObjectCount: 0,
    modifiedObjectsCount: 1,
    deletedObjectsCount: 0,
    addedLinksCount: 0,
    deletedLinksCount: 0,
  },
};

export const mockModifyApiResponse = (): Response =>
  ({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {},
    json: () => Promise.resolve(mockModifyFetchResponse),
  }) as Response;

export const text2ActionTestMachineExecution = {
  machine: `
        [
            {
                "id": "sendEmail|1",
                "transitions": [
                    {
                        "on": "CONTINUE",
                        "target": "sendEmail|5"
                    },
                    {
                        "on": "pause",
                        "target": "pause"
                    },
                    {
                        "on": "ERROR",
                        "target": "failure"
                    }
                ]
            },
            {
                "id": "sendEmail|5",
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
        ]
        `,
  state: `{"actions":[{"type":"entry"}],"activities":{},"meta":{},"events":[],"value":"sendEmail|1","context":{"status":0,"requestId":"test","stack":["sendEmail|1"], "sendEmail|1": {"message": "test", "subject": "test subject", "recipients": ["test@example.com"],"modelDialog": "sample dialog", "ts": "1234567890"}},"_event":{"name":"xstate.init","data":{"type":"xstate.init"},"$$type":"scxml","type":"external"},"_sessionid":"x:1","event":{"type":"xstate.init"},"children":{},"done":false,"tags":[]}`,
};

export const mockProcessEmailEventExecution = {
  id: 'f41b004c-c032-4f3a-b7b8-be831804cb03',
  currentState: 'pause',
  logs: '',
  state: `
    {
    "actions": [],
    "activities": {},
    "meta": {},
    "events": [],
    "value": "pause",
    "context": {
        "requestId": "5eea54ea-0f14-4afa-9f89-7b2913fa8e54",
        "status": 0,
        "childToParentStateMap": {},
        "machineExecutionId": "f41b004c-c032-4f3a-b7b8-be831804cb03",
        "solution": "Get available times for meeting attendees - Attendees: Dorian Smiley <dsmiley@codestrap.me>, Connor Deeks <connor.deeks@codestrap.me> nProposed date: 2025-07-18 nStart Time: 2:00 PM nEnd Time: 3:00 PM nIf all attendees are not available, resolve unavailable attendees nSchedule a meeting - Subject: Meeting with Dorian Smiley and Connor Deeks. - Attendees: Dorian Smiley <dsmiley@codestrap.me>, Connor Deeks <connor.deeks@codestrap.me> nStart Time: 2:00 PM nEnd Time: 3:00 PM nRead Emails - Read emails for Dorian Smiley <dsmiley@codestrap.me> from the last 15 minutes",
        "stack": [
            "getAvailableMeetingTimes|cdd45abd-d759-4b8f-9341-a8852d8dde67",
            "resolveUnavailableAttendees|ee6a31dc-48d2-4cd9-9481-fafc8b2635c1"
        ],
        "stateId": "resolveUnavailableAttendees|ee6a31dc-48d2-4cd9-9481-fafc8b2635c1",
        "getAvailableMeetingTimes|cdd45abd-d759-4b8f-9341-a8852d8dde67": {
            "times": [
                {
                    "start": "Fri Jul 18 2025 14:00:00 GMT-0700 (Pacific Daylight Time)",
                    "end": "Fri Jul 18 2025 14:00:00 GMT-0700 (Pacific Daylight Time)",
                    "availableAttendees": [],
                    "unavailableAttendees": [
                        "dsmiley@codestrap.me",
                        "connor.deeks@codestrap.me"
                    ]
                }
            ],
            "subject": "Meeting with Dorian Smiley and Connor Deeks.",
            "durationInMinutes": 60,
            "allAvailable": false
        },
        "resolveUnavailableAttendees|ee6a31dc-48d2-4cd9-9481-fafc8b2635c1": {
            "emailId": "1981ab81fe57c933",
            "message": "Hey Dorian and Connor  nHappy Thursday! I'm Vickie, Code's AI EA. I'm having trouble scheduling a meeting for you both on July 18, 2025, between 2:00 PM and 3:00 PM. It looks like neither of you are available at that time.  nCould you please let me know if there's any chance you could move things around to make that time work? Knowing whether that slot is flexible would really help in finding a suitable time.  nThanks!  nBest nVickie",
            "meetingSubject": "Meeting with Dorian Smiley and Connor Deeks.",
            "meetingDuration": 60,
            "dayTimes": "                  start: Fri Jul 18 2025 14:00:00 GMT-0700 (Pacific Daylight Time),         end: Fri Jul 18 2025 14:00:00 GMT-0700 (Pacific Daylight Time),         available: ,         unavailable: dsmiley@codestrap.me, connor.deeks@codestrap.me         ",
            "modelDialog": "Hey Dorian and Connor  nHappy Thursday! I'm Vickie, Code's AI EA. I'm having trouble scheduling a meeting for you both on July 18, 2025, between 2:00 PM and 3:00 PM. It looks like neither of you are available at that time.  nCould you please let me know if there's any chance you could move things around to make that time work? Knowing whether that slot is flexible would really help in finding a suitable time.  nThanks!  nBest nVickie",
            "ts": 1752794931444
        }
    },
    "_event": {
        "name": "pause",
        "data": {
            "type": "pause",
            "payload": {
                "stateId": "resolveUnavailableAttendees|ee6a31dc-48d2-4cd9-9481-fafc8b2635c1",
                "resolveUnavailableAttendees|ee6a31dc-48d2-4cd9-9481-fafc8b2635c1": {
                    "emailId": "1981ab81fe57c933",
                    "message": "Hey Dorian and Connor  nHappy Thursday! I'm Vickie, Code's AI EA. I'm having trouble scheduling a meeting for you both on July 18, 2025, between 2:00 PM and 3:00 PM. It looks like neither of you are available at that time.  nCould you please let me know if there's any chance you could move things around to make that time work? Knowing whether that slot is flexible would really help in finding a suitable time.  nThanks!  nBest nVickie",
                    "meetingSubject": "Meeting with Dorian Smiley and Connor Deeks.",
                    "meetingDuration": 60,
                    "dayTimes": "                  start: Fri Jul 18 2025 14:00:00 GMT-0700 (Pacific Daylight Time),         end: Fri Jul 18 2025 14:00:00 GMT-0700 (Pacific Daylight Time),         available: ,         unavailable: dsmiley@codestrap.me, connor.deeks@codestrap.me         ",
                    "modelDialog": "Hey Dorian and Connor  nHappy Thursday! I'm Vickie, Code's AI EA. I'm having trouble scheduling a meeting for you both on July 18, 2025, between 2:00 PM and 3:00 PM. It looks like neither of you are available at that time.  nCould you please let me know if there's any chance you could move things around to make that time work? Knowing whether that slot is flexible would really help in finding a suitable time.  nThanks!  nBest nVickie",
                    "ts": 1752794931444
                }
            }
        },
        "$$type": "scxml",
        "type": "external"
    },
    "_sessionid": "x:7",
    "event": {
        "type": "pause",
        "payload": {
            "stateId": "resolveUnavailableAttendees|ee6a31dc-48d2-4cd9-9481-fafc8b2635c1",
            "resolveUnavailableAttendees|ee6a31dc-48d2-4cd9-9481-fafc8b2635c1": {
                "emailId": "1981ab81fe57c933",
                "message": "Hey Dorian and Connor  nHappy Thursday! I'm Vickie, Code's AI EA. I'm having trouble scheduling a meeting for you both on July 18, 2025, between 2:00 PM and 3:00 PM. It looks like neither of you are available at that time.  nCould you please let me know if there's any chance you could move things around to make that time work? Knowing whether that slot is flexible would really help in finding a suitable time.  nThanks!  nBest nVickie",
                "meetingSubject": "Meeting with Dorian Smiley and Connor Deeks.",
                "meetingDuration": 60,
                "dayTimes": "                  start: Fri Jul 18 2025 14:00:00 GMT-0700 (Pacific Daylight Time),         end: Fri Jul 18 2025 14:00:00 GMT-0700 (Pacific Daylight Time),         available: ,         unavailable: dsmiley@codestrap.me, connor.deeks@codestrap.me         ",
                "modelDialog": "Hey Dorian and Connor  nHappy Thursday! I'm Vickie, Code's AI EA. I'm having trouble scheduling a meeting for you both on July 18, 2025, between 2:00 PM and 3:00 PM. It looks like neither of you are available at that time.  nCould you please let me know if there's any chance you could move things around to make that time work? Knowing whether that slot is flexible would really help in finding a suitable time.  nThanks!  nBest nVickie",
                "ts": 1752794931444
            }
        }
    },
    "historyValue": {
        "current": "pause",
        "states": {}
    },
    "history": {
        "actions": [
            {
                "type": "entry"
            }
        ],
        "activities": {},
        "meta": {},
        "events": [],
        "value": "resolveUnavailableAttendees|ee6a31dc-48d2-4cd9-9481-fafc8b2635c1",
        "context": {
            "requestId": "5eea54ea-0f14-4afa-9f89-7b2913fa8e54",
            "status": 0,
            "childToParentStateMap": {},
            "machineExecutionId": "f41b004c-c032-4f3a-b7b8-be831804cb03",
            "solution": "Get available times for meeting attendees - Attendees: Dorian Smiley <dsmiley@codestrap.me>, Connor Deeks <connor.deeks@codestrap.me> nProposed date: 2025-07-18 nStart Time: 2:00 PM nEnd Time: 3:00 PM nIf all attendees are not available, resolve unavailable attendees nSchedule a meeting - Subject: Meeting with Dorian Smiley and Connor Deeks. - Attendees: Dorian Smiley <dsmiley@codestrap.me>, Connor Deeks <connor.deeks@codestrap.me> nStart Time: 2:00 PM nEnd Time: 3:00 PM nRead Emails - Read emails for Dorian Smiley <dsmiley@codestrap.me> from the last 15 minutes",
            "stack": [
                "getAvailableMeetingTimes|cdd45abd-d759-4b8f-9341-a8852d8dde67",
                "resolveUnavailableAttendees|ee6a31dc-48d2-4cd9-9481-fafc8b2635c1"
            ],
            "stateId": "getAvailableMeetingTimes|cdd45abd-d759-4b8f-9341-a8852d8dde67",
            "getAvailableMeetingTimes|cdd45abd-d759-4b8f-9341-a8852d8dde67": {
                "times": [
                    {
                        "start": "Fri Jul 18 2025 14:00:00 GMT-0700 (Pacific Daylight Time)",
                        "end": "Fri Jul 18 2025 14:00:00 GMT-0700 (Pacific Daylight Time)",
                        "availableAttendees": [],
                        "unavailableAttendees": [
                            "dsmiley@codestrap.me",
                            "connor.deeks@codestrap.me"
                        ]
                    }
                ],
                "subject": "Meeting with Dorian Smiley and Connor Deeks.",
                "durationInMinutes": 60,
                "allAvailable": false
            }
        },
        "_event": {
            "name": "CONTINUE",
            "data": {
                "type": "CONTINUE",
                "payload": {
                    "stateId": "getAvailableMeetingTimes|cdd45abd-d759-4b8f-9341-a8852d8dde67",
                    "getAvailableMeetingTimes|cdd45abd-d759-4b8f-9341-a8852d8dde67": {
                        "times": [
                            {
                                "start": "Fri Jul 18 2025 14:00:00 GMT-0700 (Pacific Daylight Time)",
                                "end": "Fri Jul 18 2025 14:00:00 GMT-0700 (Pacific Daylight Time)",
                                "availableAttendees": [],
                                "unavailableAttendees": [
                                    "dsmiley@codestrap.me",
                                    "connor.deeks@codestrap.me"
                                ]
                            }
                        ],
                        "subject": "Meeting with Dorian Smiley and Connor Deeks.",
                        "durationInMinutes": 60,
                        "allAvailable": false
                    }
                }
            },
            "$$type": "scxml",
            "type": "external"
        },
        "_sessionid": "x:7",
        "event": {
            "type": "CONTINUE",
            "payload": {
                "stateId": "getAvailableMeetingTimes|cdd45abd-d759-4b8f-9341-a8852d8dde67",
                "getAvailableMeetingTimes|cdd45abd-d759-4b8f-9341-a8852d8dde67": {
                    "times": [
                        {
                            "start": "Fri Jul 18 2025 14:00:00 GMT-0700 (Pacific Daylight Time)",
                            "end": "Fri Jul 18 2025 14:00:00 GMT-0700 (Pacific Daylight Time)",
                            "availableAttendees": [],
                            "unavailableAttendees": [
                                "dsmiley@codestrap.me",
                                "connor.deeks@codestrap.me"
                            ]
                        }
                    ],
                    "subject": "Meeting with Dorian Smiley and Connor Deeks.",
                    "durationInMinutes": 60,
                    "allAvailable": false
                }
            }
        },
        "historyValue": {
            "current": "resolveUnavailableAttendees|ee6a31dc-48d2-4cd9-9481-fafc8b2635c1",
            "states": {}
        },
        "children": {},
        "done": false,
        "changed": true,
        "tags": []
    },
    "children": {},
    "done": true,
    "changed": true,
    "tags": []
}
    `,
  machine: `
    [
    {
        "id": "getAvailableMeetingTimes|cdd45abd-d759-4b8f-9341-a8852d8dde67",
        "task": "Get available times for meeting attendees - Attendees: Dorian Smiley <dsmiley@codestrap.me>, Connor Deeks <connor.deeks@codestrap.me> nProposed date: 2025-07-18 nStart Time: 2:00 PM nEnd Time: 3:00 PM",
        "includesLogic": true,
        "transitions": [
            {
                "on": "CONTINUE",
                "target": "scheduleMeeting|ddb8ee4f-72a2-4198-8547-06816fa0de77"
            },
            {
                "on": "CONTINUE",
                "target": "resolveUnavailableAttendees|ee6a31dc-48d2-4cd9-9481-fafc8b2635c1"
            },
            {
                "on": "ERROR",
                "target": "failure"
            }
        ]
    },
    {
        "id": "resolveUnavailableAttendees|ee6a31dc-48d2-4cd9-9481-fafc8b2635c1",
        "task": "Resolve meeting conflicts for meeting attendees - Attendees: Dorian Smiley <dsmiley@codestrap.me>, Connor Deeks <connor.deeks@codestrap.me> nProposed date: 2025-07-18 nStart Time: 2:00 PM nEnd Time: 3:00 PM. If an agreed upon time has been reached target the find available times state. Do not continue or target schedule meeting!",
        "includesLogic": true,
        "transitions": [
            {
                "on": "CONTINUE",
                "target": "scheduleMeeting|ddb8ee4f-72a2-4198-8547-06816fa0de77"
            },
            {
                "on": "CONTINUE",
                "target": "getAvailableMeetingTimes|cdd45abd-d759-4b8f-9341-a8852d8dde67"
            },
            {
                "on": "ERROR",
                "target": "failure"
            }
        ]
    },
    {
        "id": "scheduleMeeting|ddb8ee4f-72a2-4198-8547-06816fa0de77",
        "task": "Schedule a meeting - Subject: Meeting with Dorian Smiley and Connor Deeks. - Attendees: Dorian Smiley <dsmiley@codestrap.me>, Connor Deeks <connor.deeks@codestrap.me> nStart Time: 2:00 PM nEnd Time: 3:00 PM",
        "includesLogic": false,
        "transitions": [
            {
                "on": "CONTINUE",
                "target": "readEmails|d0b61e3d-9603-429d-9e3b-f1b614b19c0e"
            },
            {
                "on": "ERROR",
                "target": "failure"
            }
        ]
    },
    {
        "id": "readEmails|d0b61e3d-9603-429d-9e3b-f1b614b19c0e",
        "task": "Read Emails - Read emails for Dorian Smiley <dsmiley@codestrap.me> from the last 15 minutes",
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
]
    `,
};
