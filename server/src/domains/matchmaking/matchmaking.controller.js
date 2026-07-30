import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { WRITING_TYPES, THEMES } from '../collaboration/collaboration.constants.js';
import * as matchmakingService from './matchmaking.service.js';

export const joinQueueHandler = asyncHandler(async (req, res) => {
  const { writingType } = req.body;
  const theme = req.body.theme ?? 'classic';
  if (!WRITING_TYPES.includes(writingType)) {
    throw new ApiError(400, "writingType must be 'story' or 'poem'");
  }
  if (!THEMES.includes(theme)) {
    throw new ApiError(400, `theme must be one of: ${THEMES.join(', ')}`);
  }

  const result = await matchmakingService.joinQueue(req.user.id, writingType, theme);
  res.json({ success: true, data: result });
});

export const cancelQueueHandler = asyncHandler(async (req, res) => {
  await matchmakingService.cancel(req.user.id);
  res.json({ success: true, message: 'Left the matchmaking queue' });
});

export const getStatusHandler = asyncHandler(async (req, res) => {
  const status = await matchmakingService.getStatus(req.user.id);
  res.json({ success: true, data: status });
});
