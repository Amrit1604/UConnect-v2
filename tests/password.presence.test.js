/**
 * Check: All users have a password field
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

test('every user has a non-empty password field', async () => {
  const users = await User.find({}, 'password').lean();
  expect(users.length).toBeGreaterThan(0);
  for (const u of users) {
    expect(u.password).toBeDefined();
    expect(typeof u.password).toBe('string');
    expect(u.password.length).toBeGreaterThan(0);
  }
});
