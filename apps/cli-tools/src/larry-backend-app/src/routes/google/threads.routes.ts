import { Router, Request, Response, NextFunction } from 'express';
import type {
  ThreadsListResponse,
  ThreadCreatedEvent,
  MachineUpdatedEvent,
  MachineResponse,
  MachineStatus,
} from '../../types';
import { IdempotencyStore } from '../../services/idempotency.store';
import { SSEService } from '../../services/sse.service';
import {
  Context,
  LarryStream,
  MachineDao,
  TYPES,
  ThreadsDao,
} from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';
import { googleCodingAgent } from '../../../../googleCodingAgentStandalone';
import { pauseFor } from '../../utils';

export function threadsRoutes(idem: IdempotencyStore, sse: SSEService) {
  const r = Router();

  const threadsDao = container.get<ThreadsDao>(TYPES.ThreadsDao);
  const machineDao = container.get<MachineDao>(TYPES.MachineDao);
  const larryStream = container.get<LarryStream>(TYPES.LarryStream);

  // GET /threads?cursor=&limit=
  r.get('/threads', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cursor, limit } = req.query as {
        cursor?: string;
        limit?: string;
      };
      const requestId = (req as any).requestId;

      // TODO integrate with ThreadsDao once list is ready
      // const { items, nextCursor } = await threadsDao.list({ cursor, limit: Number(limit) || 20 });

      const items = []; // placeholder
      const nextCursor = null;

      const body: ThreadsListResponse = { items, nextCursor, requestId };
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  // GET /threads/:threadId
  r.get(
    '/threads/:threadId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { threadId } = req.params;
        const thread = await threadsDao.read(threadId);
        res.json(thread);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /threads/new
  r.post(
    '/threads/new',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const requestId = (req as any).requestId;
        const idemKey = (req as any).idempotencyKey as string | undefined;

        // validate minimal payload
        const { worktreeName, userTask, label } = req.body || {};
        if (!worktreeName || !userTask) {
          const err = new Error('Missing worktreeName or userTask');
          (err as any).status = 400;
          (err as any).code = 'BAD_REQUEST';
          throw err;
        }

        // Fire-and-accept pattern. We return 202 and later emit thread.created via SSE.
        // Optionally set Retry-After to hint polling interval when SSE is not used.
        res.setHeader('Retry-After', '3');

        const acceptedBody = {
          status: 'provisioning',
          threadId: null as string | null,
          machineId: null as string | null,
          requestId,
        };

        // Record idempotent response for immediate replay on client retries
        if (idemKey) {
          // store the "accepted" envelope now - you may overwrite after creation completes if you prefer
          idem.set(idemKey, 202, acceptedBody, { 'Retry-After': '3' });
        }

        res.status(202).json(acceptedBody);

        // Kick off async creation - don't await, let it run in background
        // Any errors here should be logged but not sent to client since response is already sent
        setImmediate(async () => {
          try {
            const { executionId } = await googleCodingAgent(
              undefined,
              undefined,
              userTask,
            );

            await pauseFor(2000); // pause for 2s to avoid issues with eventual consistency

            const threadId = executionId;
            const machineId = executionId;

            const machine = await machineDao.read(executionId);

            const context = JSON.parse(machine.state!).context;
            const currentStateContext = context[context.stateId];
            const humanReview = currentStateContext?.reviewRequired;

            const running = !humanReview && !currentStateContext?.approved;
            const status: MachineStatus = humanReview
              ? 'awaiting_human'
              : running
                ? 'running'
                : 'pending';
            const machineUpdateEvt: MachineUpdatedEvent = {
              type: 'machine.updated',
              machine: {
                id: machineId,
                status,
                currentState: context.stateId,
                context,
              },
              clientRequestId: req.header('Client-Request-Id') || undefined,
            };
            sse.broadcastMachineUpdated(machineUpdateEvt);

            const evt: ThreadCreatedEvent = {
              type: 'thread.created',
              threadId,
              machineId,
              label: label ?? `${userTask.substring(0, 20)}...`,
              worktreeName,
              clientRequestId: req.header('Client-Request-Id') || undefined,
            };
            sse.broadcastThreadCreated(evt);
          } catch (asyncErr) {
            larryStream.publish({
              id: 'new-thread-creation',
              payload: {
                type: 'error',
                message: 'Failed to create thread, try again',
                metadata: {
                  error: asyncErr,
                },
              },
            });

            console.error(
              '[threads.routes] Async thread creation failed:',
              asyncErr,
            );
          }
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return r;
}
