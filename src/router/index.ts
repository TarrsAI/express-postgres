import express from 'express';
import { health } from '../controller/health.js';
import * as auth from '../controller/auth.js';
import * as postCtrl from '../controller/posts.js';
import { loadSession, requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

export const router = express.Router();

// Read the session cookie on every request — cheap (one HMAC verify)
// and means downstream handlers can rely on req.user without each
// route remembering to mount the loader.
router.use(loadSession);

router.get('/health', health);

// Auth — rate-limited because they're brute-force surface.
router.post('/auth/register', authLimiter, auth.register);
router.post('/auth/login', authLimiter, auth.login);
router.get('/auth/me', auth.me);
router.post('/auth/logout', auth.logout);

// Sample protected resource. Mount requireAuth ONCE on the prefix so
// every /posts handler is gated; cheaper than per-route + harder to
// forget when adding new endpoints.
router.use('/posts', requireAuth);
router.get('/posts', postCtrl.list);
router.post('/posts', postCtrl.create);
router.delete('/posts/:id', postCtrl.remove);
