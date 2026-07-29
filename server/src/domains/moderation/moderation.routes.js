import { Router } from 'express';
import { requireAuth, requireAdmin } from '../authentication/auth.middleware.js';
import {
  createReportHandler,
  createBlockHandler,
  deleteBlockHandler,
  listBlocksHandler,
  listReportsHandler,
  markReportReviewedHandler,
} from './moderation.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/reports', createReportHandler);
router.post('/blocks', createBlockHandler);
router.get('/blocks', listBlocksHandler);
router.delete('/blocks/:userId', deleteBlockHandler);
router.get('/reports', requireAdmin, listReportsHandler);
router.patch('/reports/:id', requireAdmin, markReportReviewedHandler);

export default router;
