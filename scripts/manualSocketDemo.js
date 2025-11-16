/*
Manual Socket Demo
- Connects two socket.io clients (A and B)
- Ensures demo users exist in MongoDB (creates them if needed)
- Authenticates sockets by emitting 'authenticate' with user IDs
- Demonstrates server delivery: A emits 'typing_start' to B, B receives 'user_typing'

Usage:
  node scripts/manualSocketDemo.js

Requires server to be running at http://localhost:4000 and MONGODB_URI in env or defaults.
*/

const mongoose = require('mongoose');
const { io } = require('socket.io-client');
const path = require('path');
// Ensure test env so model validators accept test emails
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Friendship = require('../models/Friendship');

const BASE = process.env.BASE_URL || 'http://localhost:4000';
const MONGO = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/uconnect';

async function ensureUser(username, email, name){
  let user = await User.findOne({ username });
  if (user) return user;
  user = new User({ username, email, name, password: 'Password123!', role: 'student', campus: 'Main Campus', isActive: true, isVerified: true });
  await user.save();
  return user;
}

async function run(){
  console.log('Connecting to MongoDB:', MONGO);
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Mongo connected');

  const a = await ensureUser('demo_socket_a', 'demo_a@test-chat.com', 'Demo A');
  const b = await ensureUser('demo_socket_b', 'demo_b@test-chat.com', 'Demo B');

  // Ensure friendship exists so sockets can exchange messages
  await Friendship.createFriendship(a._id, b._id);

  console.log('Demo users:', a._id.toString(), b._id.toString());

  const socketA = io(BASE, { transports: ['websocket'], reconnection: false });
  const socketB = io(BASE, { transports: ['websocket'], reconnection: false });

  socketA.on('connect', () => {
    console.log('[A] connected', socketA.id);
    socketA.emit('authenticate', a._id.toString());
  });
  socketB.on('connect', () => {
    console.log('[B] connected', socketB.id);
    socketB.emit('authenticate', b._id.toString());
  });

  socketB.on('friends_online', (data) => {
    console.log('[B] friends_online', data);
  });

  socketA.on('friends_online', (data) => {
    console.log('[A] friends_online', data);
  });

  socketB.on('user_typing', (data) => {
    console.log('[B] user_typing received:', data);
  });

  socketA.on('user_typing', (data) => {
    console.log('[A] user_typing received:', data);
  });

  socketA.on('new_message', (data) => {
    console.log('[A] new_message received:', data && data.message && data.message.content);
  });

  socketB.on('new_message', (data) => {
    console.log('[B] new_message received:', data && data.message && data.message.content);
    // Simulate reading messages after receiving one
    setTimeout(()=>{
      console.log('[B] emitting messages_read to mark as read');
      socketB.emit('messages_read', { userId: b._id.toString(), otherUserId: a._id.toString() });
    }, 500);
  });

  socketA.on('messages_read_receipt', (data) => {
    console.log('[A] messages_read_receipt received:', data);
  });

  socketA.on('send_message_ok', (data) => {
    console.log('[A] send_message_ok:', data && data.message && data.message._id);
  });

  // wait until both connected
  await new Promise((resolve)=>{
    const check = setInterval(()=>{
      if (socketA.connected && socketB.connected){ clearInterval(check); resolve(); }
    }, 100);
    setTimeout(()=>{ clearInterval(check); resolve(); }, 5000);
  });

  console.log('Both sockets connected — emitting typing_start from A -> B');
  socketA.emit('typing_start', { userId: a._id.toString(), otherUserId: b._id.toString() });

  // Send a test message from A to B via socket helper
  await new Promise(r => setTimeout(r, 700));
  console.log('Sending test message from A -> B via socket');
  socketA.emit('send_message', { senderId: a._id.toString(), otherUserId: b._id.toString(), content: 'Hello from A (socket test)' });

  // Wait to receive on B
  await new Promise(r => setTimeout(r, 1500));

  console.log('Now emit typing_stop');
  socketA.emit('typing_stop', { userId: a._id.toString(), otherUserId: b._id.toString() });

  await new Promise(r => setTimeout(r, 500));

  console.log('Closing sockets');
  socketA.close(); socketB.close();
  await mongoose.disconnect();
  console.log('Done');
}

run().catch(err=>{ console.error(err); process.exit(1); });
