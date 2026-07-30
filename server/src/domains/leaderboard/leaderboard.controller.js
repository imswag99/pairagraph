import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import * as leaderboardService from './leaderboard.service.js';

const VALID_RANGES = ['week', 'month', 'all'];

export const getLeaderboardHandler = asyncHandler(async (req, res) => {
  const range = req.query.range ?? 'week';
  if (!VALID_RANGES.includes(range)) {
    throw new ApiError(400, "range must be 'week', 'month', or 'all'");
  }

  const entries = await leaderboardService.getLeaderboard(range);
  res.json({ success: true, data: { range, entries } });
});
