import { Router, Request, Response } from 'express';
import { SSEService } from '../../services/sse.service';
import { container } from '@codestrap/developer-foundations-di';
import { TYPES, LarryStream, LarryNotification } from '@codestrap/developer-foundations-types';

export function eventsRoutes(sse: SSEService) {
  const r = Router();

  // GET /machines/:machineId/events
  r.get('/machines/:machineId/events', (req: Request, res: Response) => {
    const { machineId } = req.params;
    sse.registerMachine(machineId, res);
  });

  // GET /events?topics=thread.created,machine.updated
  r.get('/events', (req: Request, res: Response) => {
    const topics =
      typeof req.query.topics === 'string'
        ? (req.query.topics as string)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    const clientRequestId = req.header('Client-Request-Id') || undefined;
    sse.registerGlobal(res, topics, clientRequestId);
  });

  r.get('/larry/:streamId/events', (req: Request, res: Response) => {
    const { streamId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders?.();

    const larryStream = container.get<LarryStream>(TYPES.LarryStream);
    const subscription = larryStream.subscribe(streamId, (notification: LarryNotification) => {
      res.write(`event: larry.update\n`);
      res.write(`data: ${JSON.stringify({ type: 'larry.update', streamId, payload: notification })}\n\n`);
    });

    res.on('close', () => {
      subscription.unsubscribe();
    });
  });

  return r;
}
