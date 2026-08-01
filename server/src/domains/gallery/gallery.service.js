import { Collaboration } from '../collaboration/collaboration.model.js';
import { ApiError } from '../../utils/ApiError.js';

const EXCERPT_LENGTH = 150;

function stripTags(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildExcerpt(entries) {
  const text = entries.map((e) => stripTags(e.content)).join(' ');
  return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH).trim()}…` : text;
}

// The only place a participant's real name is decided to be shown or
// withheld — computed here, server-side, before any response is built.
// Never send a raw displayName for a non-consenting participant and rely on
// the frontend to hide it; that's the exact class of bug already avoided
// once in this codebase (never leaking email via collaboration.service.js's
// PARTICIPANT_POPULATE). Applied uniformly to both the piece-level author
// list and each individual turn's author, since a consenting toggle would be
// pointless if a reader could still see the name on every entry.
function buildDisplayNameMap(participants) {
  const map = new Map();
  for (const p of participants) {
    map.set(
      p.user._id.toString(),
      p.hasConsentedToPublish ? p.user.displayName : 'Anonymous collaborator'
    );
  }
  return map;
}

// Shared with the profile domain (a user's own portfolio is just their
// published pieces, filtered down) so the summary shape and consent-respecting
// byline logic only live in one place.
export function summarizePiece(collaboration) {
  const nameMap = buildDisplayNameMap(collaboration.participants);
  return {
    id: collaboration._id,
    writingType: collaboration.writingType,
    theme: collaboration.theme,
    publishedAt: collaboration.publishedAt,
    excerpt: buildExcerpt(collaboration.entries),
    authors: collaboration.participants.map((p) => nameMap.get(p.user._id.toString())),
  };
}

export async function listPublished({ page = 1, limit = 10, writingType, theme } = {}) {
  const query = { isPublished: true };
  if (writingType) query.writingType = writingType;
  if (theme) query.theme = theme;

  const skip = (page - 1) * limit;

  const [collaborations, total] = await Promise.all([
    Collaboration.find(query)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('participants.user', 'displayName'),
    Collaboration.countDocuments(query),
  ]);

  return {
    items: collaborations.map(summarizePiece),
    hasMore: skip + collaborations.length < total,
    total,
  };
}

export async function getPublished(collaborationId) {
  const collaboration = await Collaboration.findOne({ _id: collaborationId, isPublished: true })
    .populate('participants.user', 'displayName')
    .populate('entries.author', 'displayName');
  if (!collaboration) {
    throw new ApiError(404, 'This piece is not published');
  }

  const nameMap = buildDisplayNameMap(collaboration.participants);

  return {
    id: collaboration._id,
    writingType: collaboration.writingType,
    theme: collaboration.theme,
    keywords: collaboration.keywords,
    publishedAt: collaboration.publishedAt,
    authors: collaboration.participants.map((p) => nameMap.get(p.user._id.toString())),
    entries: collaboration.entries.map((e) => ({
      content: e.content,
      submittedAt: e.submittedAt,
      author: { displayName: nameMap.get(e.author._id.toString()) },
    })),
  };
}
