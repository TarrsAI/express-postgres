import type { Request, Response, NextFunction } from 'express';
import { SESSION_COOKIE_NAME, verifySession } from '../utility/jwt.js';
import { httpErr } from '../utility/httpErr.js';
import { HTTP_STATUS_CODE } from '../utility/httpStatusCode.js';

// Augment the Express Request shape so handlers can read req.user
// after loadSession has populated it.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

/**
 * Reads the session cookie and attaches `req.user` if valid. Does NOT
 * 401 — use this when you want optional auth (e.g. /me returns null
 * for anonymous instead of 401, so the frontend can decide).
 */
export const loadSession = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const token =
    (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE_NAME];
  if (!token) {
    next();
    return;
  }
  const claims = await verifySession(token);
  if (claims) {
    req.user = { id: claims.sub, email: claims.email };
  }
  next();
};

/**
 * Hard gate — 401s the request when there's no valid session. Mount
 * after loadSession on routes that require auth.
 */
export const requireAuth = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    next(
      httpErr('Sign in required', HTTP_STATUS_CODE.UNAUTHORIZED, {
        code: 'ERR_AUTH_REQUIRED',
      }),
    );
    return;
  }
  next();
};
