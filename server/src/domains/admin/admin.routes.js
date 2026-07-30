import { Router } from 'express';
import { requireAuth, requireAdmin } from '../authentication/auth.middleware.js';
import {
  listUsersHandler,
  banUserHandler,
  unbanUserHandler,
  deleteUserHandler,
  getReportedCollaborationHandler,
  unpublishCollaborationHandler,
} from './admin.controller.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/users', listUsersHandler);
router.patch('/users/:id/ban', banUserHandler);
router.patch('/users/:id/unban', unbanUserHandler);
router.delete('/users/:id', deleteUserHandler);
router.get('/collaborations/:id', getReportedCollaborationHandler);
router.patch('/collaborations/:id/unpublish', unpublishCollaborationHandler);

export default router;
