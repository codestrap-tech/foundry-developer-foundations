import { Response } from 'express';
import type { MachineUpdatedEvent, ThreadCreatedEvent } from '../types';

type SSEClient = {
  res: Response;
  topics?: Set<string>; // for global stream filtering
  clientRequestId?: string | undefined;
};

export class SSEService {
  // per-machine channel
  private machineChannels = new Map<string, Set<Response>>();
  // global channel
  private globalClients = new Set<SSEClient>();
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(private heartbeatMs = 15000) {}

  registerMachine(machineId: string, res: Response) {
    this.prepare(res);
    let set = this.machineChannels.get(machineId);
    if (!set) {
      set = new Set<Response>();
      this.machineChannels.set(machineId, set);
    }
    set.add(res);
    res.on('close', () => set!.delete(res));
  }

  registerGlobal(res: Response, topics?: string[], clientRequestId?: string) {
    this.prepare(res);
    const client: SSEClient = {
      res,
      topics: topics ? new Set(topics) : undefined,
      clientRequestId,
    };
    this.globalClients.add(client);
    res.on('close', () => this.globalClients.delete(client));
  }

  broadcastMachineUpdated(evt: MachineUpdatedEvent) {
    // Machine-specific
    const ch = this.machineChannels.get(evt.machine.id);
    if (ch) {
      ch.forEach((res) => this.send(res, 'machine.updated', evt));
    }
    // Global
    this.globalClients.forEach((c) => {
      if (!c.topics || c.topics.has('machine.updated')) {
        this.send(c.res, 'machine.updated', evt);
      }
    });
  }

  broadcastThreadCreated(evt: ThreadCreatedEvent) {
    this.globalClients.forEach((c) => {
      if (!c.topics || c.topics.has('thread.created')) {
        this.send(c.res, 'thread.created', evt);
      }
    });
  }

  shutdown() {
    // close all streams politely
    this.machineChannels.forEach((set) => {
      set.forEach((res) => {
        try {
          res.write(
            'event: shutdown\ndata: {"reason":"server_terminating"}\n\n',
          );
          res.end();
        } catch {}
      });
      set.clear();
    });
    this.globalClients.forEach((c) => {
      try {
        c.res.write(
          'event: shutdown\ndata: {"reason":"server_terminating"}\n\n',
        );
        c.res.end();
      } catch {}
    });
    this.globalClients.clear();
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
  }

  private prepare(res: Response) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Idempotency-Key, Client-Request-Id, X-Request-Id',
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,HEAD');

    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.(); // if compression is on, Express may support flush
    // start heartbeats when first client appears
    if (!this.heartbeatTimer) {
      this.heartbeatTimer = setInterval(() => this.pingAll(), this.heartbeatMs);
    }
  }

  private send(res: Response, event: string, data: any) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  private pingAll() {
    // comments are valid keep-alives in SSE
    const ping = ': ping\n\n';
    this.machineChannels.forEach((set) =>
      set.forEach((res) => res.write(ping)),
    );
    this.globalClients.forEach((c) => c.res.write(ping));
  }
}
