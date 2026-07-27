import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from '../authentication/auth.model.js';
import { Invite } from './invite.model.js';
import { Collaboration } from '../collaboration/collaboration.model.js';
import * as inviteService from './invite.service.js';
import { startTestSocket } from '../../testUtils/testSocket.js';

const RUN_ID = `invite-test-${Date.now()}`;
let testSocket;
let creator;
let redeemer;

before(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  testSocket = startTestSocket();

  creator = await User.create({
    displayName: 'Invite Creator',
    email: `${RUN_ID}-creator@example.com`,
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
  });
  redeemer = await User.create({
    displayName: 'Invite Redeemer',
    email: `${RUN_ID}-redeemer@example.com`,
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
  });
});

after(async () => {
  await Invite.deleteMany({ creator: creator._id });
  await Collaboration.deleteMany({ 'participants.user': { $in: [creator._id, redeemer._id] } });
  await User.deleteMany({ _id: { $in: [creator._id, redeemer._id] } });
  await testSocket.close();
  await mongoose.connection.close();
});

test('createInvite creates a pending invite with a code', async () => {
  const invite = await inviteService.createInvite(creator._id, 'story');
  assert.equal(invite.status, 'pending');
  assert.ok(invite.code);
});

test('redeemInvite rejects the creator redeeming their own invite', async () => {
  const invite = await inviteService.createInvite(creator._id, 'story');

  await assert.rejects(
    () => inviteService.redeemInvite(creator._id, invite.code),
    (err) => err.statusCode === 400
  );
});

test('redeemInvite rejects an unknown code', async () => {
  await assert.rejects(
    () => inviteService.redeemInvite(redeemer._id, 'not-a-real-code'),
    (err) => err.statusCode === 404
  );
});

test('redeemInvite succeeds and creates a collaboration between creator and redeemer', async () => {
  const invite = await inviteService.createInvite(creator._id, 'poem');

  const result = await inviteService.redeemInvite(redeemer._id, invite.code);
  assert.ok(result.collaborationId);

  const collab = await Collaboration.findById(result.collaborationId);
  assert.equal(collab.writingType, 'poem');
  const participantIds = collab.participants.map((p) => p.user.toString());
  assert.ok(participantIds.includes(creator._id.toString()));
  assert.ok(participantIds.includes(redeemer._id.toString()));

  const updatedInvite = await Invite.findById(invite._id);
  assert.equal(updatedInvite.status, 'redeemed');
});

test('redeemInvite rejects a code that was already redeemed', async () => {
  const invite = await inviteService.createInvite(creator._id, 'story');
  await inviteService.redeemInvite(redeemer._id, invite.code);

  await assert.rejects(
    () => inviteService.redeemInvite(redeemer._id, invite.code),
    (err) => err.statusCode === 404
  );
});

test('cancelInvite rejects a non-owner', async () => {
  const invite = await inviteService.createInvite(creator._id, 'story');

  await assert.rejects(
    () => inviteService.cancelInvite(redeemer._id, invite._id),
    (err) => err.statusCode === 403
  );
});

test('cancelInvite removes a pending invite owned by the caller', async () => {
  const invite = await inviteService.createInvite(creator._id, 'story');

  await inviteService.cancelInvite(creator._id, invite._id);

  const stillThere = await Invite.findById(invite._id);
  assert.equal(stillThere, null);
});

test('getMine lists invites created by the user', async () => {
  const invite = await inviteService.createInvite(creator._id, 'story');

  const mine = await inviteService.getMine(creator._id);
  assert.ok(mine.some((i) => i.id.toString() === invite._id.toString()));
});
