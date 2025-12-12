import {
    Context,
    MachineEvent,
    Task,
    ActionType,
} from '@codestrap/developer-foundations-types';
import {
    readEmails,
    writeEmail,
    researchReport,
    resolveUnavailableAttendees,
    resolveMeetingConflicts,
    createTask,
    getAvailableMeetingTimes,
    getProjectFiles,
    getProjectStatusReport,
    scheduleMeeting,
    summarizeCalendars,
    sendEmail,
    readWebPage,
    sendSlackMessage,
    writeSlackMessage,
    generateSlides,
} from '../../../functions';


function getPayload(context: Context, result: Record<string, any>) {
    const stateId = context.stack?.[context.stack?.length - 1]
    if (!stateId) {
        throw new Error('Unable to find associated state in the machine stack.')
    }
    const payload = {
        stateId,
        [stateId]: {
            // we destructure to preserve other keys like result which holds values from user interaction
            ...context[stateId],
            ...result
        }
    };

    return payload;
}
export function getFunctionCatalog(dispatch: (action: ActionType) => void) {
    return new Map<string, Task>([
        [
            "generateSlides",
            {
                description:
                    "Use this tool to generate slides based on the user's instructions",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    console.log('generateSlides implementation in function catalog called');
                    const result = await generateSlides(context, event, task);
                    const payload = getPayload(context, result);
                    console.log(`generateSlides returned: ${JSON.stringify(result)}`);
                    console.log('dispatching CONTINUE from generateSlides');

                    dispatch({
                        type: 'CONTINUE',
                        payload,
                    });
                },
            },
        ],
        [
            "summarizeCalendars",
            {
                description:
                    "Use this tool to summarize the upcoming calendar events for the specified email addresses",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    console.log('summarizeCalendars implementation in function catalog called');
                    const result = await summarizeCalendars(context, event, task);
                    const payload = getPayload(context, result);
                    console.log(`summarizeCalendars returned: ${JSON.stringify(result)}`);
                    console.log('dispatching CONTINUE from summarizeCalendars');

                    dispatch({
                        type: 'CONTINUE',
                        payload,
                    });
                },
            },
        ],
        [
            "readWebPage",
            {
                description:
                    "Use this tool to for requests to read the contents of a web page or other artifact as a web URL",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    console.log('readWebPage implementation in function catalog called');
                    const result = await readWebPage(context, event, task);
                    const payload = getPayload(context, result);
                    console.log(`readWebPage returned: ${JSON.stringify(result)}`);
                    console.log('dispatching CONTINUE from readWebPage');

                    dispatch({
                        type: 'CONTINUE',
                        payload,
                    });
                },
            },
        ],
        [
            "readEmails",
            {
                description:
                    "Retrieves the users email messages for a given time period.",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    console.log('readEmails implementation in function catalog called');
                    const result = await readEmails(context, event, task);
                    const payload = getPayload(context, result);
                    console.log(`readEmails returned: ${JSON.stringify(result)}`);
                    console.log('dispatching CONTINUE from readEmails');

                    dispatch({
                        type: 'CONTINUE',
                        payload,
                    });
                },
            },
        ],
        [
            "researchReport",
            {
                description:
                    "Creates a research report based on the users instructions.",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    console.log('researchReport implementation in function catalog called');
                    const result = await researchReport(context, event, task);
                    const payload = getPayload(context, result);
                    console.log(`researchReport returned: ${JSON.stringify(result)}`);
                    console.log('dispatching CONTINUE from researchReport');

                    dispatch({
                        type: 'CONTINUE',
                        payload,
                    });
                },
            },
        ],
        [
            "createTask",
            {
                description:
                    "Creates task assigments in our ticketing system. This tool should never be used for follow up communication such as reminder messages, emails, project reports etc. This tool is used to assign a bug report, feature, research task, chore, etc.",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    console.log('createTask implementation in function catalog called');
                    const result = await createTask(context, event, task);
                    const payload = getPayload(context, result);
                    console.log(`createTask returned: ${JSON.stringify(result)}`);
                    /**
                    * to perform and AI transition use the following
                    import { engineV1 as engine } from "../../";
                    import { SupportedEngines, xReasonFactory } from "../../factory";
                    
                    const { aiTransition } = xReasonFactory(SupportedEngines.COMS)({});
                    const nextState = await engine.logic.transition(
                        context.solution!,
                        payload.stateId,
                        JSON.stringify({ ...context, ...payload }),
                        aiTransition
                    )
                    
                    dispatch({
                        type: nextState,
                        payload,
                    });
                     */
                    dispatch({
                        type: 'CONTINUE',
                        payload,
                    });
                },
            },
        ],
        [
            "getAvailableMeetingTimes",
            {
                description:
                    "Gets the available times for all required and optional meeting attendees",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    console.log('getAvailableMeetingTimes implementation in function catalog called');
                    const result = await getAvailableMeetingTimes(context, event, task);
                    const payload = getPayload(context, result);
                    console.log(`getAvailableMeetingTimes returned: ${JSON.stringify(result)}`);

                    dispatch({
                        type: 'CONTINUE',
                        payload,
                    });
                },
                // this is an example of how to perform a determinstic gaurd on a tranistion
                // if it returns false the next state in the machine's trasnistions array is evaulauted
                transitions: new Map<string, (context: Context, event: MachineEvent) => boolean>([
                    [
                        // if everyone is available schedule
                        "CONTINUE|resolveUnavailableAttendees",
                        (context: Context, event: MachineEvent) => {
                            console.log(`evaluating pause transition logic for state: ${event.payload?.stateId}`);
                            if (event.payload && event.payload?.stateId) {
                                // if all are available return false and move to schedule meeting
                                return !(event.payload[event.payload.stateId].allAvailable as boolean);
                            }
                            return true;
                        }
                    ]
                ]),
            },
        ],
        [
            "resolveUnavailableAttendees",
            {
                description:
                    "Resolves unavailable attendees for meeting requests where not all attendees are available.",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    console.log('resolveUnavailableAttendees implementation in function catalog called');
                    const result = await resolveUnavailableAttendees(context, event, task);
                    const payload = getPayload(context, result);
                    console.log(`resolveUnavailableAttendees returned: ${JSON.stringify(result)}`);
                    console.log('dispatching CONTINUE from resolveUnavailableAttendees');
                    // this will pause the state machine execution
                    dispatch({
                        type: 'pause',
                        payload,
                    });
                },
            },
        ],
        [
            "resolveMeetingConflicts",
            {
                // TODO: @kopach - all examples of communication
                description: `Use this tool to identify meeting conflicts for specified users and resolve them.`,
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    const result = await resolveMeetingConflicts(context, event, task);
                    const payload = getPayload(context, result);

                    dispatch({
                        type: 'CONTINUE',
                        payload,
                    });
                },
            },
        ],
        [
            "scheduleMeeting",
            {
                description:
                    "Schudules a meeting using the provided time at which all attendees are available.",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    console.log('scheduleMeeting function catalog implementation called');
                    const result = await scheduleMeeting(context, event, task);

                    const payload = getPayload(context, result);
                    dispatch({
                        type: 'CONTINUE',
                        payload,
                    });
                },
            },
        ],
        [
            "getProjectFiles",
            {
                description:
                    "Retrieves project files.",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    console.log('getProjectFiles function catalog implementation called');
                    const result = await getProjectFiles(context, event, task);
                    const payload = getPayload(context, result);
                    // This will continue to the next state
                    dispatch({
                        type: 'CONTINUE',
                        payload,
                    });
                },
            },
        ],
        [
            "getProjectStatusReport",
            {
                description:
                    "Retrieves a cull project status report including estimated completion date, task lists, and timeline.",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    console.log('getProjectStatusReport function catalog implementation called');
                    const result = await getProjectStatusReport(context, event, task);
                    const payload = getPayload(context, result);
                    // This will continue to the next state
                    dispatch({
                        type: 'CONTINUE',
                        payload,
                    });
                },
            },
        ],
        [
            "sendEmail",
            {
                description:
                    "Sends an email.",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    console.log('sendEmail function catalog implementation called');
                    const result = await sendEmail(context, event, task);
                    const payload = getPayload(context, result);

                    dispatch({
                        type: 'CONTINUE',
                        payload,
                    });
                },
            },
        ],
        [
            "writeEmail",
            {
                description:
                    "Writes a draft email for review.",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    console.log('writeEmail function catalog implementation called');
                    const result = await writeEmail(context, event, task);
                    const payload = getPayload(context, result);
                    // Change the type to pause to allow the user to review the email in the UI before send
                    dispatch({
                        type: 'CONTINUE',
                        payload,
                    });
                },
            },
        ],
        [
            "writeSlackMessage",
            {
                description:
                    "Writes a draft slack message for review.",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    console.log('writeSlackMessage function catalog implementation called');
                    const result = await writeSlackMessage(context, event, task);
                    const payload = getPayload(context, result);
                    // Change the type to pause to allow the user to review the email in the UI before send
                    dispatch({
                        type: 'CONTINUE',
                        payload,
                    });
                },
            },
        ],
        [
            "sendSlackMessage",
            {
                description:
                    "Sends a Slack Message",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    console.log('sendSlackMessage function catalog implementation called');
                    const result = await sendSlackMessage(context, event, task);
                    const payload = getPayload(context, result);
                    dispatch({
                        type: 'CONTINUE',
                        payload,
                    });
                },
            },
        ],
        [
            "UnsafeQuestion",
            {
                description:
                    "Default state to display for unsafe questions",
                implementation: (context: Context, event?: MachineEvent, task?: string) => {
                    console.log('UnsafeQuestion implementation called');
                    dispatch({ type: 'success' });
                },
            },
        ],
        [
            "UnsupportedQuestion",
            {
                description:
                    "Default state to display for unsupported questions",
                implementation: (context: Context, event?: MachineEvent, task?: string) => {
                    console.log('UnsupportedQuestion implementation called');
                    dispatch({ type: 'success' });
                },
            },
        ]
    ]);
}