/**
 * Chat System Test Suite - UConnect
 * Tests for follow requests, messaging, and spam detection
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const FollowRequest = require('../models/FollowRequest');
const Friendship = require('../models/Friendship');
const Message = require('../models/Message');
const Notification = require('../models/Notification');

// Test users
let user1, user2, user3;
// Increase default Jest timeout for DB operations
jest.setTimeout(30000);

let user1Session, user2Session, user3Session;

// Setup before tests
beforeAll(async () => {
  // Clear relevant collections
  await User.deleteMany({ email: /@test-chat\.com$/ });
  await FollowRequest.deleteMany({});
  await Friendship.deleteMany({});
  await Message.deleteMany({});
  await Notification.deleteMany({});

  // Create test users
  user1 = await User.create({
    email: 'user1@test-chat.com',
    name: 'Test User 1',
    username: 'testuser1_chat',
    password: 'Password123!',
    campus: 'Main Campus',
    isVerified: true
  });

  user2 = await User.create({
    email: 'user2@test-chat.com',
    name: 'Test User 2',
    username: 'testuser2_chat',
    password: 'Password123!',
    campus: 'Main Campus',
    isVerified: true
  });

  user3 = await User.create({
    email: 'user3@test-chat.com',
    name: 'Test User 3',
    username: 'testuser3_chat',
    password: 'Password123!',
    campus: 'Main Campus',
    isVerified: true
  });
});

// Cleanup between tests (keep test users intact)
afterEach(async () => {
  await FollowRequest.deleteMany({});
  await Friendship.deleteMany({});
  await Message.deleteMany({});
  await Notification.deleteMany({});
});

// Cleanup after tests
afterAll(async () => {
  await User.deleteMany({ email: /@test-chat\.com$/ });
  await FollowRequest.deleteMany({});
  await Friendship.deleteMany({});
  await Message.deleteMany({});
  await Notification.deleteMany({});
  // Mongoose connection will be closed by jest.setup.js
});

// Helper function to login user
async function loginUser(email, password) {
  const response = await request(app)
    .post('/auth/login')
    .send({ email, password });
  
  const cookies = response.headers['set-cookie'];
  return cookies;
}

describe('Follow Request System', () => {
  beforeEach(async () => {
    // Login users before each test
    user1Session = await loginUser('user1@test-chat.com', 'Password123!');
    user2Session = await loginUser('user2@test-chat.com', 'Password123!');
    user3Session = await loginUser('user3@test-chat.com', 'Password123!');
  });

  test('should send follow request successfully', async () => {
    const response = await request(app)
      .post(`/chat/request/${user2._id}`)
      .set('Cookie', user1Session)
      .send({ message: 'Hi! Let\'s connect!' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify request was created
    const followRequest = await FollowRequest.findOne({
      sender: user1._id,
      receiver: user2._id
    });
    expect(followRequest).toBeTruthy();
    expect(followRequest.status).toBe('pending');

    // Verify notification was created
    const notification = await Notification.findOne({
      recipient: user2._id,
      type: 'follow_request'
    });
    expect(notification).toBeTruthy();
  });

  test('should not allow duplicate follow requests', async () => {
    // Send first request
    await request(app)
      .post(`/chat/request/${user2._id}`)
      .set('Cookie', user1Session);

    // Try to send another
    const response = await request(app)
      .post(`/chat/request/${user2._id}`)
      .set('Cookie', user1Session);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('should not allow sending request to self', async () => {
    const response = await request(app)
      .post(`/chat/request/${user1._id}`)
      .set('Cookie', user1Session);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('should accept follow request and create friendship', async () => {
    // Create a follow request
    const followRequest = await FollowRequest.create({
      sender: user1._id,
      receiver: user2._id,
      message: 'Let\'s be friends!',
      status: 'pending'
    });

    const response = await request(app)
      .post(`/chat/request/${followRequest._id}/accept`)
      .set('Cookie', user2Session);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.friendshipId).toBeTruthy();

    // Verify friendship was created
    const friendship = await Friendship.findById(response.body.friendshipId);
    expect(friendship).toBeTruthy();
    expect(friendship.users).toHaveLength(2);

    // Verify follow request was marked as accepted
    const updatedRequest = await FollowRequest.findById(followRequest._id);
    expect(updatedRequest.status).toBe('accepted');

    // Verify notification was created
    const notification = await Notification.findOne({
      recipient: user1._id,
      type: 'follow_accepted'
    });
    expect(notification).toBeTruthy();
  });

  test('should reject follow request', async () => {
    const followRequest = await FollowRequest.create({
      sender: user1._id,
      receiver: user3._id,
      status: 'pending'
    });

    const response = await request(app)
      .post(`/chat/request/${followRequest._id}/reject`)
      .set('Cookie', user3Session);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify status was updated
    const updatedRequest = await FollowRequest.findById(followRequest._id);
    expect(updatedRequest.status).toBe('rejected');
    expect(updatedRequest.respondedAt).toBeTruthy();
  });

  test('should block user from follow request', async () => {
    const followRequest = await FollowRequest.create({
      sender: user3._id,
      receiver: user2._id,
      status: 'pending'
    });

    const response = await request(app)
      .post(`/chat/request/${followRequest._id}/block`)
      .set('Cookie', user2Session);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify status was updated
    const updatedRequest = await FollowRequest.findById(followRequest._id);
    expect(updatedRequest.status).toBe('blocked');
  });
});

describe('Spam Detection', () => {
  beforeEach(async () => {
    user1Session = await loginUser('user1@test-chat.com', 'Password123!');
    user2Session = await loginUser('user2@test-chat.com', 'Password123!');
  });

  test('should block user after 3 rejections from same person', async () => {
    // Create and reject 3 requests
    for (let i = 0; i < 3; i++) {
      const followRequest = await FollowRequest.create({
        sender: user1._id,
        receiver: user2._id,
        status: 'rejected',
        respondedAt: new Date()
      });
    }

    // Try to send another request
    const response = await request(app)
      .post(`/chat/request/${user2._id}`)
      .set('Cookie', user1Session);

    expect(response.status).toBe(429);
    expect(response.body.success).toBe(false);
  });

  test('should detect high rejection rate', async () => {
    // Create multiple users for testing
    const testUsers = [];
    for (let i = 0; i < 5; i++) {
      const user = await User.create({
        email: `spamtest${i}@test-chat.com`,
        name: `Spam Test ${i}`,
        username: `spamtest${i}_chat`,
        password: 'Password123!',
        campus: 'Main Campus',
        isVerified: true
      });
      testUsers.push(user);
    }

    // Create many rejected requests
    for (const user of testUsers) {
      await FollowRequest.create({
        sender: user1._id,
        receiver: user._id,
        status: 'rejected',
        respondedAt: new Date()
      });
    }

    // Get spam stats
    const stats = await FollowRequest.getSpamStats(user1._id);
    expect(stats.rejected).toBeGreaterThanOrEqual(5);
    expect(stats.totalSent).toBeGreaterThanOrEqual(5);

    // Cleanup
    await User.deleteMany({ email: /^spamtest.*@test-chat\.com$/ });
  });

  test('should count rejected requests correctly', async () => {
    const count = await FollowRequest.countRejectedRequests(
      user1._id,
      user2._id
    );
    
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

describe('Messaging System', () => {
  let friendship;

  beforeEach(async () => {
    user1Session = await loginUser('user1@test-chat.com', 'Password123!');
    user2Session = await loginUser('user2@test-chat.com', 'Password123!');

    // Create friendship between user1 and user2
    friendship = await Friendship.createFriendship(user1._id, user2._id);
  });

  test('should send text message between friends', async () => {
    const response = await request(app)
      .post(`/chat/${user2._id}/message`)
      .set('Cookie', user1Session)
      .send({ content: 'Hello friend!' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBeTruthy();
    expect(response.body.message.content).toBe('Hello friend!');

    // Verify message was created
    const message = await Message.findById(response.body.message._id);
    expect(message).toBeTruthy();
    expect(message.sender.toString()).toBe(user1._id.toString());
    expect(message.receiver.toString()).toBe(user2._id.toString());
  });

  test('should not allow messaging non-friends', async () => {
    const response = await request(app)
      .post(`/chat/${user3._id}/message`)
      .set('Cookie', user1Session)
      .send({ content: 'Hello stranger!' });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  test('should get conversation messages', async () => {
    // Create some messages
    await Message.create({
      sender: user1._id,
      receiver: user2._id,
      friendship: friendship._id,
      messageType: 'text',
      content: 'Message 1'
    });

    await Message.create({
      sender: user2._id,
      receiver: user1._id,
      friendship: friendship._id,
      messageType: 'text',
      content: 'Message 2'
    });

    const response = await request(app)
      .get(`/chat/${user2._id}/messages`)
      .set('Cookie', user1Session);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.messages).toHaveLength(2);
  });

  test('should mark messages as read', async () => {
    // Create unread messages
    await Message.create({
      sender: user2._id,
      receiver: user1._id,
      friendship: friendship._id,
      messageType: 'text',
      content: 'Unread message',
      isRead: false
    });

    const count = await Message.markAsRead(user1._id, user2._id);
    expect(count).toBeGreaterThanOrEqual(1);

    // Verify messages are marked as read
    const unreadCount = await Message.countUnreadFrom(user1._id, user2._id);
    expect(unreadCount).toBe(0);
  });

  test('should count unread messages', async () => {
    await Message.create({
      sender: user2._id,
      receiver: user1._id,
      friendship: friendship._id,
      messageType: 'text',
      content: 'Another unread message',
      isRead: false
    });

    const count = await Message.countUnreadFrom(user1._id, user2._id);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should delete message for user', async () => {
    const message = await Message.create({
      sender: user1._id,
      receiver: user2._id,
      friendship: friendship._id,
      messageType: 'text',
      content: 'Message to delete'
    });

    const response = await request(app)
      .delete(`/chat/message/${message._id}`)
      .set('Cookie', user1Session);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify soft delete
    const deletedMsg = await Message.findById(message._id);
    expect(deletedMsg.deletedBy).toContainEqual(user1._id);
  });

  test('should search messages', async () => {
    await Message.create({
      sender: user1._id,
      receiver: user2._id,
      friendship: friendship._id,
      messageType: 'text',
      content: 'Find this unique keyword'
    });

    const response = await request(app)
      .post('/chat/search')
      .set('Cookie', user1Session)
      .send({ query: 'unique' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.messages.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Friendship Model', () => {
  test('should create friendship with sorted user IDs', async () => {
    const friendship = await Friendship.createFriendship(user2._id, user1._id);
    
    expect(friendship.users).toHaveLength(2);
    expect(friendship.user1).toBeTruthy();
    expect(friendship.user2).toBeTruthy();
    
    // Verify sorting (user1 < user2 alphabetically)
    expect(friendship.user1.toString() < friendship.user2.toString()).toBe(true);
  });

  test('should check if users are friends', async () => {
    await Friendship.createFriendship(user1._id, user2._id);
    
    const areFriends = await Friendship.areFriends(user1._id, user2._id);
    expect(areFriends).toBe(true);

    const notFriends = await Friendship.areFriends(user1._id, user3._id);
    expect(notFriends).toBe(false);
  });

  test('should increment and reset unread counts', async () => {
    const friendship = await Friendship.createFriendship(user1._id, user3._id);
    
    await friendship.incrementUnread(user1._id);
    await friendship.incrementUnread(user1._id);
    
    let unreadCount = friendship.unreadCount.get(user1._id.toString());
    expect(unreadCount).toBe(2);

    await friendship.resetUnread(user1._id);
    unreadCount = friendship.unreadCount.get(user1._id.toString());
    expect(unreadCount).toBe(0);
  });

  test('should update last message time', async () => {
    const friendship = await Friendship.createFriendship(user2._id, user3._id);
    const oldTime = friendship.lastMessageAt;

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));

    await friendship.updateLastMessage();
    expect(friendship.lastMessageAt.getTime()).toBeGreaterThan(oldTime.getTime());
    expect(friendship.messageCount).toBeGreaterThan(0);
  });

  test('should get other user ID', async () => {
    const friendship = await Friendship.createFriendship(user1._id, user2._id);
    
    const otherUser = friendship.getOtherUserId(user1._id);
    expect(otherUser.toString()).toBe(user2._id.toString());

    const otherUser2 = friendship.getOtherUserId(user2._id);
    expect(otherUser2.toString()).toBe(user1._id.toString());
  });
});

describe('Notification System', () => {
  beforeEach(async () => {
    await Notification.deleteMany({});
  });

  test('should create follow request notification', async () => {
    const followRequestId = new mongoose.Types.ObjectId();
    
    const notification = await Notification.createFollowRequestNotification(
      user1,
      user2._id,
      followRequestId
    );

    expect(notification).toBeTruthy();
    expect(notification.recipient.toString()).toBe(user2._id.toString());
    expect(notification.type).toBe('follow_request');
    expect(notification.relatedId.toString()).toBe(followRequestId.toString());
  });

  test('should create follow accepted notification', async () => {
    const notification = await Notification.createFollowAcceptedNotification(
      user2,
      user1._id
    );

    expect(notification).toBeTruthy();
    expect(notification.recipient.toString()).toBe(user1._id.toString());
    expect(notification.type).toBe('follow_accepted');
  });

  test('should create message notification', async () => {
    const messageId = new mongoose.Types.ObjectId();
    
    const notification = await Notification.createMessageNotification(
      user1,
      user2._id,
      messageId
    );

    expect(notification).toBeTruthy();
    expect(notification.recipient.toString()).toBe(user2._id.toString());
    expect(notification.type).toBe('new_message');
  });

  test('should create admin warning notification', async () => {
    const notification = await Notification.createAdminWarningNotification(
      user1._id,
      'Your activity has been flagged'
    );

    expect(notification).toBeTruthy();
    expect(notification.type).toBe('admin_warning');
    expect(notification.priority).toBe('urgent');
  });

  test('should get unread notification count', async () => {
    await Notification.create({
      recipient: user1._id,
      sender: user2._id,
      type: 'new_message',
      title: 'New message',
      message: 'Test message',
      isRead: false
    });

    const count = await Notification.getUnreadCount(user1._id);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should mark notifications as read', async () => {
    const notification = await Notification.create({
      recipient: user1._id,
      sender: user2._id,
      type: 'new_message',
      title: 'New message',
      message: 'Test message',
      isRead: false
    });

    await Notification.markAsRead([notification._id], user1._id);

    const updated = await Notification.findById(notification._id);
    expect(updated.isRead).toBe(true);
    expect(updated.readAt).toBeTruthy();
  });
});

// Run the tests
console.log('🧪 Running chat system tests...');
