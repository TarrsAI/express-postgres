import type { Request, Response, NextFunction } from 'express';
import { SESSION_COOKIE_NAME, verifySession } from '../utility/jwt.js';

// Augment the Express Request shape so handlers can read req.user
// after loadSession has populated it. Using the global Express
// namespace works regardless of which @types/express version pulls
// in `express-serve-static-core` indirectly.
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
) => {
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
  res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    res.status(401).json({ error: 'Sign in required' });
    return;
  }
  next();
};
