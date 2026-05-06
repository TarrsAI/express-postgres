import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7d

const secretBytes = (): Uint8Array =>
  new TextEncoder().encode(process.env.JWT_SECRET!);

export interface SessionClaims extends JWTPayload {
  sub: string;
  email: string;
}

/** Sign a session JWT. Used by /api/auth/login and /api/auth/register. */
export const signSession = async (claims: {
  userId: string;
  email: string;
}): Promise<string> => {
  return new SignJWT({ email: claims.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretBytes());
};

/** Verify a session JWT. Returns null on any failure (expired, bad
 *  signature, malformed). Caller should treat null as anonymous. */
export const verifySession = async (
  token: string,
): Promise<SessionClaims | null> => {
  try {
    const { payload } = await jwtVerify(token, secretBytes(), {
      algorithms: ['HS256'],
    });
    if (typeof payload.sub !== 'string') return null;
    return {
      ...payload,
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : '',
    };
  } catch {
    return null;
  }
};

export const SESSION_COOKIE_NAME = 'tarrs_session';
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
