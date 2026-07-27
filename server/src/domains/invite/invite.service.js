import { Invite } from './invite.model.js';
import { Collaboration } from '../collaboration/collaboration.model.js';
import { generateKeywords } from '../ai/ai.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { generateRawToken } from '../../utils/tokens.js';
import { getIO } from '../../sockets/index.js';

export async function createInvite(userId, writingType) {
  const invite = await Invite.create({
    creator: userId,
    writingType,
    code: generateRawToken(),
  });
  return invite;
}

export async function redeemInvite(userId, code) {
  const invite = await Invite.findOne({ code, status: 'pending' });
  if (!invite) {
    throw new ApiError(404, 'Invite not found or already used');
  }
  if (invite.creator.toString() === userId.toString()) {
    throw new ApiError(400, "You can't redeem your own invite");
  }

  const participantIds = [invite.creator, userId];
  const turnOwner = participantIds[Math.round(Math.random())];

  const collaboration = await Collaboration.create({
    participants: participantIds.map((id) => ({ user: id })),
    writingType: invite.writingType,
    turnOwner,
    keywords: await generateKeywords(invite.writingType),
  });

  invite.status = 'redeemed';
  invite.collaboration = collaboration._id;
  await invite.save();

  getIO().to(`user:${invite.creator}`).emit('invite:redeemed', {
    collaborationId: collaboration._id,
  });

  return { collaborationId: collaboration._id };
}

export async function cancelInvite(userId, inviteId) {
  const invite = await Invite.findById(inviteId);
  if (!invite || invite.creator.toString() !== userId.toString()) {
    throw new ApiError(403, 'You do not own this invite');
  }
  if (invite.status !== 'pending') {
    throw new ApiError(409, 'This invite is no longer pending');
  }
  await invite.deleteOne();
}

export async function getMine(userId) {
  const invites = await Invite.find({ creator: userId }).sort({ createdAt: -1 });
  return invites.map((i) => ({
    id: i._id,
    writingType: i.writingType,
    code: i.code,
    status: i.status,
    createdAt: i.createdAt,
  }));
}
