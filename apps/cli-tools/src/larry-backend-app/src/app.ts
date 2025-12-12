import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { requestId } from './middleware/request-id';
import { errorHandler } from './middleware/error-handler';
import { googleSubapp } from './routes/google';

export function buildApp() {
  const app = express();

  app.use((req, res, next) => {
    // Allow the VS Code webview origin (or just * since you have no auth/cookies)
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Allow headers you actually use
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Idempotency-Key, Client-Request-Id',
    );
    // Allow methods you use
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    // Handle preflight fast
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.use(
    compression({
      filter: (req, res) => {
        // Skip compression for SSE no matter what
        const isSSE =
          req.headers.accept?.includes('text/event-stream') ||
          req.path.endsWith('/events') ||
          req.originalUrl?.includes('/events');
        if (isSSE) return false;

        return compression.filter(req, res);
      },
    }),
  );
  app.use(express.json()); // per your instruction, no explicit size limit here
  app.use(requestId());

  // - Mount the google agent subapp
  app.use('/larry/agents/google/v1', googleSubapp());

  // - 404
  app.use((_req, res) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
      requestId: res.getHeader('X-Request-Id') || 'unknown',
    });
  });

  // - Errors
  app.use(errorHandler());

  return app;
}
