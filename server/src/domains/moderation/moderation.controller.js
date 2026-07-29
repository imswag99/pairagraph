import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import * as moderationService from './moderation.service.js';

export const createReportHandler = asyncHandler(async (req, res) => {
  const { collaborationId, reason, details } = req.body;
  if (!collaborationId) {
    throw new ApiError(400, 'collaborationId is required');
  }

  await moderationService.reportUser(req.user.id, collaborationId, { reason, details });
  res.status(201).json({ success: true, message: 'Report submitted' });
});

export const createBlockHandler = asyncHandler(async (req, res) => {
  const { collaborationId } = req.body;
  if (!collaborationId) {
    throw new ApiError(400, 'collaborationId is required');
  }

  await moderationService.blockUser(req.user.id, collaborationId);
  res.status(201).json({ success: true, message: 'User blocked' });
});

export const deleteBlockHandler = asyncHandler(async (req, res) => {
  await moderationService.unblockUser(req.user.id, req.params.userId);
  res.json({ success: true, message: 'User unblocked' });
});

export const listBlocksHandler = asyncHandler(async (req, res) => {
  const blockedUsers = await moderationService.getBlockedUsers(req.user.id);
  res.json({ success: true, data: { blockedUsers } });
});

export const listReportsHandler = asyncHandler(async (req, res) => {
  const reports = await moderationService.listReports();
  res.json({ success: true, data: { reports } });
});

export const markReportReviewedHandler = asyncHandler(async (req, res) => {
  const report = await moderationService.markReportReviewed(req.params.id);
  res.json({ success: true, data: { report } });
});
