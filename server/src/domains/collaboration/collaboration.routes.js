import { Router } from 'express';
import { requireAuth } from '../authentication/auth.middleware.js';
import {
  listMineHandler,
  getOneHandler,
  submitTurnHandler,
  respondToCompletionHandler,
  getTurnCountHandler,
  leaveHandler,
} from './collaboration.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', listMineHandler);
router.get('/turn-count', getTurnCountHandler);
router.get('/:id', getOneHandler);
router.post('/:id/turns', submitTurnHandler);
router.post('/:id/completion', respondToCompletionHandler);
router.post('/:id/leave', leaveHandler);

export default router;
