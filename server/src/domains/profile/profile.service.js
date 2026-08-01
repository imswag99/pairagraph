import { User } from '../authentication/auth.model.js';
import { Collaboration } from '../collaboration/collaboration.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { summarizePiece } from '../gallery/gallery.service.js';

export async function getPublicProfile(userId) {
  const user = await User.findById(userId).select(
    'displayName isProfilePublic isBanned isDeleted totalCompletions storyCompletions poemCompletions currentStreak longestStreak badges partners'
  );
  if (!user || user.isDeleted || user.isBanned || !user.isProfilePublic) {
    throw new ApiError(404, 'This profile is not available');
  }

  // Only pieces this user themselves consented to be named on — a profile
  // being public doesn't override the separate, per-piece publish-consent a
  // user already gave (or withheld) via collaboration.service.js. A piece
  // they chose to appear "Anonymous collaborator" on stays off their own
  // portfolio too, not just off the piece's own gallery listing.
  const collaborations = await Collaboration.find({
    isPublished: true,
    participants: { $elemMatch: { user: user._id, hasConsentedToPublish: true } },
  })
    .sort({ publishedAt: -1 })
    .populate('participants.user', 'displayName');

  return {
    id: user._id,
    displayName: user.displayName,
    totalCompletions: user.totalCompletions,
    storyCompletions: user.storyCompletions,
    poemCompletions: user.poemCompletions,
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    badges: user.badges,
    partnerCount: user.partners.length,
    pieces: collaborations.map(summarizePiece),
  };
}
