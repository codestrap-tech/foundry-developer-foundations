import {
    Context,
    MachineEvent,
    Task,
    ActionType,
    UserIntent,
    LarryStream,
    TYPES,
} from '@codestrap/developer-foundations-types';

import {
    applyEdits,
    confirmUserIntent,
    searchDocumentation,
    architectImplementation,
    generateEditMachine,
    specReview,
    architectureReview,
    codeReview
} from '../../../../functions';
import { container } from '@codestrap/developer-foundations-di';


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

async function possiblePromise(result: void | Promise<void>) {
    if (result && result instanceof Promise) {
        await result;
    }
}
export function getFunctionCatalog(dispatch: (action: ActionType) => void | Promise<void>) {
    return new Map<string, Task>([
        [
            "confirmUserIntent",
            {
                description:
                    "Use this tool to confirm with the user their intentions and requests for code changes including new code to be generated",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    const larryStream = container.get<LarryStream>(TYPES.LarryStream);
                    const run = async () => {
                        try {
                            console.log('confirmUserIntent implementation in function catalog called');
                            const result = await confirmUserIntent(context, event, task);
                            const payload = getPayload(context, result);
                            console.log(`confirmUserIntent returned: ${JSON.stringify(result)}`);
                            console.log('dispatching pause from confirmUserIntent');
        
                            await possiblePromise(dispatch({
                                type: 'CONTINUE',
                                payload,
                            }));
                        } catch (error) {
                            larryStream.publish({
                                id: context.machineExecutionId!,
                                payload: {
                                    type: 'error',
                                    message: `'Error in confirmUserIntent'`,
                                    metadata: {
                                        error: error,
                                    },
                                },
                            });
                        }   
                    }

                    await run();
                },
            },
        ],
        [
            "specReview",
            {
                description:
                    "Use this tool to confirm with the user their intentions and requests for code changes including new code to be generated",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    const larryStream = container.get<LarryStream>(TYPES.LarryStream);
                    const run = async () => {
                        try {
                            const result = await specReview(context, event, task);
                            const payload = getPayload(context, result);
                            console.log(`specReview returned: ${JSON.stringify(result)}`);

                            if (result.approved) {
                                console.log('dispatching CONTINUE from specReview');
                                await possiblePromise(dispatch({
                                    type: 'CONTINUE',
                                    payload,
                                }));
                            } else if (result.reviewRequired) {
                                console.log('dispatching pause from specReview');
                                // pause so the user can review the state machine
                                await possiblePromise(dispatch({
                                    type: 'pause',
                                    payload,
                                }));
                            } else {
                                // the user has provided feedback we need to capture and rerun the confirm user intent state
                                // target the most recent confirmUserIntentId passing the latest feedback from the end user
                                const confirmUserIntentId =
                                    context.stack
                                        ?.slice()
                                        .reverse()
                                        .find((item) => item.includes('confirmUserIntent')) || '';

                                // extract the user response if any. It will be the last message where user is defined
                                const lastMessage =
                                    result.messages
                                        ?.slice()
                                        .reverse()
                                        .find((item) => item.user !== undefined);

                                const payload = {
                                    confirmUserIntentId,
                                    [confirmUserIntentId]: {
                                        // we destructure to preserve other keys like result which holds values from user interaction
                                        ...context[confirmUserIntentId],
                                        userResponse: lastMessage?.user,
                                        file: result.file,
                                    }
                                };

                                console.log(`dispatching ${confirmUserIntentId} from specReview`);

                                await possiblePromise(dispatch({
                                    type: confirmUserIntentId,
                                    payload,
                                }));
                            }
                        } catch (error) {
                            console.log('went into catch block in specReview');
                            larryStream.publish({
                                id: context.machineExecutionId!,
                                payload: {
                                    type: 'error',
                                    message: `'Error in specReview'`,
                                    metadata: {
                                        error: error,
                                    },
                                },
                            });
                        }
                    }

                    await run();
                },
            },
        ],
        [
            "searchDocumentation",
            {
                description:
                    "Use this tool to search documentation once the design specification has been clarified with the developer.",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    const larryStream = container.get<LarryStream>(TYPES.LarryStream);
                    const run = async () => {
                        try {
                            console.log('searchDocumentation implementation in function catalog called');
                            const result = await searchDocumentation(context, event, task);
                            const payload = getPayload(context, result);
                            console.log(`searchDocumentation returned: ${JSON.stringify(result)}`);
                            console.log('dispatching CONTINUE from searchDocumentation');

                            await possiblePromise(dispatch({
                                type: 'CONTINUE',
                                payload,
                            }));
                        } catch (error) {
                            larryStream.publish({
                                id: context.machineExecutionId!,
                                payload: {
                                    type: 'error',
                                    message: `'Error in searchDocumentation'`,
                                    metadata: {
                                        error: error,
                                    },
                                },
                            });
                        }
                    }

                    await run();
                },
            },
        ],
        [
            "architectImplementation",
            {
                description:
                    "Use this tool to search documentation once the design specification has been clarified with the developer.",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    const larryStream = container.get<LarryStream>(TYPES.LarryStream);
                    const run = async () => {
                        try {
                            console.log('architectImplementation implementation in function catalog called');
                            const result = await architectImplementation(context, event, task);
                            const payload = getPayload(context, result);
                            console.log(`architectImplementation returned: ${JSON.stringify(result)}`);
                            console.log('dispatching CONTINUE from architectImplementation');

                            await possiblePromise(dispatch({
                                type: 'CONTINUE',
                                payload,
                            }));
                        } catch (error) {
                            larryStream.publish({
                                id: context.machineExecutionId!,
                                payload: {
                                    type: 'error',
                                    message: `'Error in architectImplementation'`,
                                    metadata: {
                                        error: error,
                                    },
                                },
                            });
                        }
                    }

                    await run();
                },
            },
        ],
        [
            "architectureReview",
            {
                description:
                    "Use this tool to confirm with the user their intentions and requests for code changes including new code to be generated",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    const larryStream = container.get<LarryStream>(TYPES.LarryStream);
                    const run = async () => {
                        try {
                            console.log('architectureReview implementation in function catalog called');
                            const result = await architectureReview(context, event, task);
                            const payload = getPayload(context, result);
                            console.log(`architectureReview returned: ${JSON.stringify(result)}`);

                            if (result.approved) {
                                console.log('dispatching CONTINUE from architectureReview');
                                await possiblePromise(dispatch({
                                    type: 'CONTINUE',
                                    payload,
                                }));
                            } else if (result.reviewRequired) {
                                console.log('dispatching pause from architectureReview');
                                // pause so the user can review the state machine
                                await possiblePromise(dispatch({
                                    type: 'pause',
                                    payload,
                                }));
                            } else {
                                // the user has provided feedback we need to capture and rerun the confirm user intent state
                                // target the most recent confirmUserIntentId passing the latest feedback from the end user
                                const architectImplementationId =
                                    context.stack
                                        ?.slice()
                                        .reverse()
                                        .find((item) => item.includes('architectImplementation')) || '';

                                // extract the user response if any. It will be the last message where user is defined
                                const lastMessage =
                                    result.messages
                                        ?.slice()
                                        .reverse()
                                        .find((item) => item.user !== undefined);

                                const payload = {
                                    architectImplementationId,
                                    [architectImplementationId]: {
                                        // we destructure to preserve other keys like result which holds values from user interaction
                                        ...context[architectImplementationId],
                                        userResponse: lastMessage?.user,
                                        file: result.file,
                                    }
                                };

                                console.log(`dispatching ${architectImplementationId} from specReview`);

                                await possiblePromise(dispatch({
                                    type: architectImplementationId,
                                    payload,
                                }));
                            }
                        } catch (error) {
                            larryStream.publish({
                                id: context.machineExecutionId!,
                                payload: {
                                    type: 'error',
                                    message: `'Error in architectureReview'`,
                                    metadata: {
                                        error: error,
                                    },
                                },
                            });
                        }
                    }

                    await run();
                },
            },
        ],
        [
            "generateEditMachine",
            {
                description:
                    "Use this tool to execute the approved architecture plan.",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    const larryStream = container.get<LarryStream>(TYPES.LarryStream);
                    const run = async () => {
                        try {
                            console.log('generateEditMachine implementation in function catalog called');
                            const result = await generateEditMachine(context, event, task);
                            const payload = getPayload(context, result);
                            console.log(`generateEditMachine returned: ${JSON.stringify(result)}`);
                            console.log('dispatching pause from generateEditMachine');

                            await possiblePromise(dispatch({
                                type: 'CONTINUE',
                                payload,
                            }));
                        } catch (error) {
                            larryStream.publish({
                                id: context.machineExecutionId!,
                                payload: {
                                    type: 'error',
                                    message: `'Error in generateEditMachine'`,
                                    metadata: {
                                        error: error,
                                    },
                                },
                            });
                        }
                    }

                    await run();
                },
            },
        ],
        [
            "codeReview",
            {
                description:
                    "Use this tool to confirm with the user their intentions and requests for code changes including new code to be generated",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    const larryStream = container.get<LarryStream>(TYPES.LarryStream);
                    const run = async () => {
                        try {
                            console.log('codeReview implementation in function catalog called');
                            const result = await codeReview(context, event, task);
                            const payload = getPayload(context, result);
                            console.log(`codeReview returned: ${JSON.stringify(result)}`);
                            console.log('dispatching pause from codeReview');
        
                            if (result.approved) {
                                console.log('dispatching CONTINUE from codeReview');
                                await possiblePromise(dispatch({
                                    type: 'CONTINUE',
                                    payload,
                                }));
                            } else if (result.reviewRequired) {
                                console.log('dispatching pause from codeReview');
                                // pause so the user can review the state machine
                                await possiblePromise(dispatch({
                                    type: 'pause',
                                    payload,
                                }));
                            } else {
                                // the user has provided feedback we need to capture and rerun the confirm user intent state
                                // target the most recent generateEditMachine passing the latest feedback from the end user
                                const generateEditMachineId =
                                    context.stack
                                        ?.slice()
                                        .reverse()
                                        .find((item) => item.includes('generateEditMachine')) || '';
        
                                // extract the user response if any. It will be the last message where user is defined
                                const lastMessage =
                                    result.messages
                                        ?.slice()
                                        .reverse()
                                        .find((item) => item.user !== undefined);
        
                                const payload = {
                                    generateEditMachineId,
                                    [generateEditMachineId]: {
                                        // we destructure to preserve other keys like result which holds values from user interaction
                                        ...context[generateEditMachineId],
                                        userResponse: lastMessage?.user,
                                        file: result.file,
                                    }
                                };
        
                                console.log(`dispatching ${generateEditMachineId} from specReview`);
        
                                await possiblePromise(dispatch({
                                    type: generateEditMachineId,
                                    payload,
                                }));
                            }
                        } catch (error) {
                            larryStream.publish({
                                id: context.machineExecutionId!,
                                payload: {
                                    type: 'error',
                                    message: `'Error in codeReview'`,
                                    metadata: {
                                        error: error,
                                    },
                                },
                            });
                        }
                    }

                    await run();
                },
            },
        ],
        [
            "applyEdits",
            {
                description:
                    "Use this tool to execute the approved architecture plan.",
                implementation: async (context: Context, event?: MachineEvent, task?: string) => {
                    const larryStream = container.get<LarryStream>(TYPES.LarryStream);
                    const run = async () => {
                        try {
                            console.log('applyEdits implementation in function catalog called');
                            const result = await applyEdits(context, event, task);
                            const payload = getPayload(context, result);
                            console.log(`applyEdits returned: ${JSON.stringify(result)}`);
                            console.log('dispatching CONTINUE from applyEdits');

                            await possiblePromise(dispatch({
                                type: 'CONTINUE',
                                payload,
                            }));
                        } catch (error) {
                            larryStream.publish({
                                id: context.machineExecutionId!,
                                payload: {
                                    type: 'error',
                                    message: `'Error in applyEdits'`,
                                    metadata: {
                                        error: error,
                                    },
                                },
                            });
                        }
                    }
                    
                    await run();
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