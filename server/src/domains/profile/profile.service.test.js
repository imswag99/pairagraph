import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from '../authentication/auth.model.js';
import { Collaboration } from '../collaboration/collaboration.model.js';
import * as profileService from './profile.service.js';

const RUN_ID = `profile-test-${Date.now()}`;
let publicUser;
let privateUser;
let bannedUser;
let partner;

before(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  [publicUser, privateUser, bannedUser, partner] = await Promise.all([
    User.create({
      displayName: 'Profile Alice',
      email: `${RUN_ID}-alice@example.com`,
      authProvider: 'local',
      passwordHash: 'irrelevant',
      isEmailVerified: true,
      isProfilePublic: true,
      totalCompletions: 3,
      storyCompletions: 2,
      poemCompletions: 1,
      currentStreak: 2,
      longestStreak: 4,
      badges: ['first_completion'],
      partners: [new mongoose.Types.ObjectId()],
    }),
    User.create({
      displayName: 'Profile Bob',
      email: `${RUN_ID}-bob@example.com`,
      authProvider: 'local',
      passwordHash: 'irrelevant',
      isEmailVerified: true,
      isProfilePublic: false,
    }),
    User.create({
      displayName: 'Profile Carol',
      email: `${RUN_ID}-carol@example.com`,
      authProvider: 'local',
      passwordHash: 'irrelevant',
      isEmailVerified: true,
      isProfilePublic: true,
      isBanned: true,
    }),
    User.create({
      displayName: 'Profile Partner',
      email: `${RUN_ID}-partner@example.com`,
      authProvider: 'local',
      passwordHash: 'irrelevant',
      isEmailVerified: true,
    }),
  ]);
});

after(async () => {
  const ids = [publicUser._id, privateUser._id, bannedUser._id, partner._id];
  await Collaboration.deleteMany({ 'participants.user': { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });
  await mongoose.connection.close();
});

test('getPublicProfile 404s for a user who has not opted into a public profile', async () => {
  await assert.rejects(
    () => profileService.getPublicProfile(privateUser._id),
    (err) => err.statusCode === 404
  );
});

test('getPublicProfile 404s for a nonexistent user', async () => {
  await assert.rejects(
    () => profileService.getPublicProfile(new mongoose.Types.ObjectId()),
    (err) => err.statusCode === 404
  );
});

test('getPublicProfile 404s for a banned user even with isProfilePublic true', async () => {
  await assert.rejects(
    () => profileService.getPublicProfile(bannedUser._id),
    (err) => err.statusCode === 404
  );
});

test('getPublicProfile returns stats, badges, and partner count for a public profile', async () => {
  const profile = await profileService.getPublicProfile(publicUser._id);

  assert.equal(profile.displayName, 'Profile Alice');
  assert.equal(profile.totalCompletions, 3);
  assert.equal(profile.storyCompletions, 2);
  assert.equal(profile.poemCompletions, 1);
  assert.equal(profile.currentStreak, 2);
  assert.equal(profile.longestStreak, 4);
  assert.deepEqual(profile.badges, ['first_completion']);
  assert.equal(profile.partnerCount, 1);
});

test('getPublicProfile only lists pieces this user personally consented to publish', async () => {
  const consented = await Collaboration.create({
    participants: [
      { user: publicUser._id, hasConsentedToPublish: true },
      { user: partner._id, hasConsentedToPublish: false },
    ],
    writingType: 'story',
    turnOwner: publicUser._id,
    status: 'completed',
    entries: [{ author: publicUser._id, content: '<p>Consented piece.</p>' }],
    isPublished: true,
    publishedAt: new Date(),
  });
  const notConsented = await Collaboration.create({
    participants: [
      { user: publicUser._id, hasConsentedToPublish: false },
      { user: partner._id, hasConsentedToPublish: true },
    ],
    writingType: 'story',
    turnOwner: publicUser._id,
    status: 'completed',
    entries: [{ author: partner._id, content: '<p>Not consented by Alice.</p>' }],
    isPublished: true,
    publishedAt: new Date(),
  });
  const unpublished = await Collaboration.create({
    participants: [
      { user: publicUser._id, hasConsentedToPublish: true },
      { user: partner._id, hasConsentedToPublish: true },
    ],
    writingType: 'story',
    turnOwner: publicUser._id,
    status: 'completed',
    entries: [{ author: publicUser._id, content: '<p>Never published.</p>' }],
    isPublished: false,
  });

  const profile = await profileService.getPublicProfile(publicUser._id);
  const pieceIds = profile.pieces.map((p) => p.id.toString());

  assert.ok(pieceIds.includes(consented._id.toString()));
  assert.ok(!pieceIds.includes(notConsented._id.toString()));
  assert.ok(!pieceIds.includes(unpublished._id.toString()));
});
