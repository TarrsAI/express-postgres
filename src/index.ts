import 'dotenv/config';
import express, {
  type Request,
  type Response,
  type ErrorRequestHandler,
} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import logger, { requestLogger, errorLogger } from './utility/logger.js';
import response from './utility/response.js';
import { HTTP_STATUS_CODE } from './utility/httpStatusCode.js';
import { db } from './db/sequelizeConfig.js';
import './model/index.js';
import { router } from './router/index.js';
import { requireCsrf } from './middleware/csrf.js';
import { validateEnv, corsOrigins, isProd } from './utility/env.js';

// Bump on every push.
//   MAJOR (1.x.x → 2.0.0)  breaking API change
//   MINOR (0.1.x → 0.2.0)  new feature, backward compatible
//   PATCH (0.1.0 → 0.1.1)  bug fix only
const VERSION = '0.2.0';

validateEnv();
await db();

const app = express();

// Behind an ALB / Caddy: trust exactly one upstream hop. Without this,
// Express returns the proxy's IP from req.ip and ignores X-Forwarded-For,
// which breaks rate limiting + request logs. Configurable via TRUST_PROXY
// for setups behind CloudFront + ALB (2 hops) or other layered fronts.
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));

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
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Tag every request with a short requestId via AsyncLocalStorage so
// any logger.* call inside the handler chain picks it up. Also emits
// START / END / SLOW / ERROR lines with method, path, status, duration.
app.use(requestLogger());

app.get('/health', (_req: Request, res: Response) => {
  response(res, HTTP_STATUS_CODE.OK, undefined, {
    status: 'Healthy',
    service: 'express-postgres',
    version: VERSION,
  });
});

// CSRF — Origin/Referer check on every /api mutation. Mount BEFORE
// the router so unsafe methods short-circuit before any handler runs.
// Safe methods (GET/HEAD/OPTIONS) pass through with no work.
app.use('/api', requireCsrf);

app.use('/api', router);

// Error chain. errorLogger decides log level + emits the line;
// errorHandler shapes the response envelope. Two middlewares so each
// concern stays focused and either can be swapped independently.
app.use(errorLogger());

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (!err) return;
  const e = err as Error & {
    statusCode?: number;
    code?: string;
    expected?: boolean;
  };
  const statusCode = e.statusCode ?? HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR;
  const isClient = statusCode >= 400 && statusCode < 500;
  // 5xx with `expected: true` = known upstream state we threw
  // ourselves via httpErr (third-party 502, queue full, etc.).
  // Message is hand-crafted by us, safe to forward. errorLogger
  // already downgraded this to a WARN.
  const isExpectedUpstream = !isClient && e.expected === true;
  const safeToForward = isClient || isExpectedUpstream;

  // 4xx → forward e.message (we control these via httpErr).
  // 5xx + expected → forward e.message (also ours).
  // 5xx unexpected → "Internal error". The raw message may contain
  // PG error text / SQL fragments / internal IPs / file paths. Never
  // echo to the client. errorLogger has already logged it server-side
  // with the stack.
  response(
    res,
    statusCode,
    safeToForward ? e.message || 'Bad request' : 'Internal error',
    null,
    isProd()
      ? undefined
      : {
          type: e.name,
          stack: e.stack,
        },
    safeToForward && e.code ? e.code : null,
  );
};
app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  logger.info(`API listening on :${port}`);
});

export default app;
