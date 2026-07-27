import { PointsEntry } from './leaderboard.model.js';

const POINTS_PER_COMPLETION = 10;

// Weeks are Monday 00:00 UTC through Sunday 23:59:59 UTC, the same window for
// every user regardless of timezone — simpler and more predictable than trying
// to compute a "week" per viewer.
function getStartOfIsoWeekUtc(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d;
}

// Called once, right when a collaboration's status flips to 'completed'.
// The unique (user, collaboration) index is a safety net against ever
// double-awarding the same completion, not the primary guard against it.
export async function awardCompletionPoints(collaborationId, userIds) {
  for (const userId of userIds) {
    try {
      await PointsEntry.create({
        user: userId,
        collaboration: collaborationId,
        points: POINTS_PER_COMPLETION,
      });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
}

export async function getLeaderboard(range) {
  const match = {};
  if (range === 'week') {
    match.createdAt = { $gte: getStartOfIsoWeekUtc(new Date()) };
  }

  const rows = await PointsEntry.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userDoc',
      },
    },
    { $unwind: '$userDoc' },
    // Anonymized (deleted) accounts are excluded before ranking, not after,
    // so a real user isn't bumped out of the top 50 by a filtered-out slot.
    { $match: { 'userDoc.isDeleted': { $ne: true } } },
    {
      $group: {
        _id: '$user',
        displayName: { $first: '$userDoc.displayName' },
        totalPoints: { $sum: '$points' },
      },
    },
    { $sort: { totalPoints: -1 } },
    { $limit: 50 },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        displayName: 1,
        points: '$totalPoints',
      },
    },
  ]);

  return rows.map((row, index) => ({ rank: index + 1, ...row }));
}
