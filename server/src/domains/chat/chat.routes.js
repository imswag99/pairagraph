import { Router } from 'express';
import { requireAuth } from '../authentication/auth.middleware.js';
import { sendMessageHandler, getHistoryHandler } from './chat.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', getHistoryHandler);
router.post('/', sendMessageHandler);

export default router;
