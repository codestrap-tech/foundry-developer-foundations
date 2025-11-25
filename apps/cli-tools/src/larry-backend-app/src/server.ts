import { createServer } from 'node:http';
import { buildApp } from './app';

const PORT = Number(process.env.PORT || 4220);

const app = buildApp();
const server = createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[api] listening on http://0.0.0.0:${PORT}`);
});

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(`[api] received ${signal} - shutting down gracefully`);
  // Close SSE streams
  try {
    const googleRouter: any = (app as any)._router?.stack?.find(
      (l: any) =>
        l?.route?.path?.startsWith?.('/larry/agents/google/v1') ||
        l?.name === 'bound dispatch',
    );
    // safer: keep a reference when mounting the subapp, but this works for v0 demo
    // If you kept references on mount, call sse.shutdown() and idem.clear() directly
  } catch {}
  // Stop accepting new connections
  server.close(() => {
    console.log('[api] http server closed');
    process.exit(0);
  });
  // Force-exit after 10s if something hangs
  setTimeout(() => {
    console.warn('[api] force exit after timeout');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
