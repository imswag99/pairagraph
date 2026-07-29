import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from '../authentication/auth.model.js';
import { Collaboration } from '../collaboration/collaboration.model.js';
import { ChatMessage } from './chat.model.js';
import * as chatService from './chat.service.js';
import { startTestSocket } from '../../testUtils/testSocket.js';

const RUN_ID = `chat-test-${Date.now()}`;
let testSocket;
let userA;
let userB;

before(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  testSocket = startTestSocket();

  userA = await User.create({
    displayName: 'Chat Alice',
    email: `${RUN_ID}-alice@example.com`,
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
  });
  userB = await User.create({
    displayName: 'Chat Bob',
    email: `${RUN_ID}-bob@example.com`,
    authProvider: 'local',
    passwordHash: 'irrelevant',
    isEmailVerified: true,
  });
});

after(async () => {
  await ChatMessage.deleteMany({ sender: { $in: [userA._id, userB._id] } });
  await Collaboration.deleteMany({ 'participants.user': { $in: [userA._id, userB._id] } });
  await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
  await testSocket.close();
  await mongoose.connection.close();
});

async function makeCollaboration(status = 'in_progress') {
  return Collaboration.create({
    participants: [{ user: userA._id }, { user: userB._id }],
    writingType: 'story',
    turnOwner: userA._id,
    status,
  });
}

test('sendMessage succeeds while the collaboration is in progress', async () => {
  const collab = await makeCollaboration();

  const message = await chatService.sendMessage(userA._id, collab._id, 'Hello there');
  assert.equal(message.content, 'Hello there');
});

test('sendMessage rejects once the collaboration has ended', async () => {
  const collab = await makeCollaboration('left');

  await assert.rejects(
    () => chatService.sendMessage(userA._id, collab._id, 'Too late'),
    (err) => err.statusCode === 409
  );
});

test('getHistory still returns messages regardless of collaboration status', async () => {
  const collab = await makeCollaboration();
  await chatService.sendMessage(userA._id, collab._id, 'Before it ended');

  collab.status = 'left';
  await collab.save();

  const { messages } = await chatService.getHistory(userB._id, collab._id);
  assert.ok(messages.some((m) => m.content === 'Before it ended'));
});
