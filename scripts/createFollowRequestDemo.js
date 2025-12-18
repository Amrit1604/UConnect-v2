// Demo helper: create a follow request and notification directly (no auth needed)
const mongoose = require('mongoose');
const path = require('path');
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const FollowRequest = require('../models/FollowRequest');
const Notification = require('../models/Notification');

const MONGO = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/uconnect';

async function ensureUser(username,email,name){
  let u = await User.findOne({ username });
  if (u) return u;
  u = new User({ username, email, name, password: 'Password123!', role: 'student', campus: 'Demo' , isActive:true, isVerified:true});
  await u.save();
  return u;
}

async function run(){
  await mongoose.connect(MONGO, { useNewUrlParser:true, useUnifiedTopology:true });
  console.log('Mongo connected');
  const a = await ensureUser('demo_req_sender','demo_req_sender@test-chat.com','Req Sender');
  const b = await ensureUser('demo_req_receiver','demo_req_receiver@test-chat.com','Req Receiver');
  console.log('Users:', a._id.toString(), b._id.toString());

  const existing = await FollowRequest.checkExisting(a._id, b._id);
  if (existing) { console.log('Follow request already exists:', existing._id.toString()); process.exit(0); }

  const fr = await FollowRequest.create({ sender: a._id, receiver: b._id, message: 'Hi, would like to chat!', status: 'pending' });
  const notif = await Notification.createFollowRequestNotification(a, b._id, fr._id);
  console.log('Created follow request and notification:', fr._id.toString(), notif._id.toString());
  await mongoose.disconnect();
}

run().catch(err=>{ console.error(err); process.exit(1); });
