import { User } from '../authentication/auth.model.js';
import { deleteAccount } from '../authentication/auth.service.js';
import { Report } from '../moderation/moderation.model.js';
import { Collaboration } from '../collaboration/collaboration.model.js';
import { ChatMessage } from '../chat/chat.model.js';
import { ApiError } from '../../utils/ApiError.js';

export async function listUsers() {
  const [users, reportCounts] = await Promise.all([
    User.find().select('displayName email role isBanned isDeleted createdAt').sort({ createdAt: -1 }),
    Report.aggregate([
      { $match: { status: 'open' } },
      { $group: { _id: '$reportedUser', count: { $sum: 1 } } },
    ]),
  ]);

  const openReportCountById = new Map(reportCounts.map((r) => [r._id.toString(), r.count]));

  return users.map((user) => ({
    id: user._id,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    isBanned: user.isBanned,
    isDeleted: user.isDeleted,
    createdAt: user.createdAt,
    openReportCount: openReportCountById.get(user._id.toString()) ?? 0,
  }));
}

export async function banUser(adminId, targetId) {
  if (adminId.toString() === targetId.toString()) {
    throw new ApiError(400, "You can't ban your own account");
  }
  const target = await User.findById(targetId);
  if (!target) {
    throw new ApiError(404, 'User not found');
  }
  target.isBanned = true;
  // Clears any refresh token so a banned user can't quietly mint a fresh
  // access token later — their current one still works until it expires
  // (see blockInactiveParticipant), but that's a bounded, accepted window.
  target.refreshTokenHash = null;
  await target.save();
}

export async function unbanUser(targetId) {
  const target = await User.findByIdAndUpdate(targetId, { isBanned: false });
  if (!target) {
    throw new ApiError(404, 'User not found');
  }
}

export async function deleteUser(adminId, targetId) {
  if (adminId.toString() === targetId.toString()) {
    throw new ApiError(400, "You can't delete your own account");
  }
  const target = await User.findById(targetId).select('role');
  if (!target) {
    throw new ApiError(404, 'User not found');
  }
  if (target.role === 'admin') {
    throw new ApiError(400, "You can't delete another admin's account");
  }
  await deleteAccount(targetId);
}

// No participant check on purpose — this is how an admin reviews a report
// about a collaboration they were never part of. Includes chat since that's
// where harassment/spam usually actually happens, not the co-written text.
export async function getReportedCollaboration(collaborationId) {
  const collaboration = await Collaboration.findById(collaborationId)
    .populate('participants.user', 'displayName email')
    .populate('entries.author', 'displayName')
    .populate('turnOwner', 'displayName');
  if (!collaboration) {
    throw new ApiError(404, 'Collaboration not found');
  }

  const messages = await ChatMessage.find({ collaboration: collaborationId })
    .sort({ createdAt: 1 })
    .populate('sender', 'displayName');

  return { collaboration, messages };
}

// Moderation backstop for the public gallery: since anyone can view
// published work (not just the two authors), an admin needs a way to pull a
// piece down regardless of who published it or whether either author is
// reachable. No participant check, same reasoning as getReportedCollaboration
// above — this is precisely the case that check doesn't apply to.
export async function unpublishCollaboration(collaborationId) {
  const collaboration = await Collaboration.findByIdAndUpdate(collaborationId, {
    isPublished: false,
  });
  if (!collaboration) {
    throw new ApiError(404, 'Collaboration not found');
  }
}
