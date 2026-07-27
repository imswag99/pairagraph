import { Router } from 'express';
import { requireAuth } from '../authentication/auth.middleware.js';
import {
  createInviteHandler,
  redeemInviteHandler,
  cancelInviteHandler,
  listMineHandler,
} from './invite.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/', createInviteHandler);
router.get('/', listMineHandler);
router.post('/:code/redeem', redeemInviteHandler);
router.delete('/:id', cancelInviteHandler);

export default router;
