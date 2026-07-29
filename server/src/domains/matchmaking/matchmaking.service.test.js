import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from '../authentication/auth.model.js';
import { MatchQueueEntry } from './matchmaking.model.js';
import { Collaboration } from '../collaboration/collaboration.model.js';
import * as matchmakingService from './matchmaking.service.js';
import { startTestSocket } from '../../testUtils/testSocket.js';

const RUN_ID = `match-test-${Date.now()}`;
let testSocket;
let userA;
let userB;
let userC;

before(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  testSocket = startTestSocket();

  userA = await User.create({
    displayName: 'Match Alice',
    email: `${RUN_ID}-alice@example.com`,
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
  });
  userB = await User.create({
    displayName: 'Match Bob',
    email: `${RUN_ID}-bob@example.com`,
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
  });
  userC = await User.create({
    displayName: 'Match Carol',
    email: `${RUN_ID}-carol@example.com`,
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
  });
});

after(async () => {
  await MatchQueueEntry.deleteMany({ user: { $in: [userA._id, userB._id, userC._id] } });
  await Collaboration.deleteMany({ 'participants.user': { $in: [userA._id, userB._id, userC._id] } });
  await User.deleteMany({ _id: { $in: [userA._id, userB._id, userC._id] } });
  await testSocket.close();
  await mongoose.connection.close();
});

test('joining alone waits rather than matching', async () => {
  const result = await matchmakingService.joinQueue(userA._id, 'story');
  assert.equal(result.matched, false);

  const entry = await MatchQueueEntry.findOne({ user: userA._id });
  assert.ok(entry);
  assert.equal(entry.writingType, 'story');

  await matchmakingService.cancel(userA._id);
});

test('a second, differently-typed request does not match', async () => {
  await matchmakingService.joinQueue(userA._id, 'story');
  const result = await matchmakingService.joinQueue(userB._id, 'poem');

  assert.equal(result.matched, false);

  await matchmakingService.cancel(userA._id);
  await matchmakingService.cancel(userB._id);
});

test('two same-type requests match and produce a collaboration', async () => {
  await matchmakingService.joinQueue(userA._id, 'story');
  const result = await matchmakingService.joinQueue(userB._id, 'story');

  assert.equal(result.matched, true);
  assert.ok(result.collaborationId);

  const collab = await Collaboration.findById(result.collaborationId);
  assert.equal(collab.writingType, 'story');

  const waitingEntry = await MatchQueueEntry.findOne({ user: userA._id });
  assert.equal(waitingEntry, null);
});

test('cancel removes a waiting queue entry', async () => {
  await matchmakingService.joinQueue(userA._id, 'poem');
  await matchmakingService.cancel(userA._id);

  const status = await matchmakingService.getStatus(userA._id);
  assert.equal(status.waiting, false);
});

test('getStatus reports the writing type while waiting', async () => {
  await matchmakingService.joinQueue(userA._id, 'poem');

  const status = await matchmakingService.getStatus(userA._id);
  assert.equal(status.waiting, true);
  assert.equal(status.writingType, 'poem');

  await matchmakingService.cancel(userA._id);
});

test('a blocked pair is skipped, but an unrelated third user still matches', async () => {
  await User.findByIdAndUpdate(userA._id, { $addToSet: { blockedUsers: userB._id } });

  await matchmakingService.joinQueue(userB._id, 'story');
  const skippedResult = await matchmakingService.joinQueue(userA._id, 'story');
  assert.equal(skippedResult.matched, false);

  // Both A and B are now waiting but mutually excluded from each other;
  // clear B out so C's join below deterministically pairs with A.
  await matchmakingService.cancel(userB._id);

  const matchedResult = await matchmakingService.joinQueue(userC._id, 'story');
  assert.equal(matchedResult.matched, true);

  const collab = await Collaboration.findById(matchedResult.collaborationId);
  const participantIds = collab.participants.map((p) => p.user.toString());
  assert.ok(participantIds.includes(userA._id.toString()));
  assert.ok(participantIds.includes(userC._id.toString()));

  await User.findByIdAndUpdate(userA._id, { $pull: { blockedUsers: userB._id } });
});
