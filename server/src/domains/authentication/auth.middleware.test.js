import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from './auth.model.js';
import { requireAuth, requireAdmin, blockInactiveParticipant } from './auth.middleware.js';
import { generateAccessToken } from '../../utils/tokens.js';

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

function callRequireAuth(accessToken) {
  return new Promise((resolve, reject) => {
    const req = { cookies: accessToken ? { accessToken } : {} };
    requireAuth(req, {}, (err) => (err ? reject(err) : resolve(req)));
  });
}

function callSyncMiddleware(fn, role) {
  return new Promise((resolve, reject) => {
    const req = { user: { role } };
    fn(req, {}, (err) => (err ? reject(err) : resolve()));
  });
}

test('requireAuth rejects a request with no access token cookie', async () => {
  await assert.rejects(() => callRequireAuth(undefined), (err) => err.statusCode === 401);
});

test('requireAuth rejects a garbage/invalid token', async () => {
  await assert.rejects(() => callRequireAuth('not-a-real-token'), (err) => err.statusCode === 401);
});

test('requireAuth lets an active user through and attaches id + role', async () => {
  const req = await callRequireAuth(generateAccessToken(activeUser._id));
  assert.equal(req.user.id, activeUser._id.toString());
  assert.equal(req.user.role, 'user');
});

test('requireAuth attaches an admin role for an admin user', async () => {
  const req = await callRequireAuth(generateAccessToken(adminUser._id));
  assert.equal(req.user.role, 'admin');
});

// This is the actual ban-token-gap fix: a banned user's access token is
// otherwise still cryptographically valid (it isn't revoked on ban, only
// refresh tokens are), so this must be checked against the DB on every
// request rather than trusted from the token payload alone.
test('requireAuth rejects an already-issued token belonging to a since-banned user', async () => {
  await assert.rejects(
    () => callRequireAuth(generateAccessToken(bannedUser._id)),
    (err) => err.statusCode === 403
  );
});

test('requireAdmin lets an admin through', async () => {
  await assert.doesNotReject(() => callSyncMiddleware(requireAdmin, 'admin'));
});

test('requireAdmin rejects a non-admin', async () => {
  await assert.rejects(
    () => callSyncMiddleware(requireAdmin, 'user'),
    (err) => err.statusCode === 403
  );
});

test('blockInactiveParticipant lets a non-admin through', async () => {
  await assert.doesNotReject(() => callSyncMiddleware(blockInactiveParticipant, 'user'));
});

test('blockInactiveParticipant rejects an admin', async () => {
  await assert.rejects(
    () => callSyncMiddleware(blockInactiveParticipant, 'admin'),
    (err) => err.statusCode === 403
  );
});
