import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import * as matchmakingService from './matchmaking.service.js';

const WRITING_TYPES = ['story', 'poem'];

export const joinQueueHandler = asyncHandler(async (req, res) => {
  const { writingType } = req.body;
  if (!WRITING_TYPES.includes(writingType)) {
    throw new ApiError(400, "writingType must be 'story' or 'poem'");
  }

  const result = await matchmakingService.joinQueue(req.user.id, writingType);
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
