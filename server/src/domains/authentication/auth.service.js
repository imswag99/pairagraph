import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { User } from './auth.model.js';
import { Invite } from '../invite/invite.model.js';
import { MatchQueueEntry } from '../matchmaking/matchmaking.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { mailer } from '../../utils/mailer.js';
import { logger } from '../../utils/logger.js';
import { turnstile } from '../../utils/turnstile.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateRawToken,
  hashToken,
} from '../../utils/tokens.js';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function toSafeUser(user) {
  return {
    id: user._id,
    displayName: user.displayName,
    email: user.email,
    authProvider: user.authProvider,
    isEmailVerified: user.isEmailVerified,
    hasPassword: Boolean(user.passwordHash),
    role: user.role,
    totalCompletions: user.totalCompletions,
    storyCompletions: user.storyCompletions,
    poemCompletions: user.poemCompletions,
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    badges: user.badges,
  };
}

const COMPLETION_MILESTONES = {
  first_completion: 1,
  ten_completions: 10,
  twentyfive_completions: 25,
  fifty_completions: 50,
};

const STREAK_MILESTONES = {
  streak_3: 3,
  streak_7: 7,
  streak_14: 14,
  streak_30: 30,
};

const GENRE_SPECIALIST_THRESHOLD = 10;
const SOCIAL_BUTTERFLY_PARTNER_THRESHOLD = 5;
const MARATHON_WRITER_TURN_THRESHOLD = 15;

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Called once per participant, right alongside awardCompletionPoints, when a
// collaboration completes. Tracks streaks/badges as denormalized counters on
// User rather than deriving them from the leaderboard's PointsEntry ledger,
// so this stays entirely within the auth domain's own model.
export async function recordCompletionActivity(userId, { writingType, partnerId, turnCount = 0 }) {
  const user = await User.findById(userId);
  if (!user) return null;

  user.totalCompletions += 1;
  if (writingType === 'story') user.storyCompletions += 1;
  if (writingType === 'poem') user.poemCompletions += 1;

  if (partnerId && !user.partners.some((id) => String(id) === String(partnerId))) {
    user.partners.push(partnerId);
  }

  const today = startOfUtcDay(new Date());
  const lastActive = user.lastActiveDate ? startOfUtcDay(user.lastActiveDate) : null;
  const dayDiff = lastActive ? Math.round((today - lastActive) / (24 * 60 * 60 * 1000)) : null;

  if (dayDiff === 1) {
    user.currentStreak += 1;
  } else if (dayDiff !== 0) {
    user.currentStreak = 1;
  }
  user.longestStreak = Math.max(user.longestStreak, user.currentStreak);
  user.lastActiveDate = today;

  const earned = new Set(user.badges);
  for (const [badge, threshold] of Object.entries(COMPLETION_MILESTONES)) {
    if (user.totalCompletions === threshold) earned.add(badge);
  }
  for (const [badge, threshold] of Object.entries(STREAK_MILESTONES)) {
    if (user.currentStreak === threshold) earned.add(badge);
  }
  if (user.storyCompletions >= 1 && user.poemCompletions >= 1) earned.add('both_genres');
  if (user.storyCompletions >= GENRE_SPECIALIST_THRESHOLD) earned.add('story_specialist');
  if (user.poemCompletions >= GENRE_SPECIALIST_THRESHOLD) earned.add('poem_specialist');
  if (user.partners.length >= SOCIAL_BUTTERFLY_PARTNER_THRESHOLD) earned.add('social_butterfly');
  if (turnCount >= MARATHON_WRITER_TURN_THRESHOLD) earned.add('marathon_writer');
  user.badges = Array.from(earned);

  await user.save();
  return user;
}

async function issueTokens(user) {
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();
  return { accessToken, refreshToken };
}

export async function register({ email, password, displayName, captchaToken, ip }) {
  const isHuman = await turnstile.verifyToken(captchaToken, ip);
  if (!isHuman) {
    throw new ApiError(400, 'CAPTCHA verification failed. Please try again.');
  }

  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const rawVerificationToken = generateRawToken();

  const user = await User.create({
    displayName,
    email,
    passwordHash,
    authProvider: 'local',
    isEmailVerified: false,
    emailVerificationTokenHash: hashToken(rawVerificationToken),
    emailVerificationExpires: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
  });

  await mailer.sendVerificationEmail(user.email, rawVerificationToken);

  return toSafeUser(user);
}

export async function verifyEmail(rawToken) {
  const user = await User.findOne({
    emailVerificationTokenHash: hashToken(rawToken),
    emailVerificationExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new ApiError(400, 'Verification link is invalid or has expired');
  }

  user.isEmailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  return toSafeUser(user);
}

export async function login({ email, password }) {
  const user = await User.findOne({ email });
  if (!user || user.authProvider !== 'local' || !user.passwordHash) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid email or password');
  }

  if (user.isBanned) {
    throw new ApiError(403, 'This account has been suspended.');
  }

  if (!user.isEmailVerified) {
    throw new ApiError(403, 'Please verify your email before logging in');
  }

  const tokens = await issueTokens(user);
  return { user: toSafeUser(user), ...tokens };
}

export async function googleLogin(idToken) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  let user = await User.findOne({ googleId: payload.sub });

  if (!user) {
    // An account with this email may already exist from local registration —
    // link Google to it instead of trying to create a second user with the
    // same email, which would collide with the unique email index.
    user = await User.findOne({ email: payload.email });

    if (user) {
      user.googleId = payload.sub;
      user.isEmailVerified = true;
      await user.save();
    } else {
      user = await User.create({
        displayName: payload.name,
        email: payload.email,
        authProvider: 'google',
        googleId: payload.sub,
        isEmailVerified: true,
      });
    }
  }

  if (user.isBanned) {
    throw new ApiError(403, 'This account has been suspended.');
  }

  const tokens = await issueTokens(user);
  return { user: toSafeUser(user), ...tokens };
}

export async function refresh(rawRefreshToken) {
  if (!rawRefreshToken) {
    throw new ApiError(401, 'Missing refresh token');
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const user = await User.findById(decoded.sub);
  if (!user || user.refreshTokenHash !== hashToken(rawRefreshToken)) {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const tokens = await issueTokens(user);
  return { user: toSafeUser(user), ...tokens };
}

export async function logout(userId) {
  await User.findByIdAndUpdate(userId, { refreshTokenHash: null });
}

export async function getMe(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return toSafeUser(user);
}

// Always resolves without revealing whether the email exists, to avoid leaking
// account existence — the branch (real reset link vs. "use Google instead")
// only affects which email gets sent, never the caller-visible outcome.
export async function requestPasswordReset(email) {
  const user = await User.findOne({ email });
  if (!user) return;

  if (user.authProvider === 'google' && !user.passwordHash) {
    mailer.sendGoogleAccountNoticeEmail(user.email).catch((err) => {
      logger.error('Failed to send Google-account notice email', { error: err.body ?? err.message });
    });
    return;
  }

  const rawToken = generateRawToken();
  user.passwordResetTokenHash = hashToken(rawToken);
  user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  await user.save();

  mailer.sendPasswordResetEmail(user.email, rawToken).catch((err) => {
    logger.error('Failed to send password reset email', { error: err.body ?? err.message });
  });
}

export async function resetPassword(rawToken, newPassword) {
  const user = await User.findOne({
    passwordResetTokenHash: hashToken(rawToken),
    passwordResetExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new ApiError(400, 'Reset link is invalid or has expired');
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokenHash = null; // reset invalidates any existing sessions
  await user.save();

  return toSafeUser(user);
}

export async function updateProfile(userId, { displayName }) {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  user.displayName = displayName;
  await user.save();
  return toSafeUser(user);
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  if (!user.passwordHash) {
    throw new ApiError(
      400,
      'This account has no password yet. Use "Forgot password" to set one.'
    );
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    throw new ApiError(401, 'Current password is incorrect');
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
}

// Anonymizes rather than hard-deletes, so existing collaborations/chat
// messages this user participated in keep resolving a valid (if scrubbed)
// author reference instead of a dangling one the other participant would hit.
export async function deleteAccount(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  user.displayName = 'Deleted user';
  user.email = `deleted-${user._id}@pairagraph.invalid`;
  user.passwordHash = undefined;
  user.googleId = undefined;
  user.refreshTokenHash = null;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpires = undefined;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.isDeleted = true;
  await user.save();

  await Invite.updateMany(
    { creator: userId, status: 'pending' },
    { status: 'cancelled' }
  );
  await MatchQueueEntry.deleteOne({ user: userId });
}
