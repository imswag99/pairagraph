import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from '../authentication/auth.model.js';
import { Collaboration } from '../collaboration/collaboration.model.js';
import { ChatMessage } from '../chat/chat.model.js';
import { Report } from '../moderation/moderation.model.js';
import * as adminService from './admin.service.js';

const RUN_ID = `admin-test-${Date.now()}`;
const email = (suffix) => `${RUN_ID}-${suffix}@example.com`;

let admin;
let userA;
let userB;
let otherAdmin;
let collaboration;

before(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  admin = await User.create({
    displayName: 'Admin',
    email: email('admin'),
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
    role: 'admin',
  });
  otherAdmin = await User.create({
    displayName: 'Other Admin',
    email: email('other-admin'),
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
    role: 'admin',
  });
  userA = await User.create({
    displayName: 'User A',
    email: email('a'),
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
    refreshTokenHash: 'some-hash',
  });
  userB = await User.create({
    displayName: 'User B',
    email: email('b'),
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
  });

  collaboration = await Collaboration.create({
    participants: [{ user: userA._id }, { user: userB._id }],
    writingType: 'story',
    turnOwner: userA._id,
    entries: [{ author: userA._id, content: '<p>Once upon a time.</p>' }],
  });

  await ChatMessage.create({
    collaboration: collaboration._id,
    sender: userB._id,
    content: 'Hey, knock it off',
  });

  await Report.create({
    reporter: userB._id,
    reportedUser: userA._id,
    collaboration: collaboration._id,
    reason: 'harassment',
    status: 'open',
  });
});

after(async () => {
  await Report.deleteMany({ collaboration: collaboration._id });
  await ChatMessage.deleteMany({ collaboration: collaboration._id });
  await Collaboration.deleteMany({ _id: collaboration._id });
  await User.deleteMany({ _id: { $in: [admin._id, otherAdmin._id, userA._id, userB._id] } });
  await mongoose.connection.close();
});

test('listUsers includes open report counts per user', async () => {
  const users = await adminService.listUsers();
  const listedA = users.find((u) => u.id.toString() === userA._id.toString());
  const listedB = users.find((u) => u.id.toString() === userB._id.toString());

  assert.equal(listedA.openReportCount, 1);
  assert.equal(listedB.openReportCount, 0);
});

test('banUser rejects banning your own account', async () => {
  await assert.rejects(
    () => adminService.banUser(admin._id, admin._id),
    (err) => err.statusCode === 400
  );
});

test('banUser sets isBanned and clears the refresh token', async () => {
  await adminService.banUser(admin._id, userA._id);

  const updated = await User.findById(userA._id);
  assert.equal(updated.isBanned, true);
  assert.equal(updated.refreshTokenHash, null);
});

test('unbanUser clears isBanned', async () => {
  await adminService.unbanUser(userA._id);

  const updated = await User.findById(userA._id);
  assert.equal(updated.isBanned, false);
});

test('deleteUser rejects deleting your own account', async () => {
  await assert.rejects(
    () => adminService.deleteUser(admin._id, admin._id),
    (err) => err.statusCode === 400
  );
});

test('deleteUser rejects deleting another admin', async () => {
  await assert.rejects(
    () => adminService.deleteUser(admin._id, otherAdmin._id),
    (err) => err.statusCode === 400
  );
});

test('deleteUser anonymizes a regular user via the existing deleteAccount logic', async () => {
  await adminService.deleteUser(admin._id, userB._id);

  const updated = await User.findById(userB._id);
  assert.equal(updated.displayName, 'Deleted user');
  assert.equal(updated.isDeleted, true);
});

test('getReportedCollaboration returns entries and chat messages with no participant check', async () => {
  // No caller/participant argument at all — that's the point, since the
  // admin reviewing this is never a participant in the reported collaboration.
  const result = await adminService.getReportedCollaboration(collaboration._id);
  assert.equal(result.collaboration.entries.length, 1);
  assert.equal(result.messages.length, 1);
  assert.equal(result.messages[0].content, 'Hey, knock it off');
});

test('getReportedCollaboration rejects a bogus id', async () => {
  await assert.rejects(
    () => adminService.getReportedCollaboration(new mongoose.Types.ObjectId()),
    (err) => err.statusCode === 404
  );
});
