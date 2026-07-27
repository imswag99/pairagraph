import { Router } from 'express';
import { requireAuth } from '../authentication/auth.middleware.js';
import { getLeaderboardHandler } from './leaderboard.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/', getLeaderboardHandler);

export default router;
