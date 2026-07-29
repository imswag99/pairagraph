import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from './auth.model.js';
import { blockInactiveParticipant } from './auth.middleware.js';

const RUN_ID = `auth-middleware-test-${Date.now()}`;
const email = (suffix) => `${RUN_ID}-${suffix}@example.com`;

let activeUser;
let bannedUser;
let adminUser;

before(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  [activeUser, bannedUser, adminUser] = await Promise.all([
    User.create({
      displayName: 'Active',
      email: email('active'),
      authProvider: 'local',
      passwordHash: 'irrelevant',
      isEmailVerified: true,
    }),
    User.create({
      displayName: 'Banned',
      email: email('banned'),
      authProvider: 'local',
      passwordHash: 'irrelevant',
      isEmailVerified: true,
      isBanned: true,
    }),
    User.create({
      displayName: 'Admin',
      email: email('admin'),
      authProvider: 'local',
      passwordHash: 'irrelevant',
      isEmailVerified: true,
      role: 'admin',
    }),
  ]);
});

after(async () => {
  await User.deleteMany({ _id: { $in: [activeUser._id, bannedUser._id, adminUser._id] } });
  await mongoose.connection.close();
});

function callMiddleware(userId) {
  return new Promise((resolve, reject) => {
    const req = { user: { id: userId } };
    blockInactiveParticipant(req, {}, (err) => (err ? reject(err) : resolve()));
  });
}

test('blockInactiveParticipant lets an active, non-admin user through', async () => {
  await assert.doesNotReject(() => callMiddleware(activeUser._id));
});

test('blockInactiveParticipant rejects a banned user', async () => {
  await assert.rejects(
    () => callMiddleware(bannedUser._id),
    (err) => err.statusCode === 403
  );
});

test('blockInactiveParticipant rejects an admin', async () => {
  await assert.rejects(
    () => callMiddleware(adminUser._id),
    (err) => err.statusCode === 403
  );
});
