/**
 * Check: Passwords are hashed (bcrypt-like format)
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

test('stored passwords look like bcrypt hashes', async () => {
  const users = await User.find({}, 'password').lean();
  expect(users.length).toBeGreaterThan(0);
  const bcryptPrefix = /^\$2[aby]\$/;

  for (const u of users) {
    expect(u.password).toBeDefined();
    expect(u.password.length).toBeGreaterThanOrEqual(60);
    expect(bcryptPrefix.test(u.password.substring(0,4))).toBe(true);
  }
});
