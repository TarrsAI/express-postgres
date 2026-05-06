import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { hashPassword, verifyPassword } from '../utility/password.js';
import {
  signSession,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from '../utility/jwt.js';
import { cookieDefaults } from '../utility/env.js';

const Credentials = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
});

const setSessionCookie = (res: Response, token: string): void => {
  const { sameSite, secure, domain } = cookieDefaults();
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite,
    domain,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
};

/**
 * POST /api/auth/register — creates a user, sets the session cookie.
 *
 * Email-collision response is intentionally generic ("Sign-in failed")
 * to avoid an account-enumeration oracle. If you want a friendlier UX,
 * trade off by returning a specific error here.
 */
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = Credentials.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }
    const { email, password } = parsed.data;
    const passwordHash = await hashPassword(password);
    let user;
    try {
      const [created] = await db
        .insert(users)
        .values({ email, passwordHash })
        .returning({ id: users.id, email: users.email });
      user = created;
    } catch (err) {
      // 23505 = unique_violation. Could be email collision or a future
      // unique constraint we add — only the email path is user-fixable
      // so we just return the generic auth error.
      if ((err as { code?: string }).code === '23505') {
        res.status(400).json({ error: 'Sign-in failed' });
        return;
      }
      throw err;
    }
    if (!user) throw new Error('insert returned no row');
    const token = await signSession({ userId: user.id, email: user.email });
    setSessionCookie(res, token);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login — verifies credentials, sets the session cookie.
 *
 * Constant-time-ish: bcrypt.compare runs even when the user doesn't
 * exist (against a fixed dummy hash) so a missing-user response is
 * indistinguishable from a wrong-password response by timing alone.
 */
const DUMMY_HASH =
  '$2a$10$abcdefghijklmnopqrstuvCqJYdv0fH.iWAY5g8mN4KX5yhEJ4hbxe';

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = Credentials.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }
    const { email, password } = parsed.data;
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    const ok = user
      ? await verifyPassword(password, user.passwordHash)
      : await verifyPassword(password, DUMMY_HASH); // eat the time
    if (!user || !ok) {
      res.status(401).json({ error: 'Sign-in failed' });
      return;
    }
    const token = await signSession({ userId: user.id, email: user.email });
    setSessionCookie(res, token);
    res.json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    next(err);
  }
};

/** GET /api/auth/me — returns the current user, or null when anon. */
export const me = (req: Request, res: Response): void => {
  res.json({ user: req.user ?? null });
};

/** POST /api/auth/logout — clears the session cookie. Always 204. */
export const logout = (_req: Request, res: Response): void => {
  const { sameSite, secure, domain } = cookieDefaults();
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite,
    domain,
    path: '/',
  });
  res.status(204).end();
};
