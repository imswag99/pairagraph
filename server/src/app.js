import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import authRoutes from './domains/authentication/auth.routes.js';
import collaborationRoutes from './domains/collaboration/collaboration.routes.js';
import matchmakingRoutes from './domains/matchmaking/matchmaking.routes.js';
import inviteRoutes from './domains/invite/invite.routes.js';
import chatRoutes from './domains/chat/chat.routes.js';
import leaderboardRoutes from './domains/leaderboard/leaderboard.routes.js';
import moderationRoutes from './domains/moderation/moderation.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

function rateLimitHandler(req, res) {
  res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
}

// Generous baseline for the whole API, plus a much stricter limit specifically
// on the auth endpoints attackers would actually want to brute-force or spam.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export function createApp() {
  const app = express();

  // Render (like Heroku) puts exactly one reverse proxy in front of the app;
  // trusting that one hop lets express-rate-limit read the real client IP
  // from X-Forwarded-For instead of rate-limiting the proxy itself.
  app.set('trust proxy', 1);

  app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (req, res) => res.json({ success: true, message: 'ok' }));
  app.use('/api', generalLimiter);
  app.use(
    '/api/auth',
    (req, res, next) => {
      const strict = ['/register', '/login', '/google', '/forgot-password', '/reset-password'];
      if (strict.some((path) => req.path.startsWith(path))) {
        return authLimiter(req, res, next);
      }
      next();
    },
    authRoutes
  );
  app.use('/api/collaborations', collaborationRoutes);
  app.use('/api/matchmaking', matchmakingRoutes);
  app.use('/api/invites', inviteRoutes);
  app.use('/api/collaborations/:collaborationId/chat', chatRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);
  app.use('/api/moderation', moderationRoutes);

  app.use(errorHandler);

  return app;
}
