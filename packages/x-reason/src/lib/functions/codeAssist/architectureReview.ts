import type {
    AbstractReviewState,
    ArchitectureReviewState,
    Context,
    MachineEvent,
    ThreadsDao,
    UserIntent} from '@codestrap/developer-foundations-types';
import {
    TYPES,
    VersionControlService,
} from '@codestrap/developer-foundations-types';
import * as path from 'path';
import * as fs from 'fs';
import { container } from '@codestrap/developer-foundations-di';
import { saveFileToGithub, writeFileIfNotFoundLocally } from './delegates/github';

export async function architectureReview(
    context: Context,
    event?: MachineEvent,
    task?: string
): Promise<ArchitectureReviewState> {
    // get the previous confirm user intent state that generated the spec we are reviewing
    const architectImplementationId =
        context.stack
            ?.slice()
            .reverse()
            .find((item) => item.includes('architectImplementation')) || '';
    const { file } = context[architectImplementationId] as UserIntent || { approved: false };

    await writeFileIfNotFoundLocally(file);

    // there must be a spec file generated in the previous architectureReview state
    if (!file || !fs.existsSync(file)) throw new Error(`File does not exist: ${file}`);

    // get the state
    const architectureReviewId =
        context.stack
            ?.slice()
            .reverse()
            .find((item) => item.includes('architectureReview')) || '';
    const { approved, messages } = context[architectureReviewId] as AbstractReviewState || { approved: false }

    if (approved) {
        // make sure to capture any changes to the spec file that resulted from direct user edits
        await saveFileToGithub(file);

        return {
            approved,
            messages,
            reviewRequired: false,
            file,
        }
    }

    // get the most recent message as part of review
    const { user, system } = messages?.[messages?.length - 1] || {};

    // if the user has responded we want to push the system and user response onto the thread history
    // this lets us capture the user feedback as part of the broader message history
    if (user) {
        const threadsDao = container.get<ThreadsDao>(TYPES.ThreadsDao);
        const messageThread = await threadsDao.read(context.machineExecutionId!);
        const parsedMessages = JSON.parse(messageThread?.messages || '[]') as {
            user?: string;
            system?: string;
        }[];

        parsedMessages?.push({ user, system });

        await threadsDao.upsert(
            JSON.stringify(parsedMessages),
            'cli-tool',
            context.machineExecutionId!
        );

        messages?.push({ system: 'Please incorporate the user\'s feedback into the design specification.' });

        // there is a user response, reset review required to false since the user has supplied feedback
        // this will allow the function catalog to re-enter the the confirm user intent state
        return {
            approved: false,
            reviewRequired: false,
            file,
            messages: messages,
        }
    }

    messages?.push({ system: 'Please review the spec file.' });

    return {
        approved: false,
        reviewRequired: true,
        file,
        messages: messages || [{ system: 'Please review the spec file.' }],
    }
}
