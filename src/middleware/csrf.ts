import type { Request, Response, NextFunction } from 'express';
import { httpErr } from '../utility/httpErr.js';
import { HTTP_STATUS_CODE } from '../utility/httpStatusCode.js';

/**
 * Origin / Referer-based CSRF defense. The frontend has to send a
 * request whose Origin or Referer header matches CSRF_ALLOWED_ORIGINS.
 *
 * Why not a token? With httpOnly cookie auth + strict CORS, an
 * attacker page can already not READ responses (CORS forbids it), so
 * the only abuse surface is unsafe (POST/PUT/PATCH/DELETE) writes
 * triggered cross-origin. Origin verification kills those because
 * browsers attach Origin on every cross-origin write and there's no
 * way for the attacker page to forge it.
 *
 * Safe methods (GET / HEAD / OPTIONS) skip the check — they're not
 * supposed to mutate state, and exempting them keeps preflight and
 * legitimate read traffic unencumbered.
 *
 * Set `CSRF_ALLOWED_ORIGINS` to the comma-separated list of frontend
 * origins allowed to mutate (same shape as CORS_ORIGINS — usually the
 * same value). If unset, the middleware reuses CORS_ORIGINS.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const parseList = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== '*');

const getAllowedOrigins = (): string[] => {
  const explicit = parseList(process.env.CSRF_ALLOWED_ORIGINS);
  if (explicit.length > 0) return explicit;
  return parseList(process.env.CORS_ORIGINS);
};

export const requireCsrf = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const allowed = getAllowedOrigins();
  // No allowlist configured AND we're in dev → permissive (so the
  // starter just works on first clone). Prod with no allowlist
  // blocks every mutation by design.
  if (allowed.length === 0) {
    if (process.env.NODE_ENV !== 'production') {
      next();
      return;
    }
    next(
      httpErr('CSRF: no allowed origins configured', HTTP_STATUS_CODE.FORBIDDEN, {
        code: 'ERR_CSRF',
      }),
    );
    return;
  }
  const origin = req.headers.origin as string | undefined;
  const referer = req.headers.referer as string | undefined;
  // Origin is the preferred signal (always set on cross-origin
  // writes); fall back to Referer for the small set of legacy
  // browsers / mobile webviews that strip Origin.
  const source = origin ?? (referer ? new URL(referer).origin : undefined);
  if (!source || !allowed.includes(source)) {
    next(
      httpErr('CSRF: origin not allowed', HTTP_STATUS_CODE.FORBIDDEN, {
        code: 'ERR_CSRF',
      }),
    );
    return;
  }
  next();
};
