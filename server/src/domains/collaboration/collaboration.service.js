import { Collaboration } from './collaboration.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { getIO } from '../../sockets/index.js';
import { awardCompletionPoints } from '../leaderboard/leaderboard.service.js';

const PARTICIPANT_POPULATE = { path: 'participants.user', select: 'displayName' };
const TURN_OWNER_POPULATE = { path: 'turnOwner', select: 'displayName' };
const ENTRY_AUTHOR_POPULATE = { path: 'entries.author', select: 'displayName' };

function isParticipant(collaboration, userId) {
  return collaboration.participants.some((p) => p.user.toString() === userId.toString());
}

function getOtherParticipant(collaboration, userId) {
  return collaboration.participants.find((p) => p.user.toString() !== userId.toString());
}

function stripTags(html) {
  return html.replace(/<[^>]*>/g, '').trim();
}

// The editor never lets a user create a second paragraph or a line break, but
// a client could bypass that UI restriction and POST arbitrary HTML directly —
// this is the server-side source of truth for "one line" (poem) / "one
// paragraph" (story) per turn.
function validateEntryContent(writingType, html) {
  const paragraphCount = (html.match(/<p[ >]/g) || []).length;
  if (paragraphCount > 1) {
    throw new ApiError(400, 'Only one paragraph is allowed per turn');
  }
  if (writingType === 'poem' && /<br\s*\/?>/.test(html)) {
    throw new ApiError(400, 'Only one line is allowed per turn for a poem');
  }
}

// Turn submissions and completion responses change state the other
// participant is looking at right now — push it live instead of making them
// refresh, same broadcast-to-both-rooms pattern chat messages already use.
function broadcastUpdate(collaboration) {
  const io = getIO();
  for (const participant of collaboration.participants) {
    io.to(`user:${participant.user._id}`).emit('collaboration:updated', collaboration);
  }
}

async function findAccessible(userId, collaborationId) {
  const collaboration = await Collaboration.findById(collaborationId);
  if (!collaboration || !isParticipant(collaboration, userId)) {
    throw new ApiError(403, 'You are not a participant in this collaboration');
  }
  return collaboration;
}

export async function getMine(userId) {
  const collaborations = await Collaboration.find({ 'participants.user': userId })
    .sort({ updatedAt: -1 })
    .populate(PARTICIPANT_POPULATE)
    .populate(TURN_OWNER_POPULATE);

  return collaborations.map((c) => ({
    id: c._id,
    writingType: c.writingType,
    status: c.status,
    turnOwner: c.turnOwner,
    participants: c.participants,
    entryCount: c.entries.length,
    updatedAt: c.updatedAt,
  }));
}

export async function getById(userId, collaborationId) {
  const collaboration = await findAccessible(userId, collaborationId);

  await collaboration.populate([PARTICIPANT_POPULATE, TURN_OWNER_POPULATE, ENTRY_AUTHOR_POPULATE]);

  return collaboration;
}

export async function submitTurn(userId, collaborationId, content) {
  const collaboration = await findAccessible(userId, collaborationId);

  if (collaboration.status !== 'in_progress') {
    throw new ApiError(409, 'This collaboration is no longer in progress');
  }
  if (collaboration.turnOwner.toString() !== userId.toString()) {
    throw new ApiError(403, "It's not your turn");
  }

  if (!content || !stripTags(content)) {
    throw new ApiError(400, 'Content is required');
  }
  validateEntryContent(collaboration.writingType, content);

  const otherParticipant = getOtherParticipant(collaboration, userId);

  collaboration.entries.push({ author: userId, content, submittedAt: new Date() });
  collaboration.turnOwner = otherParticipant.user;
  collaboration.participants.forEach((p) => {
    p.hasApproved = null;
  });

  await collaboration.save();
  await collaboration.populate([PARTICIPANT_POPULATE, TURN_OWNER_POPULATE, ENTRY_AUTHOR_POPULATE]);
  broadcastUpdate(collaboration);
  return collaboration;
}

export async function respondToCompletion(userId, collaborationId, approve) {
  const collaboration = await findAccessible(userId, collaborationId);

  if (collaboration.status !== 'in_progress') {
    throw new ApiError(409, 'This collaboration is no longer in progress');
  }

  const self = collaboration.participants.find((p) => p.user.toString() === userId.toString());
  const other = getOtherParticipant(collaboration, userId);

  self.hasApproved = approve;

  if (approve === false) {
    collaboration.status = 'private';
  } else if (other.hasApproved === true) {
    collaboration.status = 'completed';
  }

  const justCompleted = collaboration.status === 'completed';

  await collaboration.save();

  if (justCompleted) {
    await awardCompletionPoints(
      collaboration._id,
      collaboration.participants.map((p) => p.user)
    );
  }

  await collaboration.populate([PARTICIPANT_POPULATE, TURN_OWNER_POPULATE, ENTRY_AUTHOR_POPULATE]);
  broadcastUpdate(collaboration);
  return collaboration;
}
