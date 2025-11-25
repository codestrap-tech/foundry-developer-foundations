/* eslint-disable prefer-const */
// Vickie.tsx
"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { useConversation } from "@elevenlabs/react";
import { callAskVickie } from "../../services/vickie.service";
import { uuidv4 } from "@codestrap/developer-foundations-utils";
import { callGetCommunications, callGetMachines } from "../../services/executions.service";
import { PlayCircle, Square, Mic, MicOff } from "lucide-react";
import { createUserResource } from "./UserResource";
import { createTokenResource } from "./TokenResource";
import { getFoundryClient } from "./foundryClientPublic";

const { client, getUser, getToken } = getFoundryClient();
const userResource = createUserResource(getUser);
const tokenResource = createTokenResource(getToken);


type GetNextStateResult = {
    value: string;
    theResultOfEachTask: {
        taskName: string;
        taskOutput: string;
    }[];
    orderTheTasksWereExecutedIn: string[];
};

function VickieInner() {

    const [messages, setMessages] = useState<string>('');
    const [taskList, setTaskList] = useState<string>('');
    const [value, setValue] = useState<string>('');
    const [getTaskListToolExecuted, setGetTaskListToolExecuted] = useState<boolean>(false);
    const [getTaskListToolAttempts, setGetTaskListAttempts] = useState<number>(0);
    const [executeTaskListToolExecuted, setExecuteTaskListToolExecuted] = useState<boolean>(false);
    const [executeTaskListToolAttempts, setExecuteTaskListAttempts] = useState<number>(0);
    const [micMuted, setMicMuted] = useState(false);

    const executionIdRef = useRef<string | undefined>(undefined);
    const taskListRef = useRef<string | undefined>(undefined);
    const scrollRef = useRef<HTMLDivElement>(null);

    const user = userResource.read();
    const token = tokenResource.read();


    useEffect(() => {
        const el = scrollRef.current;
        if (el) {
            el.scrollTop = el.scrollHeight;
        }
    }, [messages]);

    const conversation = useConversation({
        micMuted,
        dynamicVariables: {
            localDay: new Date().getDay(),
            locatDateTime: new Date().toString(),
            userId: user?.id || 'undefined',
            userName: user?.givenName || 'undefined',
            threadId: '',
        },
        clientTools: {
            getTaskListTool: async (parameters: { query: string, userId: string, threadId?: string }) => {
                console.log(`local getTaskListTool called with: ${JSON.stringify(parameters)}`);
                setGetTaskListToolExecuted(true);
                setGetTaskListAttempts(0);
                let { query, userId, threadId } = { ...parameters };

                if (!threadId) {
                    threadId = uuidv4();
                }

                if (!query || !userId) {
                    return `Both query and userId are required to call the getTaskListTool tool. You supplied query: ${query} asn userId :${userId}. Please try again passing the required parameters.`;
                }

                // fire and forget to avoid timeouts
                callAskVickie({
                    user,
                    token,
                    action: 'getTaskList',
                    query,
                    threadId,
                }) as unknown as { threadId: string };


                console.log(`Got threadId: ${threadId} back from callAskVickie execution, starting polling`);
                triggerPolling(threadId, 'getTaskListTool');

                return `The task list is being generated in the background for executionId/threadId ${threadId}. 
                    You will receive a contextual update with the well defined defined task list when the operation is complete. 
                    Wait until you get the results before proceeding!!!`;
            },
            // TODO get the model to pass the threadId/executionID to support multiple ongoing task executions
            executeTaskList: async (parameters: { plan: string, threadId: string }) => {
                setExecuteTaskListToolExecuted(true);
                setExecuteTaskListAttempts(0);
                const { threadId } = { ...parameters };

                if (!threadId || !taskListRef.current) {
                    return `Both threadId and taskList are required to call the executeTaskList tool. Please try again passing the required parameters.`;
                }

                console.log(`local executeTaskList for execution Id ${threadId} called with: ${taskListRef.current}`);

                // fire and forget to avoid timeouts
                callAskVickie({
                    action: 'executeTaskList',
                    token,
                    user,
                    executionId: threadId,
                    plan: taskListRef.current,
                }) as unknown as GetNextStateResult;

                triggerPolling(threadId, 'executeTaskList');

                return `The execute task list tool is being executed for executionId/threadId: ${executionIdRef.current} in the background. 
                    You will receive a contextual update when the operation is complete. 
                    Once received summarize the results for the user including the order the tasks were executed in. 
                    Wait until you get the results before proceeding!!!`
            },

        },
        onConnect: () => {
            console.log("connected");
            setMessages('');
            setValue('');
        },
        onDisconnect: () => console.log("disconnected"),
        onError: (e) => {
            console.error(e);
            alert("An error occurred during the conversation");
        },
        onMessage: (message) => {
            console.log(message);
            const role = message.source === "user" ? "User" : "System";
            setMessages(prev =>
                `
${prev}
vickieMessageDelimiter-New message received on: ${new Date()} from ${role}
${message.message}`
            );
        },
    });

    const triggerPolling = useCallback((executionId: string, action: string) => {
        console.log(`triggerPolling for ${executionId}`);
        if (!executionId) {
            console.log('not executionId found, stopping polling and exit');
            return;
        };

        if (executionIdRef.current !== executionId) {
            executionIdRef.current = executionId;
        }

        let attempts = 0;
        const maxAttempts = 10;
        const interval = 10000;

        const intervalId = setInterval(async () => {
            if (attempts >= maxAttempts) {
                clearInterval(intervalId);
                console.warn('Polling timed out after max attempts.');
                conversation.sendContextualUpdate(`Polling timed out after max attempts: ${maxAttempts} for threadID/executionId: ${executionId}. This means we've polled for a result for the max possible attempts but no result was returned. The execution has failed.`);
                return conversation.sendUserMessage(`My job failed for threadID/executionId: ${executionId}. Please let me know why.`)
            }

            try {
                switch (action) {
                    case 'getTaskListTool':
                        // eslint-disable-next-line no-case-declarations
                        const result = await callGetCommunications(executionId, token);
                        if (result?.taskList) {
                            setTaskList(result.taskList);
                            taskListRef.current = result.taskList;
                            conversation.sendContextualUpdate(
                                `The results for thread/executionId: ${executionId} have returned the following:
                                ${result.taskList}`
                            );
                            conversation.sendUserMessage(`Please summarize the results of the get task list tool for thread/executionId: ${executionId} and get my approval before calling the execute task list tool.`);
                            clearInterval(intervalId);
                            setGetTaskListToolExecuted(false);
                            setGetTaskListAttempts(0);
                        }
                        break;
                    case 'executeTaskList':
                        // eslint-disable-next-line no-case-declarations
                        const machine = await callGetMachines(executionId, token);
                        if (machine?.state) {
                             
                            const state = JSON.parse(machine.state) as any;
                            const currentState = state.value;
                             
                            const context = state.context as any
                            const results = Object.keys(context)
                                .filter(key => key.indexOf('|') >= 0)
                                .map(key => {
                                    const taskName = key.split('|')[0];
                                    const taskOutput = context[key];

                                    return { taskName, taskOutput };
                                });

                             
                            const stack = (context.stack as any[])?.map(state => state.split('|')[0]);

                            // TODO add the current state
                            conversation.sendContextualUpdate(
                                `The results of the task list execution tool for thread/executionId ${executionId} are:
                                Results:
                                ${JSON.stringify({ orderTheTasksWereExecutedIn: stack!, theResultOfEachTask: results, value: currentState }, null, 2)}
                                `
                            );
                            conversation.sendUserMessage(`Please summarize the results of the execute task list tool for thread/executionId: ${executionId}.`);
                            clearInterval(intervalId);
                            setExecuteTaskListToolExecuted(false);
                            setExecuteTaskListAttempts(0);
                        }
                        break;
                }
            } catch (err) {
                console.error("Polling error:", err);
            } finally {
                attempts++;
                if (action === 'getTaskListTool') {
                    setGetTaskListAttempts(attempts);
                } else if (action === 'executeTaskList') {
                    setExecuteTaskListAttempts(attempts);
                }
            }
        }, interval);
    }, [conversation]);

    const requestMicrophonePermission = async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            return true;
        } catch {
            console.error("Microphone permission denied");
            return false;
        }
    };

    const startConversation = useCallback(async () => {
        if (!(await requestMicrophonePermission())) {
            alert("No permission");
            return;
        }
        setMessages('');
        executionIdRef.current = undefined;
        taskListRef.current = undefined;
        setTaskList('');
        const id = await conversation.startSession({ agentId: "UcIOy8NOGWaLn9nR3UCQ" });
        console.log(id);
    }, [conversation]);

    const stopConversation = useCallback(async () => {
        await conversation.endSession();
    }, [conversation]);

    const renderedMessages = useMemo(() => {
        return messages
            .split("vickieMessageDelimiter-")
            .filter(line => line.trim() !== "" && line.includes("New message received on:"))
            .map((line, idx) => {
                const parts = line.split('\n');
                const isSystem = parts[0]?.includes("System");

                return (
                    <div
                        key={idx}
                        className={`${isSystem ? "self-start" : "self-end"} max-w-[80%] bg-white shadow-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-800`}
                    >
                        <span className="text-gray-500 italic">{parts[0]}</span>
                        <br />
                        <span>{parts.slice(1).join('\n')}</span>
                    </div>
                );
            });
    }, [messages]);

    const orbClasses =
        conversation.status === "connected"
            ? conversation.isSpeaking
                ? "orb orb-active animate-orb"
                : "orb animate-orb-slow orb-inactive"
            : "orb orb-inactive";

    return (
        <div className="flex justify-center items-center gap-4 items-stretch">
            <Card className="rounded-3xl">
                <div className="p-6 text-center">
                    <h5 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {conversation.status === "connected"
                            ? conversation.isSpeaking
                                ? "Agent is speaking"
                                : "Agent is listening"
                            : "Disconnected"}
                    </h5>

                    {/* BUTTON STACK */}
                    <div className="flex flex-col gap-4 mt-6 w-full max-w-xs">
                        <div className={orbClasses + " my-16 mx-auto"} />

                        {/* ─── Start conversation ─── */}
                        <Button
                            onClick={startConversation}
                            disabled={conversation.status === "connected"}
                            className="
      w-full flex items-center justify-start gap-2
      bg-green-600 hover:bg-green-700
      disabled:bg-green-300 disabled:hover:bg-green-300 disabled:cursor-not-allowed
      text-white
    "
                        >
                            <PlayCircle className="h-5 w-5" />
                            Start conversation
                        </Button>

                        {/* ─── End conversation ─── */}
                        <Button
                            onClick={stopConversation}
                            disabled={conversation.status !== "connected"}
                            className="
      w-full flex items-center justify-start gap-2
      bg-red-600 hover:bg-red-700
      disabled:bg-red-300 disabled:hover:bg-red-300 disabled:cursor-not-allowed
      text-white
    "
                        >
                            <Square className="h-5 w-5" />
                            End conversation
                        </Button>

                        {/* ─── Mute / Un-mute mic ─── */}
                        <Button
                            onClick={() => setMicMuted(!micMuted)}
                            disabled={conversation.status !== "connected"}
                            className="
      w-full flex items-center justify-start gap-2
      bg-blue-600 hover:bg-blue-700
      disabled:bg-blue-300 disabled:hover:bg-blue-300 disabled:cursor-not-allowed
      text-white
    "
                        >
                            {micMuted ? (
                                <MicOff className="h-5 w-5" />
                            ) : (
                                <Mic className="h-5 w-5" />
                            )}
                            {micMuted ? "Unmute Mic" : "Mute Mic"}
                        </Button>
                    </div>

                </div>
            </Card>

            <Card className="flex flex-col justify-between p-6">
                <div className="h-full flex flex-col">
                    <div className={`mt-6 flex flex-col gap-4 ${!getTaskListToolExecuted ? "hidden" : ""}`}>
                        {/* Status Indicator */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Task Tool Executed:</span>
                            <div className={`w-3 h-3 rounded-full ${getTaskListToolExecuted ? "bg-green-500" : "bg-red-500"}`} />
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full">
                            <div className="flex justify-between mb-1 text-sm font-medium text-gray-700">
                                <span>Polling Attempts</span>
                                <span>{getTaskListToolAttempts}/10</span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 rounded-full">
                                <div
                                    className="h-2 bg-blue-600 rounded-full transition-all duration-300"
                                    style={{ width: `${(getTaskListToolAttempts / 10) * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className={`mt-6 flex flex-col gap-4 ${!executeTaskListToolExecuted ? "hidden" : ""}`}>
                        {/* Status Indicator */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Execute Tool Running:</span>
                            <div className={`w-3 h-3 rounded-full ${executeTaskListToolExecuted ? "bg-green-500" : "bg-red-500"}`} />
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full">
                            <div className="flex justify-between mb-1 text-sm font-medium text-gray-700">
                                <span>Polling Attempts</span>
                                <span>{executeTaskListToolAttempts}/10</span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 rounded-full">
                                <div
                                    className="h-2 bg-purple-600 rounded-full transition-all duration-300"
                                    style={{ width: `${(executeTaskListToolAttempts / 10) * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>


                    <div
                        ref={scrollRef}
                        className="flex flex-col gap-2 overflow-y-auto max-h-[400px] p-4 bg-gray-50 rounded-md whitespace-pre-line text-sm">
                        {renderedMessages}
                    </div>
                    <textarea
                        className="mt-4 w-full border rounded px-3 py-2 resize"
                        rows={3}
                        value={value}
                        onChange={(e) => {
                            setValue(e.target.value);
                            conversation.sendUserActivity();
                        }}
                    />
                    <button
                        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex grow-1"
                        onClick={() => {
                            conversation.sendUserMessage(value!);
                            setMessages(
                                `
                                ${messages}
                                vickieMessageDelimiter-New message received on: ${new Date()} from User
                                ${value!}`
                            );
                            setValue('');
                        }}
                    >
                        SEND
                    </button>
                </div>
            </Card>

            {taskList && (
                <Card className="flex flex-col justify-between p-6 min-w-[22rem]"> {/* give the card a height & flex layout */}
                    <label className="text-sm font-medium text-gray-700">Edit Task List</label>

                    <textarea
                        /* flex-grow makes the textarea consume every remaining pixel in the Card */
                        className="flex-grow w-full border rounded px-3 py-2 resize-y min-h-0"
                        value={taskList}
                        onChange={(e) => {
                            setTaskList(e.target.value);
                            taskListRef.current = e.target.value;
                        }}
                    />
                </Card>
            )}

        </div>
    );
}

/* ---------- 
exported component with suspense boundary
Note Turbopack barfs on modern CSS so I had to inline the contents of Vickie.css
 ---------- */
export default function Vickie() {
    return (
        <>
            <Suspense fallback={<div style={{ padding: "2rem", textAlign: "center" }}>Loading user…</div>}>
                <VickieInner />
            </Suspense>

            <style jsx global>{`
        @property --blur {
            syntax: "<length>";
            initial-value: 0;
            inherits: true;
        }

        @property --spread {
            syntax: "<length>";
            initial-value: 0;
            inherits: true;
        }

        @property --color {
            syntax: "<color>";
            initial-value: rgb(0, 255, 85);
            inherits: true;
        }

        @property --lighter-color {
            syntax: "<color>";
            initial-value: color-mix(in srgb, var(--color) 80%, white);
            inherits: true;
        }

        @property --darker-color {
            syntax: "<color>";
            initial-value: color-mix(in srgb, var(--color) 60%, rgb(2, 137, 24));
            inherits: true;
        }

        @property --angle {
            syntax: "<angle>";
            initial-value: 0deg;
            inherits: true;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        .orb {
            --size: 200px;
            --color: red;
            --lighter-color: color-mix(in srgb, var(--color) 60%, white);
            --darker-color: color-mix(in srgb, var(--color) 40%, black);
            --blur: 40px;
            --spread: 5px;
            --angle: -90deg;
            --border: 10px;

            position: relative;
            width: var(--size);
            height: var(--size);
            aspect-ratio: 1;
            background:
                radial-gradient(color-mix(in srgb, var(--darker-color) 65%, transparent) -50%, transparent 50%),
                radial-gradient(var(--color), var(--color)) no-repeat 50% 50% / 50% 50%,
                url('/circleLogo-big.svg') no-repeat 50% 50% / 35%,
                linear-gradient(#ffffff, #ffffff) padding-box,
                conic-gradient(from var(--angle) at 50% 50%, color-mix(in srgb, var(--lighter-color), transparent) 0 72deg, var(--darker-color) 100deg 180deg, transparent 288deg, color-mix(in srgb, var(--lighter-color), transparent)) border-box,
                radial-gradient(farthest-corner at 50% 50%, transparent 50%, var(--darker-color) 80% 100%) border-box;

            background-blend-mode: normal, overlay, multiply, normal, normal, normal, normal;
            border: var(--border) solid transparent;
            border-radius: 50%;
            box-shadow: 0 0 var(--blur) var(--spread) var(--darker-color);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: 10s linear infinite change-color, 5s linear infinite orb;

        }

        @keyframes change-color {
            0% {
                --color: rgb(255, 255, 255);
            }

            12% {
                --color: rgb(89, 255, 0);
            }

            24% {
                --color: yellow;
            }

            36% {
                --color: rgb(225, 255, 0);
            }

            48% {
                --color: rgb(255, 255, 0);
            }

            60% {
                --color: dodgerblue;
            }

            72% {
                --color: rgb(255, 0, 255);
            }

            84% {
                --color: rgb(0, 255, 85);
            }
        }

        @keyframes orb {
            0% {
                --angle: -90deg;
                --blur: 40px;
                --spread: 5px;
            }

            50% {
                --blur: 80px;
                --spread: 10px;
            }

            100% {
                --angle: 270deg;
            }
        }

        .orb:hover {
            animation: reset .2s linear 1 forwards;
        }

        @keyframes reset {
            to {
                --color: rgb(5, 182, 46);
                --blur: 40px;
                --spread: 5px;
                --angle: -90deg;
            }
        }
        /* Animation classes */
.animate-orb {
  animation: wave 0.4s infinite ease-in-out;
}

.animate-orb-slow {
  animation: wave 2s infinite ease-in-out;
}

/* Keyframes */
@keyframes wave {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes rotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
      `}</style>
        </>
    );
}
