import { Router } from 'express';
import { requireAuth, blockInactiveParticipant } from '../authentication/auth.middleware.js';
import { sendMessageHandler, getHistoryHandler } from './chat.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', getHistoryHandler);
router.post('/', blockInactiveParticipant, sendMessageHandler);

export default router;
