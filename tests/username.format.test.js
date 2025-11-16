/**
 * Check: usernames do not contain spaces and are not equal to the normalized full name
 */
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const User = require('../models/User');

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_connect_test';

beforeAll(async () => {
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
});

test('usernames contain no spaces and differ from full name', async () => {
  const users = await User.find({}, 'username name').lean();
  for (const u of users) {
    expect(u.username).toBeDefined();
    expect(u.username.indexOf(' ')).toBe(-1);
    if (u.name) {
      const normalizedName = u.name.toLowerCase().replace(/\s+/g, '');
      const normalizedUsername = (u.username || '').toLowerCase().replace(/\s+/g, '');
      expect(normalizedUsername).not.toBe(normalizedName);
    }
  }
});
