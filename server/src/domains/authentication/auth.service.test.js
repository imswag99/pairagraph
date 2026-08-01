import 'dotenv/config';
import { test, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from './auth.model.js';
import { mailer } from '../../utils/mailer.js';
import { turnstile } from '../../utils/turnstile.js';
import * as authService from './auth.service.js';

const RUN_ID = `auth-test-${Date.now()}`;
const email = (suffix) => `${RUN_ID}-${suffix}@example.com`;
// The delete-account test mutates its user's email away from the RUN_ID
// pattern, so ids are tracked explicitly rather than relying on email cleanup alone.
const createdUserIds = [];

before(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
});

after(async () => {
  await User.deleteMany({
    $or: [{ email: new RegExp(`^${RUN_ID}`) }, { _id: { $in: createdUserIds } }],
  });
  await mongoose.connection.close();
});

beforeEach(() => {
  mock.method(mailer, 'sendVerificationEmail', async () => {});
  mock.method(mailer, 'sendPasswordResetEmail', async () => {});
  mock.method(mailer, 'sendGoogleAccountNoticeEmail', async () => {});
  mock.method(turnstile, 'verifyToken', async () => true);
});

test('register creates a user and emails a verification link, without leaking the password hash', async () => {
  const user = await authService.register({
    email: email('register'),
    password: 'correct-horse-1',
    displayName: 'Register Test',
  });

  assert.equal(user.displayName, 'Register Test');
  assert.equal(user.isEmailVerified, false);
  assert.equal(mailer.sendVerificationEmail.mock.calls.length, 1);
  assert.ok(!('passwordHash' in user));
});

test('register rejects when CAPTCHA verification fails', async () => {
  mock.method(turnstile, 'verifyToken', async () => false);

  await assert.rejects(
    () =>
      authService.register({
        email: email('captcha-fail'),
        password: 'correct-horse-1',
        displayName: 'Captcha Fail',
      }),
    (err) => err.statusCode === 400
  );

  const stored = await User.findOne({ email: email('captcha-fail') });
  assert.equal(stored, null);
});

test('register rejects a duplicate email', async () => {
  const dupEmail = email('dup');
  await authService.register({ email: dupEmail, password: 'correct-horse-1', displayName: 'A' });

  await assert.rejects(
    () => authService.register({ email: dupEmail, password: 'correct-horse-1', displayName: 'B' }),
    (err) => err.statusCode === 409
  );
});

test('login is blocked before the email is verified', async () => {
  const loginEmail = email('unverified-login');
  await authService.register({
    email: loginEmail,
    password: 'correct-horse-1',
    displayName: 'Unverified',
  });

  await assert.rejects(
    () => authService.login({ email: loginEmail, password: 'correct-horse-1' }),
    (err) => err.statusCode === 403
  );
});

test('verifyEmail rejects a bad token', async () => {
  await assert.rejects(
    () => authService.verifyEmail('not-a-real-token'),
    (err) => err.statusCode === 400
  );
});

test('verifyEmail with the real token unlocks login', async () => {
  const loginEmail = email('verify-then-login');
  await authService.register({
    email: loginEmail,
    password: 'correct-horse-1',
    displayName: 'Verify Flow',
  });
  const rawToken = mailer.sendVerificationEmail.mock.calls.at(-1).arguments[1];

  const verified = await authService.verifyEmail(rawToken);
  assert.equal(verified.isEmailVerified, true);

  const { user, accessToken, refreshToken } = await authService.login({
    email: loginEmail,
    password: 'correct-horse-1',
  });
  assert.equal(user.email, loginEmail);
  assert.ok(accessToken);
  assert.ok(refreshToken);
});

test('login rejects the wrong password', async () => {
  const loginEmail = email('wrong-password');
  await authService.register({
    email: loginEmail,
    password: 'correct-horse-1',
    displayName: 'Wrong Password',
  });
  const rawToken = mailer.sendVerificationEmail.mock.calls.at(-1).arguments[1];
  await authService.verifyEmail(rawToken);

  await assert.rejects(
    () => authService.login({ email: loginEmail, password: 'totally-wrong' }),
    (err) => err.statusCode === 401
  );
});

test('login rejects a banned account, even with the correct password', async () => {
  const loginEmail = email('banned-login');
  await authService.register({
    email: loginEmail,
    password: 'correct-horse-1',
    displayName: 'Banned',
  });
  const rawToken = mailer.sendVerificationEmail.mock.calls.at(-1).arguments[1];
  await authService.verifyEmail(rawToken);
  await User.updateOne({ email: loginEmail }, { isBanned: true });

  await assert.rejects(
    () => authService.login({ email: loginEmail, password: 'correct-horse-1' }),
    (err) => err.statusCode === 403
  );
});

test('requestPasswordReset silently no-ops for an unknown email', async () => {
  await authService.requestPasswordReset(email('does-not-exist'));
  assert.equal(mailer.sendPasswordResetEmail.mock.calls.length, 0);
  assert.equal(mailer.sendGoogleAccountNoticeEmail.mock.calls.length, 0);
});

test('requestPasswordReset sends the Google notice for a Google-only account', async () => {
  const googleEmail = email('google-only');
  await User.create({
    displayName: 'Google User',
    email: googleEmail,
    authProvider: 'google',
    googleId: `${RUN_ID}-google-id`,
    isEmailVerified: true,
  });

  await authService.requestPasswordReset(googleEmail);
  assert.equal(mailer.sendGoogleAccountNoticeEmail.mock.calls.length, 1);
  assert.equal(mailer.sendPasswordResetEmail.mock.calls.length, 0);
});

test('resetPassword rejects an invalid token', async () => {
  await assert.rejects(
    () => authService.resetPassword('not-a-real-token', 'brand-new-password-1'),
    (err) => err.statusCode === 400
  );
});

test('reset password end-to-end: request -> reset -> login with new password, old sessions invalidated', async () => {
  const resetEmail = email('reset-flow');
  await authService.register({
    email: resetEmail,
    password: 'original-password-1',
    displayName: 'Reset Flow',
  });
  const verifyToken = mailer.sendVerificationEmail.mock.calls.at(-1).arguments[1];
  await authService.verifyEmail(verifyToken);
  await authService.login({ email: resetEmail, password: 'original-password-1' });

  await authService.requestPasswordReset(resetEmail);
  const resetToken = mailer.sendPasswordResetEmail.mock.calls.at(-1).arguments[1];

  const updated = await authService.resetPassword(resetToken, 'brand-new-password-1');
  assert.equal(updated.email, resetEmail);

  const stored = await User.findOne({ email: resetEmail });
  assert.equal(stored.refreshTokenHash, null);

  await assert.rejects(
    () => authService.login({ email: resetEmail, password: 'original-password-1' }),
    (err) => err.statusCode === 401
  );

  const { user } = await authService.login({ email: resetEmail, password: 'brand-new-password-1' });
  assert.equal(user.email, resetEmail);
});

test('updateProfile changes the display name', async () => {
  const user = await User.create({
    displayName: 'Old Name',
    email: email('profile'),
    passwordHash: 'irrelevant',
    authProvider: 'local',
    isEmailVerified: true,
  });

  const updated = await authService.updateProfile(user._id, { displayName: 'New Name' });
  assert.equal(updated.displayName, 'New Name');
});

test('setProfileVisibility toggles isProfilePublic', async () => {
  const user = await User.create({
    displayName: 'Visibility Test',
    email: email('profile-visibility'),
    passwordHash: 'irrelevant',
    authProvider: 'local',
    isEmailVerified: true,
  });

  const madePublic = await authService.setProfileVisibility(user._id, true);
  assert.equal(madePublic.isProfilePublic, true);

  const madePrivate = await authService.setProfileVisibility(user._id, false);
  assert.equal(madePrivate.isProfilePublic, false);
});

test('changePassword rejects an incorrect current password', async () => {
  const registerEmail = email('change-pw-wrong');
  await authService.register({
    email: registerEmail,
    password: 'correct-horse-1',
    displayName: 'Change PW',
  });
  const user = await User.findOne({ email: registerEmail });

  await assert.rejects(
    () => authService.changePassword(user._id, { currentPassword: 'nope', newPassword: 'new-password-1' }),
    (err) => err.statusCode === 401
  );
});

test('changePassword refuses a Google-only account with no password set', async () => {
  const user = await User.create({
    displayName: 'Google No Password',
    email: email('google-no-password'),
    authProvider: 'google',
    googleId: `${RUN_ID}-google-id-2`,
    isEmailVerified: true,
  });

  await assert.rejects(
    () =>
      authService.changePassword(user._id, {
        currentPassword: 'anything',
        newPassword: 'new-password-1',
      }),
    (err) => err.statusCode === 400
  );
});

test('changePassword succeeds with the correct current password and the new password logs in', async () => {
  const registerEmail = email('change-pw-ok');
  await authService.register({
    email: registerEmail,
    password: 'correct-horse-1',
    displayName: 'Change PW OK',
  });
  const verifyToken = mailer.sendVerificationEmail.mock.calls.at(-1).arguments[1];
  await authService.verifyEmail(verifyToken);
  const user = await User.findOne({ email: registerEmail });

  await authService.changePassword(user._id, {
    currentPassword: 'correct-horse-1',
    newPassword: 'new-password-1',
  });

  const { user: loggedIn } = await authService.login({
    email: registerEmail,
    password: 'new-password-1',
  });
  assert.equal(loggedIn.email, registerEmail);
});

test('recordCompletionActivity increments totals, starts a streak, and awards the first-completion badge', async () => {
  const user = await User.create({
    displayName: 'Streak Test',
    email: email('streak-first'),
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
  });

  const updated = await authService.recordCompletionActivity(user._id, { writingType: 'story' });

  assert.equal(updated.totalCompletions, 1);
  assert.equal(updated.storyCompletions, 1);
  assert.equal(updated.currentStreak, 1);
  assert.equal(updated.longestStreak, 1);
  assert.ok(updated.badges.includes('first_completion'));
});

test('recordCompletionActivity extends the streak on a consecutive day and resets it after a gap', async () => {
  const user = await User.create({
    displayName: 'Streak Test 2',
    email: email('streak-gap'),
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
    currentStreak: 3,
    longestStreak: 3,
    lastActiveDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
  });

  const consecutive = await authService.recordCompletionActivity(user._id, { writingType: 'story' });
  assert.equal(consecutive.currentStreak, 4);
  assert.equal(consecutive.longestStreak, 4);

  await User.findByIdAndUpdate(user._id, {
    lastActiveDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  });
  const afterGap = await authService.recordCompletionActivity(user._id, { writingType: 'story' });
  assert.equal(afterGap.currentStreak, 1);
  assert.equal(afterGap.longestStreak, 4, 'longest streak is preserved after a reset');
});

test('recordCompletionActivity awards both_genres and the genre-specialist badges at their thresholds', async () => {
  const user = await User.create({
    displayName: 'Genre Test',
    email: email('both-genres'),
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
    storyCompletions: 9,
  });

  const afterStory = await authService.recordCompletionActivity(user._id, { writingType: 'story' });
  assert.ok(!afterStory.badges.includes('both_genres'));
  assert.ok(afterStory.badges.includes('story_specialist'), 'story_specialist unlocks at 10 stories');

  const afterPoem = await authService.recordCompletionActivity(user._id, { writingType: 'poem' });
  assert.ok(afterPoem.badges.includes('both_genres'));
  assert.ok(!afterPoem.badges.includes('poem_specialist'), 'only 1 poem so far, not 10');
});

test('recordCompletionActivity awards completion and streak milestone badges at their thresholds', async () => {
  const user = await User.create({
    displayName: 'Milestone Test',
    email: email('milestones'),
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
    totalCompletions: 9,
    currentStreak: 6,
    longestStreak: 6,
    lastActiveDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
  });

  const updated = await authService.recordCompletionActivity(user._id, { writingType: 'story' });
  assert.equal(updated.totalCompletions, 10);
  assert.equal(updated.currentStreak, 7);
  assert.ok(updated.badges.includes('ten_completions'));
  assert.ok(updated.badges.includes('streak_7'));
  assert.ok(!updated.badges.includes('twentyfive_completions'));
  assert.ok(!updated.badges.includes('streak_14'));
});

test('recordCompletionActivity awards social_butterfly after 5 distinct partners', async () => {
  const user = await User.create({
    displayName: 'Social Test',
    email: email('social-butterfly'),
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
  });
  const partnerIds = [
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
  ];

  for (const partnerId of partnerIds) {
    const updated = await authService.recordCompletionActivity(user._id, {
      writingType: 'story',
      partnerId,
    });
    assert.ok(!updated.badges.includes('social_butterfly'));
  }

  // A repeat partner must not count toward the distinct-partner threshold.
  await authService.recordCompletionActivity(user._id, { writingType: 'story', partnerId: partnerIds[0] });

  const withFifthPartner = await authService.recordCompletionActivity(user._id, {
    writingType: 'story',
    partnerId: new mongoose.Types.ObjectId(),
  });
  assert.ok(withFifthPartner.badges.includes('social_butterfly'));
});

test('recordCompletionActivity awards marathon_writer when a single turn count meets the threshold', async () => {
  const user = await User.create({
    displayName: 'Marathon Test',
    email: email('marathon-writer'),
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
  });

  const short = await authService.recordCompletionActivity(user._id, {
    writingType: 'story',
    turnCount: 3,
  });
  assert.ok(!short.badges.includes('marathon_writer'));

  const long = await authService.recordCompletionActivity(user._id, {
    writingType: 'story',
    turnCount: 15,
  });
  assert.ok(long.badges.includes('marathon_writer'));
});

test('deleteAccount anonymizes the user record', async () => {
  const registerEmail = email('delete-me');
  await authService.register({
    email: registerEmail,
    password: 'correct-horse-1',
    displayName: 'Delete Me',
  });
  const user = await User.findOne({ email: registerEmail });
  createdUserIds.push(user._id);

  await authService.deleteAccount(user._id);

  const stored = await User.findById(user._id);
  assert.equal(stored.displayName, 'Deleted user');
  assert.equal(stored.isDeleted, true);
  assert.equal(stored.passwordHash, undefined);
  assert.notEqual(stored.email, registerEmail);
});
