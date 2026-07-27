import { ChatMessage } from './chat.model.js';
import { Collaboration } from '../collaboration/collaboration.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { getIO } from '../../sockets/index.js';

async function requireParticipant(userId, collaborationId) {
  const collaboration = await Collaboration.findById(collaborationId).select('participants');
  const isParticipant =
    collaboration && collaboration.participants.some((p) => p.user.toString() === userId.toString());
  if (!isParticipant) {
    throw new ApiError(403, 'You are not a participant in this collaboration');
  }
  return collaboration;
}

export async function sendMessage(userId, collaborationId, content) {
  const collaboration = await requireParticipant(userId, collaborationId);

  const trimmedContent = content?.trim();
  if (!trimmedContent) {
    throw new ApiError(400, 'Content is required');
  }

  const message = await ChatMessage.create({
    collaboration: collaborationId,
    sender: userId,
    content: trimmedContent,
  });
  await message.populate('sender', 'displayName');

  const io = getIO();
  for (const participant of collaboration.participants) {
    io.to(`user:${participant.user}`).emit('chat:message', message);
  }

  return message;
}

export async function getHistory(userId, collaborationId) {
  await requireParticipant(userId, collaborationId);

  return ChatMessage.find({ collaboration: collaborationId })
    .sort({ createdAt: 1 })
    .populate('sender', 'displayName');
}
