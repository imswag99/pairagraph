import { MatchQueueEntry } from './matchmaking.model.js';
import { Collaboration } from '../collaboration/collaboration.model.js';
import { generateKeywords } from '../ai/ai.service.js';
import { getMutuallyBlockedIds } from '../moderation/moderation.service.js';
import { getIO } from '../../sockets/index.js';

export async function joinQueue(userId, writingType) {
  const existing = await MatchQueueEntry.findOne({ user: userId });
  if (existing) {
    if (existing.writingType !== writingType) {
      existing.writingType = writingType;
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
    await MatchQueueEntry.create({ user: userId, writingType });
    return { matched: false };
  }

  const participantIds = [userId, partnerEntry.user];
  const turnOwner = participantIds[Math.round(Math.random())];

  const collaboration = await Collaboration.create({
    participants: participantIds.map((id) => ({ user: id })),
    writingType,
    turnOwner,
    keywords: await generateKeywords(writingType),
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
  return { waiting: Boolean(entry), writingType: entry?.writingType ?? null };
}
