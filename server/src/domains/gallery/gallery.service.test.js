import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from '../authentication/auth.model.js';
import { Collaboration } from '../collaboration/collaboration.model.js';
import * as galleryService from './gallery.service.js';

const RUN_ID = `gallery-test-${Date.now()}`;
let userA;
let userB;

before(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  userA = await User.create({
    displayName: 'Gallery Alice',
    email: `${RUN_ID}-alice@example.com`,
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
  });
  userB = await User.create({
    displayName: 'Gallery Bob',
    email: `${RUN_ID}-bob@example.com`,
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
  });
});

after(async () => {
  await Collaboration.deleteMany({ 'participants.user': { $in: [userA._id, userB._id] } });
  await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
  await mongoose.connection.close();
});

async function makePublished({
  writingType = 'story',
  theme = 'classic',
  aliceConsents = false,
  bobConsents = false,
  entries = [{ author: userA._id, content: '<p>Once upon a time.</p>' }],
} = {}) {
  return Collaboration.create({
    participants: [
      { user: userA._id, hasConsentedToPublish: aliceConsents },
      { user: userB._id, hasConsentedToPublish: bobConsents },
    ],
    writingType,
    theme,
    turnOwner: userA._id,
    status: 'completed',
    entries,
    isPublished: true,
    publishedAt: new Date(),
  });
}

test('listPublished only returns published pieces', async () => {
  const published = await makePublished();
  const unpublished = await Collaboration.create({
    participants: [{ user: userA._id }, { user: userB._id }],
    writingType: 'story',
    turnOwner: userA._id,
    status: 'completed',
    isPublished: false,
  });

  const { items } = await galleryService.listPublished();
  const ids = items.map((i) => i.id.toString());

  assert.ok(ids.includes(published._id.toString()));
  assert.ok(!ids.includes(unpublished._id.toString()));
});

test('listPublished respects each participant\'s own publish consent', async () => {
  const collab = await makePublished({ aliceConsents: true, bobConsents: false });

  const { items } = await galleryService.listPublished();
  const item = items.find((i) => i.id.toString() === collab._id.toString());

  assert.ok(item.authors.includes('Gallery Alice'));
  assert.ok(item.authors.includes('Anonymous collaborator'));
  assert.ok(!item.authors.includes('Gallery Bob'));
});

test('listPublished filters by writingType and theme', async () => {
  const story = await makePublished({ writingType: 'story', theme: 'mystery' });
  const poem = await makePublished({ writingType: 'poem', theme: 'romance' });

  const storiesOnly = await galleryService.listPublished({ writingType: 'story' });
  const ids = storiesOnly.items.map((i) => i.id.toString());
  assert.ok(ids.includes(story._id.toString()));
  assert.ok(!ids.includes(poem._id.toString()));

  const mysteryOnly = await galleryService.listPublished({ theme: 'mystery' });
  const mysteryIds = mysteryOnly.items.map((i) => i.id.toString());
  assert.ok(mysteryIds.includes(story._id.toString()));
  assert.ok(!mysteryIds.includes(poem._id.toString()));
});

test('listPublished paginates', async () => {
  const { items, total } = await galleryService.listPublished({ limit: 1, page: 1 });
  assert.equal(items.length, 1);
  assert.ok(total >= 1);
});

test('getPublished 404s for an unpublished collaboration, even for one of its own authors', async () => {
  const unpublished = await Collaboration.create({
    participants: [{ user: userA._id }, { user: userB._id }],
    writingType: 'story',
    turnOwner: userA._id,
    status: 'completed',
    isPublished: false,
  });

  await assert.rejects(
    () => galleryService.getPublished(unpublished._id),
    (err) => err.statusCode === 404
  );
});

test('getPublished 404s for a nonexistent id', async () => {
  await assert.rejects(
    () => galleryService.getPublished(new mongoose.Types.ObjectId()),
    (err) => err.statusCode === 404
  );
});

test('getPublished returns entries with a consent-respecting author on each turn', async () => {
  const collab = await makePublished({
    aliceConsents: true,
    bobConsents: false,
    entries: [
      { author: userA._id, content: '<p>Alice wrote this.</p>' },
      { author: userB._id, content: '<p>Bob wrote this.</p>' },
    ],
  });

  const piece = await galleryService.getPublished(collab._id);

  assert.equal(piece.entries[0].author.displayName, 'Gallery Alice');
  assert.equal(piece.entries[1].author.displayName, 'Anonymous collaborator');
  assert.ok(piece.authors.includes('Gallery Alice'));
  assert.ok(piece.authors.includes('Anonymous collaborator'));
});
