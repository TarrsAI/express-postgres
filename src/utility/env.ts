import { logger } from './logger.js';

/**
 * Required env vars validated at boot. Anything missing (or too short
 * for the secret-strength rule) crashes the process before the first
 * request lands. Better to fail loud than to start serving with a weak
 * JWT secret silently in place.
 */
const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'] as const;

const MIN_SECRET_LEN = 32;

export const validateEnv = (): void => {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    logger.error({ missing }, 'Missing required env vars');
    process.exit(1);
  }
  if ((process.env.JWT_SECRET ?? '').length < MIN_SECRET_LEN) {
    logger.error(
      { minLen: MIN_SECRET_LEN },
      'JWT_SECRET too short — generate with `openssl rand -base64 48`',
    );
    process.exit(1);
  }
};

/**
 * Read CORS_ORIGINS as a comma-separated allowlist. We refuse '*' on
 * purpose: cookie auth uses `credentials: 'include'` which the browser
 * blocks against wildcard origins, and even without cookies a wildcard
 * is a footgun that lets any site read your API responses.
 */
export const corsOrigins = (): string[] => {
  return (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== '*');
};

export const isProd = (): boolean => process.env.NODE_ENV === 'production';

/**
 * Cookie defaults pulled from env, with sane fallbacks. SameSite=none
 * automatically forces secure=true (browser requirement, and the right
 * default anyway). Domain is left undefined unless explicitly set so
 * the cookie binds to the API host alone.
 */
export type SameSite = 'lax' | 'none' | 'strict';

export interface CookieDefaults {
  sameSite: SameSite;
  secure: boolean;
  domain: string | undefined;
}

export const cookieDefaults = (): CookieDefaults => {
  const sameSiteRaw = (process.env.COOKIE_SAMESITE ?? 'lax').toLowerCase();
  const sameSite: SameSite =
    sameSiteRaw === 'none' || sameSiteRaw === 'strict' ? sameSiteRaw : 'lax';
  // sameSite=none requires secure=true; in prod we always set secure
  // anyway. Dev (NODE_ENV != production) leaves secure unset so
  // localhost cookies work over plain http.
  const secure = isProd() || sameSite === 'none';
  const domain = process.env.COOKIE_DOMAIN || undefined;
  return { sameSite, secure, domain };
};
