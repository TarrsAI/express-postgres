import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { router } from './router/index.js';
import { logger } from './utility/logger.js';
import { validateEnv, corsOrigins, isProd } from './utility/env.js';

validateEnv();

const app = express();

// Trust the first hop's X-Forwarded-* — required when running behind
// the Tarrs ALB / Caddy so req.ip is the real client and rate limits
// don't bucket every request as the proxy. If you stack additional
// trusted proxies in front, raise the count accordingly.
app.set('trust proxy', 1);

app.use(helmet());

// Cookie auth requires `credentials: 'include'` from the frontend,
// which the browser blocks against a wildcard origin. We refuse '*'
// in env.ts so this never accidentally opens up.
const origins = corsOrigins();
if (origins.length > 0) {
  app.use(
    cors({
      origin: origins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );
} else if (!isProd()) {
  // Dev convenience: with no allowlist set, allow localhost so a
  // newly-cloned starter just works on `pnpm dev`. Production with no
  // CORS_ORIGINS gets nothing — explicit by design.
  app.use(
    cors({
      origin: /^http:\/\/localhost(:\d+)?$/,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );
}

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

app.use('/api', router);

app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (
    err: Error & { statusCode?: number },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const code = err.statusCode ?? 500;
    logger.error({ err }, 'request failed');
    // 4xx — intentional client-facing message ("Validation failed:
    // email required"). 5xx — message often contains framework /
    // driver internals (DB constraint names, file paths, ORM stack
    // text) that should not reach the client. Log raw above; return
    // a stable generic message.
    if (code >= 500) {
      res.status(code).json({ error: 'Internal server error' });
      return;
    }
    res.status(code).json({ error: err.message ?? 'Bad request' });
  },
);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  logger.info(`API listening on :${port}`);
});
