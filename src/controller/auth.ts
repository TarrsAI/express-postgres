import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import response from '../utility/response.js';
import { httpErr } from '../utility/httpErr.js';
import { HTTP_STATUS_CODE } from '../utility/httpStatusCode.js';
import { registerUser, loginUser } from '../service/auth.js';
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from '../utility/jwt.js';
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

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = Credentials.safeParse(req.body);
    if (!parsed.success) {
      throw httpErr('Validation failed', HTTP_STATUS_CODE.BAD_REQUEST, {
        code: 'ERR_VALIDATION',
      });
    }
    const { email, password } = parsed.data;
    const { user, token } = await registerUser(email, password);
    setSessionCookie(res, token);
    response(res, HTTP_STATUS_CODE.CREATED, 'Registered', { user });
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = Credentials.safeParse(req.body);
    if (!parsed.success) {
      throw httpErr('Validation failed', HTTP_STATUS_CODE.BAD_REQUEST, {
        code: 'ERR_VALIDATION',
      });
    }
    const { email, password } = parsed.data;
    const { user, token } = await loginUser(email, password);
    setSessionCookie(res, token);
    response(res, HTTP_STATUS_CODE.OK, 'Signed in', { user });
  } catch (err) {
    next(err);
  }
};

export const me = (req: Request, res: Response): void => {
  response(res, HTTP_STATUS_CODE.OK, undefined, { user: req.user ?? null });
};

export const logout = (_req: Request, res: Response): void => {
  const { sameSite, secure, domain } = cookieDefaults();
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite,
    domain,
    path: '/',
  });
  response(res, HTTP_STATUS_CODE.NO_CONTENT);
};
