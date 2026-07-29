import { Router } from 'express';
import { requireAuth, blockInactiveParticipant } from '../authentication/auth.middleware.js';
import { joinQueueHandler, cancelQueueHandler, getStatusHandler } from './matchmaking.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/quick-match', blockInactiveParticipant, joinQueueHandler);
router.delete('/quick-match', cancelQueueHandler);
router.get('/quick-match', getStatusHandler);

export default router;
