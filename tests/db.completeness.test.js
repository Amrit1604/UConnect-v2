/**
 * DB completeness: ensure no documents are 'empty' (only _id) in main collections
 */
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const User = require('../models/User');
const Post = require('../models/Post');
const Message = require('../models/Message');

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_connect_test';

beforeAll(async () => {
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
});

async function hasEmptyDocs(model) {
  const docs = await model.find().lean().limit(100).exec();
  for (const d of docs) {
    const keys = Object.keys(d || {});
    if (keys.length <= 1) return true; // only _id present
  }
  return false;
}

test('no empty user documents', async () => {
  const empty = await hasEmptyDocs(User);
  expect(empty).toBe(false);
});

test('no empty post documents (if posts exist)', async () => {
  const count = await Post.countDocuments();
  if (count === 0) return expect(count).toBeGreaterThanOrEqual(0);
  const empty = await hasEmptyDocs(Post);
  expect(empty).toBe(false);
});

test('no empty message documents (if messages exist)', async () => {
  const count = await Message.countDocuments();
  if (count === 0) return expect(count).toBeGreaterThanOrEqual(0);
  const empty = await hasEmptyDocs(Message);
  expect(empty).toBe(false);
});
