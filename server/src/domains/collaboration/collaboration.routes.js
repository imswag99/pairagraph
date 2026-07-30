import { Router } from 'express';
import { requireAuth, blockInactiveParticipant } from '../authentication/auth.middleware.js';
import {
  listMineHandler,
  getOneHandler,
  submitTurnHandler,
  respondToCompletionHandler,
  getTurnCountHandler,
  leaveHandler,
  setPublishedHandler,
  setPublishConsentHandler,
} from './collaboration.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', listMineHandler);
router.get('/turn-count', getTurnCountHandler);
router.get('/:id', getOneHandler);
router.post('/:id/turns', blockInactiveParticipant, submitTurnHandler);
router.post('/:id/completion', blockInactiveParticipant, respondToCompletionHandler);
router.post('/:id/leave', leaveHandler);
router.patch('/:id/publish', blockInactiveParticipant, setPublishedHandler);
router.patch('/:id/publish-consent', blockInactiveParticipant, setPublishConsentHandler);

export default router;
