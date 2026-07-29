import { Router } from 'express';
import { requireAuth, blockInactiveParticipant } from '../authentication/auth.middleware.js';
import {
  createInviteHandler,
  redeemInviteHandler,
  cancelInviteHandler,
  listMineHandler,
} from './invite.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/', blockInactiveParticipant, createInviteHandler);
router.get('/', listMineHandler);
router.post('/:code/redeem', blockInactiveParticipant, redeemInviteHandler);
router.delete('/:id', cancelInviteHandler);

export default router;
