import 'dotenv/config';
import { test, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from '../authentication/auth.model.js';
import { Collaboration } from '../collaboration/collaboration.model.js';
import { Report } from './moderation.model.js';
import { mailer } from '../../utils/mailer.js';
import * as moderationService from './moderation.service.js';

const RUN_ID = `moderation-test-${Date.now()}`;
const email = (suffix) => `${RUN_ID}-${suffix}@example.com`;

let userA;
let userB;
let outsider;
let collaboration;
let publishedCollaboration;

before(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  userA = await User.create({
    displayName: 'User A',
    email: email('a'),
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
  });
  userB = await User.create({
    displayName: 'User B',
    email: email('b'),
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
  });
  outsider = await User.create({
    displayName: 'Outsider',
    email: email('outsider'),
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
  });

  collaboration = await Collaboration.create({
    participants: [{ user: userA._id }, { user: userB._id }],
    writingType: 'story',
    turnOwner: userA._id,
  });

  publishedCollaboration = await Collaboration.create({
    participants: [{ user: userA._id }, { user: userB._id }],
    writingType: 'story',
    turnOwner: userA._id,
    status: 'completed',
    isPublished: true,
  });
});

after(async () => {
  await Report.deleteMany({ reporter: { $in: [userA._id, userB._id, outsider._id] } });
  await Collaboration.deleteMany({ _id: { $in: [collaboration._id, publishedCollaboration._id] } });
  await User.deleteMany({ _id: { $in: [userA._id, userB._id, outsider._id] } });
  await mongoose.connection.close();
});

beforeEach(() => {
  mock.method(mailer, 'sendReportNotificationEmail', async () => {});
  mock.method(mailer, 'sendGalleryReportNotificationEmail', async () => {});
});

test('reportUser rejects a caller who is not a participant', async () => {
  await assert.rejects(
    () => moderationService.reportUser(outsider._id, collaboration._id, { reason: 'spam' }),
    (err) => err.statusCode === 403
  );
});

test('reportUser rejects an invalid reason', async () => {
  await assert.rejects(
    () => moderationService.reportUser(userA._id, collaboration._id, { reason: 'not-a-real-reason' }),
    (err) => err.statusCode === 400
  );
});

test('reportUser rejects details over 1000 characters', async () => {
  await assert.rejects(
    () =>
      moderationService.reportUser(userA._id, collaboration._id, {
        reason: 'other',
        details: 'x'.repeat(1001),
      }),
    (err) => err.statusCode === 400
  );
});

test('reportUser creates a Report against the other participant and emails a notification', async () => {
  await moderationService.reportUser(userA._id, collaboration._id, {
    reason: 'harassment',
    details: 'Was rude in chat',
  });

  const report = await Report.findOne({ reporter: userA._id, collaboration: collaboration._id });
  assert.ok(report);
  assert.equal(report.reportedUser.toString(), userB._id.toString());
  assert.equal(mailer.sendReportNotificationEmail.mock.calls.length, 1);
});

test('reportUser is idempotent for a repeated report on the same collaboration', async () => {
  await moderationService.reportUser(userB._id, collaboration._id, { reason: 'spam' });
  await moderationService.reportUser(userB._id, collaboration._id, { reason: 'spam' });

  const reports = await Report.find({ reporter: userB._id, collaboration: collaboration._id });
  assert.equal(reports.length, 1);
  assert.equal(mailer.sendReportNotificationEmail.mock.calls.length, 1);
});

test('blockUser rejects a caller who is not a participant', async () => {
  await assert.rejects(
    () => moderationService.blockUser(outsider._id, collaboration._id),
    (err) => err.statusCode === 403
  );
});

test('blockUser adds the other participant and is idempotent on repeat calls', async () => {
  await moderationService.blockUser(userA._id, collaboration._id);
  await moderationService.blockUser(userA._id, collaboration._id);

  const updated = await User.findById(userA._id);
  assert.equal(updated.blockedUsers.length, 1);
  assert.equal(updated.blockedUsers[0].toString(), userB._id.toString());
});

test('getBlockedUsers returns the populated block list', async () => {
  const blocked = await moderationService.getBlockedUsers(userA._id);
  assert.ok(blocked.some((u) => u._id.toString() === userB._id.toString()));
  assert.equal(blocked.find((u) => u._id.toString() === userB._id.toString()).displayName, 'User B');
});

test('getMutuallyBlockedIds includes both directions of a block', async () => {
  const fromA = await moderationService.getMutuallyBlockedIds(userA._id);
  assert.ok(fromA.some((id) => id.toString() === userB._id.toString()));

  const fromB = await moderationService.getMutuallyBlockedIds(userB._id);
  assert.ok(fromB.some((id) => id.toString() === userA._id.toString()));
});

test('unblockUser removes the block', async () => {
  await moderationService.unblockUser(userA._id, userB._id);

  const updated = await User.findById(userA._id);
  assert.equal(updated.blockedUsers.length, 0);
});

test('listReports returns reports with reporter/reportedUser populated', async () => {
  const reports = await moderationService.listReports();
  assert.ok(reports.length > 0);
  const report = reports.find((r) => r.reporter._id.toString() === userA._id.toString());
  assert.ok(report);
  assert.equal(report.reporter.displayName, 'User A');
  assert.equal(report.reportedUser.displayName, 'User B');
  assert.equal(report.status, 'open');
});

test('markReportReviewed flips status to reviewed and keeps reporter/reportedUser populated', async () => {
  const [report] = await moderationService.listReports();

  const updated = await moderationService.markReportReviewed(report._id);
  assert.equal(updated.status, 'reviewed');
  assert.equal(updated.reporter.displayName, report.reporter.displayName);
  assert.equal(updated.reportedUser.displayName, report.reportedUser.displayName);
});

test('markReportReviewed rejects a bogus id', async () => {
  await assert.rejects(
    () => moderationService.markReportReviewed(new mongoose.Types.ObjectId()),
    (err) => err.statusCode === 404
  );
});

// These four run last on purpose: listReports/markReportReviewed above rely
// on assumptions about report ordering and a non-null reportedUser on the
// newest report, and every report created here would otherwise become the
// newest and break those assertions.

test('reportGalleryContent rejects an unpublished collaboration', async () => {
  await assert.rejects(
    () => moderationService.reportGalleryContent(outsider._id, collaboration._id, { reason: 'spam' }),
    (err) => err.statusCode === 404
  );
});

test('reportGalleryContent rejects a nonexistent collaboration', async () => {
  await assert.rejects(
    () =>
      moderationService.reportGalleryContent(outsider._id, new mongoose.Types.ObjectId(), {
        reason: 'spam',
      }),
    (err) => err.statusCode === 404
  );
});

test('reportGalleryContent succeeds for a non-participant reporting a published piece', async () => {
  await moderationService.reportGalleryContent(outsider._id, publishedCollaboration._id, {
    reason: 'inappropriate_content',
    details: 'Contains slurs',
  });

  const report = await Report.findOne({
    reporter: outsider._id,
    collaboration: publishedCollaboration._id,
  });
  assert.ok(report);
  assert.equal(report.reportedUser, null);
  assert.equal(report.source, 'gallery');
  assert.equal(mailer.sendGalleryReportNotificationEmail.mock.calls.length, 1);
});

test('reportGalleryContent is idempotent for a repeated report from the same reporter', async () => {
  await moderationService.reportGalleryContent(userB._id, publishedCollaboration._id, {
    reason: 'spam',
  });
  await moderationService.reportGalleryContent(userB._id, publishedCollaboration._id, {
    reason: 'spam',
  });

  const reports = await Report.find({
    reporter: userB._id,
    collaboration: publishedCollaboration._id,
  });
  assert.equal(reports.length, 1);
});
