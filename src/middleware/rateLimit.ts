import rateLimit from 'express-rate-limit';

/**
 * Auth endpoints — login + register. The brute-force surface for any
 * password-based API. 10 attempts per 15min per IP is enough for an
 * honest user mistyping; way too few for a credential-stuffing bot to
 * make progress.
 *
 * If you front this API with a CDN that swallows the real IP, set
 * `trust proxy` on the Express app and configure the limiter's
 * `keyGenerator` to read X-Forwarded-For — otherwise every request
 * looks like the same IP and gets bucketed together.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many auth attempts — try again in 15 minutes' },
});
