import { Report } from './moderation.model.js';
import { User } from '../authentication/auth.model.js';
import { Collaboration } from '../collaboration/collaboration.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { mailer } from '../../utils/mailer.js';
import { logger } from '../../utils/logger.js';

const REASONS = ['harassment', 'spam', 'inappropriate_content', 'other'];

async function findTargetParticipant(userId, collaborationId) {
  const collaboration = await Collaboration.findById(collaborationId).select('participants');
  const isParticipant =
    collaboration && collaboration.participants.some((p) => p.user.toString() === userId.toString());
  if (!isParticipant) {
    throw new ApiError(403, 'You are not a participant in this collaboration');
  }
  const other = collaboration.participants.find((p) => p.user.toString() !== userId.toString());
  return other.user;
}

export async function reportUser(reporterId, collaborationId, { reason, details }) {
  if (!REASONS.includes(reason)) {
    throw new ApiError(400, 'reason must be one of harassment, spam, inappropriate_content, other');
  }
  const trimmedDetails = (details ?? '').trim();
  if (trimmedDetails.length > 1000) {
    throw new ApiError(400, 'Details must be 1000 characters or fewer');
  }

  const reportedUserId = await findTargetParticipant(reporterId, collaborationId);

  let isDuplicate = false;
  try {
    await Report.create({
      reporter: reporterId,
      reportedUser: reportedUserId,
      collaboration: collaborationId,
      reason,
      details: trimmedDetails,
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
    isDuplicate = true;
  }

  if (!isDuplicate) {
    const [reporter, reportedUser] = await Promise.all([
      User.findById(reporterId).select('displayName email'),
      User.findById(reportedUserId).select('displayName email'),
    ]);

    mailer
      .sendReportNotificationEmail({
        reporter,
        reportedUser,
        collaborationId,
        reason,
        details: trimmedDetails,
      })
      .catch((err) => logger.error('Failed to send report notification email', { error: err.body ?? err.message }));
  }
}

export async function blockUser(blockerId, collaborationId) {
  const targetId = await findTargetParticipant(blockerId, collaborationId);
  await User.findByIdAndUpdate(blockerId, { $addToSet: { blockedUsers: targetId } });
}

export async function unblockUser(blockerId, blockedUserId) {
  await User.findByIdAndUpdate(blockerId, { $pull: { blockedUsers: blockedUserId } });
}

export async function getBlockedUsers(userId) {
  const user = await User.findById(userId).populate('blockedUsers', 'displayName');
  return user.blockedUsers;
}

// Combines "users I've blocked" with "users who've blocked me" into one list —
// matchmaking/invite need to treat a block from either direction the same way.
export async function getMutuallyBlockedIds(userId) {
  const [user, blockedByOthers] = await Promise.all([
    User.findById(userId).select('blockedUsers'),
    User.find({ blockedUsers: userId }).select('_id'),
  ]);
  return [...(user?.blockedUsers ?? []), ...blockedByOthers.map((u) => u._id)];
}

export async function listReports() {
  return Report.find()
    .sort({ createdAt: -1 })
    .populate('reporter', 'displayName email')
    .populate('reportedUser', 'displayName email');
}

export async function markReportReviewed(reportId) {
  const report = await Report.findByIdAndUpdate(reportId, { status: 'reviewed' }, { new: true })
    .populate('reporter', 'displayName email')
    .populate('reportedUser', 'displayName email');
  if (!report) {
    throw new ApiError(404, 'Report not found');
  }
  return report;
}
