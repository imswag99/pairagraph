import { MatchQueueEntry } from './matchmaking.model.js';
import { Collaboration } from '../collaboration/collaboration.model.js';
import { generateKeywords } from '../ai/ai.service.js';
import { getMutuallyBlockedIds } from '../moderation/moderation.service.js';
import { getIO } from '../../sockets/index.js';

export async function joinQueue(userId, writingType, theme = 'classic') {
  const existing = await MatchQueueEntry.findOne({ user: userId });
  if (existing) {
    if (existing.writingType !== writingType || existing.theme !== theme) {
      existing.writingType = writingType;
      existing.theme = theme;
      await existing.save();
    }
    return { matched: false };
  }

  // Atomically claim a waiting partner of the same type, if one exists —
  // excluding both the caller and anyone blocked in either direction.
  const excludedIds = await getMutuallyBlockedIds(userId);
  const partnerEntry = await MatchQueueEntry.findOneAndDelete({
    writingType,
    user: { $nin: [userId, ...excludedIds] },
  });

  if (!partnerEntry) {
    await MatchQueueEntry.create({ user: userId, writingType, theme });
    return { matched: false };
  }

  const participantIds = [userId, partnerEntry.user];
  const turnOwner = participantIds[Math.round(Math.random())];
  // Quick Match only pairs on writingType (adding theme to the match
  // criteria would fragment the queue and slow down matching); the two
  // matched strangers' theme preferences are resolved with the same 50/50
  // coin flip already used for turnOwner, rather than either one winning.
  const resolvedTheme = Math.random() < 0.5 ? theme : partnerEntry.theme;

  const collaboration = await Collaboration.create({
    participants: participantIds.map((id) => ({ user: id })),
    writingType,
    theme: resolvedTheme,
    turnOwner,
    keywords: await generateKeywords(writingType, resolvedTheme),
  });

  getIO().to(`user:${partnerEntry.user}`).emit('matchmaking:matched', {
    collaborationId: collaboration._id,
  });

  return { matched: true, collaborationId: collaboration._id };
}

export async function cancel(userId) {
  await MatchQueueEntry.deleteOne({ user: userId });
}

export async function getStatus(userId) {
  const entry = await MatchQueueEntry.findOne({ user: userId });
  return {
    waiting: Boolean(entry),
    writingType: entry?.writingType ?? null,
    theme: entry?.theme ?? null,
  };
}
