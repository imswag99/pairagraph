import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from '../authentication/auth.model.js';
import { Collaboration } from '../collaboration/collaboration.model.js';
import { PointsEntry } from './leaderboard.model.js';
import * as leaderboardService from './leaderboard.service.js';

const RUN_ID = `leaderboard-test-${Date.now()}`;
let userA;
let userB;
let deletedUser;

before(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  userA = await User.create({
    displayName: 'LB Test Alice',
    email: `${RUN_ID}-alice@example.com`,
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
  });
  userB = await User.create({
    displayName: 'LB Test Bob',
    email: `${RUN_ID}-bob@example.com`,
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
  });
  deletedUser = await User.create({
    displayName: 'Deleted user',
    email: `deleted-${RUN_ID}@pairagraph.invalid`,
    isDeleted: true,
    isEmailVerified: true,
    authProvider: 'local',
  });
});

after(async () => {
  await User.deleteMany({ _id: { $in: [userA._id, userB._id, deletedUser._id] } });
  await mongoose.connection.close();
});

// Every test below creates and tears down its own collaboration/points-entry
// data inline, rather than sharing fixtures cleaned up in a suite-level
// after() hook — under concurrent multi-file `node --test` runs, a shared
// after() hook was observed to not reliably finish before the process exits,
// leaking rows; inline cleanup at the end of each test proved reliable.

test('awardCompletionPoints creates one entry per participant scaled by turns, and is idempotent on repeat', async () => {
  const collab = await Collaboration.create({
    participants: [{ user: userA._id }, { user: userB._id }],
    writingType: 'story',
    turnOwner: userA._id,
    status: 'completed',
    entries: [
      { author: userA._id, content: 'one' },
      { author: userB._id, content: 'two' },
      { author: userA._id, content: 'three' },
    ],
  });

  try {
    await leaderboardService.awardCompletionPoints(collab);
    let entries = await PointsEntry.find({ collaboration: collab._id });
    assert.equal(entries.length, 2);
    // base 6 + 1/turn: Alice wrote 2 turns (8pts), Bob wrote 1 turn (7pts).
    const alice = entries.find((e) => e.user.toString() === userA._id.toString());
    const bob = entries.find((e) => e.user.toString() === userB._id.toString());
    assert.equal(alice.points, 8);
    assert.equal(bob.points, 7);

    await leaderboardService.awardCompletionPoints(collab);
    entries = await PointsEntry.find({ collaboration: collab._id });
    assert.equal(entries.length, 2, 'calling it again must not create duplicate entries');
  } finally {
    await PointsEntry.deleteMany({ collaboration: collab._id });
    await Collaboration.deleteOne({ _id: collab._id });
  }
});

test('getLeaderboard("all") ranks by total points, highest first', async () => {
  const collabOne = await Collaboration.create({
    participants: [{ user: userA._id }, { user: userB._id }],
    writingType: 'story',
    turnOwner: userA._id,
    status: 'completed',
    entries: [
      { author: userA._id, content: 'one' },
      { author: userB._id, content: 'two' },
    ],
  });
  const collabTwo = await Collaboration.create({
    participants: [{ user: userA._id }, { user: userB._id }],
    writingType: 'poem',
    turnOwner: userA._id,
    status: 'completed',
    entries: [
      { author: userA._id, content: 'one' },
      { author: userA._id, content: 'two' },
      { author: userA._id, content: 'three' },
      { author: userA._id, content: 'four' },
    ],
  });

  try {
    await leaderboardService.awardCompletionPoints(collabOne);
    await leaderboardService.awardCompletionPoints(collabTwo);

    const entries = await leaderboardService.getLeaderboard('all');
    const alice = entries.find((e) => e.userId.toString() === userA._id.toString());
    const bob = entries.find((e) => e.userId.toString() === userB._id.toString());

    // collabOne: Alice 1 turn (7), Bob 1 turn (7). collabTwo: Alice 4 turns (10), Bob 0 turns (6).
    assert.equal(alice.points, 17);
    assert.equal(bob.points, 13);
    assert.ok(alice.rank < bob.rank);
  } finally {
    await PointsEntry.deleteMany({ collaboration: { $in: [collabOne._id, collabTwo._id] } });
    await Collaboration.deleteMany({ _id: { $in: [collabOne._id, collabTwo._id] } });
  }
});

test('getLeaderboard("week") excludes entries from before the current ISO week', async () => {
  const collab = await Collaboration.create({
    participants: [{ user: userA._id }, { user: userB._id }],
    writingType: 'story',
    turnOwner: userA._id,
    status: 'completed',
  });
  const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);

  try {
    await PointsEntry.create({
      user: userB._id,
      collaboration: collab._id,
      points: 10,
      createdAt: threeWeeksAgo,
    });

    const weekEntries = await leaderboardService.getLeaderboard('week');
    const bobWeekPoints =
      weekEntries.find((e) => e.userId.toString() === userB._id.toString())?.points ?? 0;

    const allEntries = await leaderboardService.getLeaderboard('all');
    const bobAllPoints =
      allEntries.find((e) => e.userId.toString() === userB._id.toString())?.points ?? 0;

    assert.equal(bobAllPoints, bobWeekPoints + 10);
  } finally {
    await PointsEntry.deleteMany({ collaboration: collab._id });
    await Collaboration.deleteOne({ _id: collab._id });
  }
});

test('getLeaderboard("month") excludes entries from before the current UTC month', async () => {
  const collab = await Collaboration.create({
    participants: [{ user: userA._id }, { user: userB._id }],
    writingType: 'story',
    turnOwner: userA._id,
    status: 'completed',
  });
  const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  try {
    await PointsEntry.create({
      user: userB._id,
      collaboration: collab._id,
      points: 10,
      createdAt: twoMonthsAgo,
    });

    const monthEntries = await leaderboardService.getLeaderboard('month');
    const bobMonthPoints =
      monthEntries.find((e) => e.userId.toString() === userB._id.toString())?.points ?? 0;

    const allEntries = await leaderboardService.getLeaderboard('all');
    const bobAllPoints =
      allEntries.find((e) => e.userId.toString() === userB._id.toString())?.points ?? 0;

    assert.equal(bobAllPoints, bobMonthPoints + 10);
  } finally {
    await PointsEntry.deleteMany({ collaboration: collab._id });
    await Collaboration.deleteOne({ _id: collab._id });
  }
});

test('getLeaderboard breaks ties on equal points deterministically by user id', async () => {
  const collab = await Collaboration.create({
    participants: [{ user: userA._id }, { user: userB._id }],
    writingType: 'story',
    turnOwner: userA._id,
    status: 'completed',
  });

  try {
    await PointsEntry.create({ user: userA._id, collaboration: collab._id, points: 42 });
    const collabTwo = await Collaboration.create({
      participants: [{ user: userA._id }, { user: userB._id }],
      writingType: 'poem',
      turnOwner: userA._id,
      status: 'completed',
    });
    await PointsEntry.create({ user: userB._id, collaboration: collabTwo._id, points: 42 });

    try {
      const first = await leaderboardService.getLeaderboard('all');
      const second = await leaderboardService.getLeaderboard('all');
      const tiedFirst = first.filter((e) => e.points === 42).map((e) => e.userId.toString());
      const tiedSecond = second.filter((e) => e.points === 42).map((e) => e.userId.toString());
      assert.deepEqual(tiedFirst, tiedSecond, 'tie order must be stable across calls');
      assert.deepEqual(
        tiedFirst,
        [...tiedFirst].sort(),
        'tied entries must be ordered by ascending user id'
      );
    } finally {
      await PointsEntry.deleteMany({ collaboration: collabTwo._id });
      await Collaboration.deleteOne({ _id: collabTwo._id });
    }
  } finally {
    await PointsEntry.deleteMany({ collaboration: collab._id });
    await Collaboration.deleteOne({ _id: collab._id });
  }
});

test('getLeaderboard excludes anonymized (deleted) accounts', async () => {
  const collab = await Collaboration.create({
    participants: [{ user: userA._id }, { user: deletedUser._id }],
    writingType: 'story',
    turnOwner: userA._id,
    status: 'completed',
  });

  try {
    await PointsEntry.create({ user: deletedUser._id, collaboration: collab._id, points: 10 });

    const entries = await leaderboardService.getLeaderboard('all');
    assert.ok(!entries.some((e) => e.userId.toString() === deletedUser._id.toString()));
  } finally {
    await PointsEntry.deleteMany({ collaboration: collab._id });
    await Collaboration.deleteOne({ _id: collab._id });
  }
});
