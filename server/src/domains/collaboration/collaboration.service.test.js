import 'dotenv/config';
import { test, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from '../authentication/auth.model.js';
import { Collaboration } from './collaboration.model.js';
import { PointsEntry } from '../leaderboard/leaderboard.model.js';
import { mailer } from '../../utils/mailer.js';
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

beforeEach(() => {
  mock.method(mailer, 'sendYourTurnEmail', async () => {});
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

async function makeCollaboration({
  writingType = 'story',
  turnOwner = userA._id,
  status = 'in_progress',
} = {}) {
  return Collaboration.create({
    participants: [{ user: userA._id }, { user: userB._id }],
    writingType,
    turnOwner,
    status,
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

  // This turn flip also fires a fire-and-forget "your turn" notification —
  // drain it before the test ends so it can't resolve late and leak an extra
  // mock call into whichever test runs next (observed flake otherwise).
  await flushNotificationQueue(1);
});

// The notification email is sent fire-and-forget (never blocks the turn
// response) via a real DB lookup, so tests poll for the expected call count
// instead of racing it with a fixed sleep — a fixed delay was observed to
// flake under load (real MongoDB Atlas latency varies run to run).
async function flushNotificationQueue(expectedCallCount) {
  const deadline = Date.now() + 2000;
  while (
    mailer.sendYourTurnEmail.mock.calls.length < expectedCallCount &&
    Date.now() < deadline
  ) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test('submitTurn notifies the new turn-owner by email and records the notification time', async () => {
  const collab = await makeCollaboration({ turnOwner: userA._id });

  const updated = await collaborationService.submitTurn(userA._id, collab._id, '<p>My turn.</p>');
  await flushNotificationQueue(1);

  assert.equal(mailer.sendYourTurnEmail.mock.calls.length, 1);
  assert.equal(mailer.sendYourTurnEmail.mock.calls[0].arguments[0], userB.email);

  const stored = await Collaboration.findById(updated._id);
  const bobParticipant = stored.participants.find((p) => p.user.toString() === userB._id.toString());
  assert.ok(bobParticipant.lastTurnNotifiedAt instanceof Date);
});

test('submitTurn does not re-notify the same user within the cooldown window', async () => {
  const collab = await makeCollaboration({ turnOwner: userA._id });

  await collaborationService.submitTurn(userA._id, collab._id, '<p>First.</p>');
  await flushNotificationQueue(1);
  assert.equal(mailer.sendYourTurnEmail.mock.calls.length, 1);

  await collaborationService.submitTurn(userB._id, collab._id, '<p>Second.</p>');
  await flushNotificationQueue(2);
  // Bob's earlier notification already sent Alice's turn-notification eligibility
  // aside — this call would notify Alice, not Bob, so it doesn't touch Bob's
  // cooldown. Submit a third turn back to Bob within the cooldown window and
  // confirm he isn't notified again. There's no call count to poll toward here
  // (we're proving an absence), so give it a fixed grace window instead.
  await collaborationService.submitTurn(userA._id, collab._id, '<p>Third.</p>');
  await new Promise((resolve) => setTimeout(resolve, 300));

  const callsForBob = mailer.sendYourTurnEmail.mock.calls.filter(
    (call) => call.arguments[0] === userB.email
  );
  assert.equal(callsForBob.length, 1, 'Bob should only be notified once within the cooldown');
});

test('respondToCompletion: one approval keeps the collaboration in progress', async () => {
  const collab = await makeCollaboration();

  const updated = await collaborationService.respondToCompletion(userA._id, collab._id, true);
  assert.equal(updated.status, 'in_progress');
  const self = updated.participants.find((p) => p.user._id.toString() === userA._id.toString());
  assert.equal(self.hasApproved, true);
});

test('respondToCompletion: both approving completes the collaboration and records completion activity', async () => {
  const collab = await makeCollaboration();

  await collaborationService.respondToCompletion(userA._id, collab._id, true);
  const updated = await collaborationService.respondToCompletion(userB._id, collab._id, true);

  assert.equal(updated.status, 'completed');

  const points = await PointsEntry.find({ collaboration: collab._id });
  assert.equal(points.length, 2);

  const refreshedA = await User.findById(userA._id);
  const refreshedB = await User.findById(userB._id);
  assert.ok(refreshedA.totalCompletions >= 1);
  assert.ok(refreshedB.totalCompletions >= 1);
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

test('setGalleryPublished rejects a collaboration that is not completed', async () => {
  const collab = await makeCollaboration({ status: 'in_progress' });

  await assert.rejects(
    () => collaborationService.setGalleryPublished(userA._id, collab._id, true),
    (err) => err.statusCode === 409
  );
});

test('setGalleryPublished lets either participant publish or unpublish unilaterally', async () => {
  const collab = await makeCollaboration({ status: 'completed' });

  const published = await collaborationService.setGalleryPublished(userA._id, collab._id, true);
  assert.equal(published.isPublished, true);
  assert.ok(published.publishedAt);

  // Bob, not Alice, takes it back down — no requirement that the same
  // participant who published it is the one who can unpublish it.
  const unpublished = await collaborationService.setGalleryPublished(userB._id, collab._id, false);
  assert.equal(unpublished.isPublished, false);
});

test('setPublishConsent only ever changes the caller\'s own participant subdocument', async () => {
  const collab = await makeCollaboration({ status: 'completed' });

  const updated = await collaborationService.setPublishConsent(userA._id, collab._id, true);
  const alice = updated.participants.find((p) => p.user._id.toString() === userA._id.toString());
  const bob = updated.participants.find((p) => p.user._id.toString() === userB._id.toString());

  assert.equal(alice.hasConsentedToPublish, true);
  assert.equal(bob.hasConsentedToPublish, false);
});
