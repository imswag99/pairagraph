import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from '../authentication/auth.model.js';
import { Collaboration } from './collaboration.model.js';
import { PointsEntry } from '../leaderboard/leaderboard.model.js';
import * as collaborationService from './collaboration.service.js';
import { startTestSocket } from '../../testUtils/testSocket.js';

const RUN_ID = `collab-test-${Date.now()}`;
let testSocket;
let userA;
let userB;

before(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  testSocket = startTestSocket();

  userA = await User.create({
    displayName: 'Collab Alice',
    email: `${RUN_ID}-alice@example.com`,
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
  });
  userB = await User.create({
    displayName: 'Collab Bob',
    email: `${RUN_ID}-bob@example.com`,
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
  });
});

after(async () => {
  // respondToCompletion awards leaderboard points as a side effect of
  // completion, so the "both approve" test below leaves PointsEntry rows too.
  await PointsEntry.deleteMany({ user: { $in: [userA._id, userB._id] } });
  await Collaboration.deleteMany({ 'participants.user': { $in: [userA._id, userB._id] } });
  await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
  await testSocket.close();
  await mongoose.connection.close();
});

async function makeCollaboration({ writingType = 'story', turnOwner = userA._id } = {}) {
  return Collaboration.create({
    participants: [{ user: userA._id }, { user: userB._id }],
    writingType,
    turnOwner,
  });
}

test('submitTurn rejects a user whose turn it is not', async () => {
  const collab = await makeCollaboration({ turnOwner: userA._id });

  await assert.rejects(
    () => collaborationService.submitTurn(userB._id, collab._id, '<p>Hello</p>'),
    (err) => err.statusCode === 403
  );
});

test('submitTurn rejects blank content', async () => {
  const collab = await makeCollaboration({ turnOwner: userA._id });

  await assert.rejects(
    () => collaborationService.submitTurn(userA._id, collab._id, '<p></p>'),
    (err) => err.statusCode === 400
  );
});

test('submitTurn rejects more than one paragraph for a story turn', async () => {
  const collab = await makeCollaboration({ writingType: 'story', turnOwner: userA._id });

  await assert.rejects(
    () => collaborationService.submitTurn(userA._id, collab._id, '<p>One</p><p>Two</p>'),
    (err) => err.statusCode === 400 && /one paragraph/i.test(err.message)
  );
});

test('submitTurn rejects a line break within a poem turn', async () => {
  const collab = await makeCollaboration({ writingType: 'poem', turnOwner: userA._id });

  await assert.rejects(
    () => collaborationService.submitTurn(userA._id, collab._id, '<p>a line<br>a break</p>'),
    (err) => err.statusCode === 400 && /one line/i.test(err.message)
  );
});

test('submitTurn accepts valid content, flips the turn, and resets approvals', async () => {
  const collab = await makeCollaboration({ turnOwner: userA._id });
  collab.participants[0].hasApproved = true;
  collab.participants[1].hasApproved = true;
  await collab.save();

  const updated = await collaborationService.submitTurn(userA._id, collab._id, '<p>My turn.</p>');

  assert.equal(updated.entries.length, 1);
  assert.equal(updated.turnOwner._id.toString(), userB._id.toString());
  assert.equal(updated.participants[0].hasApproved, null);
  assert.equal(updated.participants[1].hasApproved, null);
  assert.equal(updated.entries[0].author.displayName, 'Collab Alice');
});

test('respondToCompletion: one approval keeps the collaboration in progress', async () => {
  const collab = await makeCollaboration();

  const updated = await collaborationService.respondToCompletion(userA._id, collab._id, true);
  assert.equal(updated.status, 'in_progress');
  const self = updated.participants.find((p) => p.user._id.toString() === userA._id.toString());
  assert.equal(self.hasApproved, true);
});

test('respondToCompletion: both approving completes the collaboration', async () => {
  const collab = await makeCollaboration();

  await collaborationService.respondToCompletion(userA._id, collab._id, true);
  const updated = await collaborationService.respondToCompletion(userB._id, collab._id, true);

  assert.equal(updated.status, 'completed');
});

test('respondToCompletion: declining makes the collaboration private', async () => {
  const collab = await makeCollaboration();

  await collaborationService.respondToCompletion(userA._id, collab._id, true);
  const updated = await collaborationService.respondToCompletion(userB._id, collab._id, false);

  assert.equal(updated.status, 'private');
});

test('getById rejects a non-participant', async () => {
  const collab = await makeCollaboration();
  const stranger = await User.create({
    displayName: 'Stranger',
    email: `${RUN_ID}-stranger@example.com`,
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
  });

  await assert.rejects(
    () => collaborationService.getById(stranger._id, collab._id),
    (err) => err.statusCode === 403
  );

  await User.deleteOne({ _id: stranger._id });
});

test('getMine includes a collaboration the user participates in', async () => {
  const collab = await makeCollaboration();
  const { collaborations } = await collaborationService.getMine(userA._id);

  assert.ok(collaborations.some((c) => c.id.toString() === collab._id.toString()));
});

test('getMine paginates and filters by status', async () => {
  const inProgress = await makeCollaboration({ turnOwner: userA._id });
  const completed = await makeCollaboration({ turnOwner: userA._id });
  completed.status = 'completed';
  await completed.save();

  const activeOnly = await collaborationService.getMine(userA._id, { status: 'in_progress' });
  assert.ok(activeOnly.collaborations.every((c) => c.status === 'in_progress'));
  assert.ok(activeOnly.collaborations.some((c) => c.id.toString() === inProgress._id.toString()));
  assert.ok(!activeOnly.collaborations.some((c) => c.id.toString() === completed._id.toString()));

  const pageOne = await collaborationService.getMine(userA._id, { limit: 1, page: 1 });
  assert.equal(pageOne.collaborations.length, 1);
  assert.equal(pageOne.hasMore, pageOne.total > 1);
});

test('leave freezes the collaboration and records who left', async () => {
  const collab = await makeCollaboration();

  const updated = await collaborationService.leave(userA._id, collab._id);
  assert.equal(updated.status, 'left');
  assert.equal(updated.leftBy.toString(), userA._id.toString());
});

test('leave rejects a non-participant', async () => {
  const collab = await makeCollaboration();
  const stranger = await User.create({
    displayName: 'Leave Stranger',
    email: `${RUN_ID}-leave-stranger@example.com`,
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
  });

  await assert.rejects(
    () => collaborationService.leave(stranger._id, collab._id),
    (err) => err.statusCode === 403
  );

  await User.deleteOne({ _id: stranger._id });
});

test('leave rejects a collaboration that is already not in progress', async () => {
  const collab = await makeCollaboration();
  await collaborationService.leave(userA._id, collab._id);

  await assert.rejects(
    () => collaborationService.leave(userB._id, collab._id),
    (err) => err.statusCode === 409
  );
});

test('after leave, submitTurn and respondToCompletion both reject', async () => {
  const collab = await makeCollaboration({ turnOwner: userA._id });
  await collaborationService.leave(userA._id, collab._id);

  await assert.rejects(
    () => collaborationService.submitTurn(userA._id, collab._id, '<p>Too late</p>'),
    (err) => err.statusCode === 409
  );
  await assert.rejects(
    () => collaborationService.respondToCompletion(userB._id, collab._id, true),
    (err) => err.statusCode === 409
  );
});

test('getTurnCount only counts in-progress collaborations where it is this user\'s turn', async () => {
  const myTurn = await makeCollaboration({ turnOwner: userA._id });
  const theirTurn = await makeCollaboration({ turnOwner: userB._id });

  const count = await collaborationService.getTurnCount(userA._id);
  assert.ok(count >= 1);

  const collabIds = [myTurn._id, theirTurn._id];
  const stillOwesUserA = await Collaboration.countDocuments({
    _id: { $in: collabIds },
    turnOwner: userA._id,
    status: 'in_progress',
  });
  assert.equal(stillOwesUserA, 1);
});
