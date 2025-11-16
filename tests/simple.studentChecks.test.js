/**
 * Simple student checks
 * - Connects to the project test DB (uses MONGODB_URI or localhost fallback)
 * - Verifies basic invariants on `User` documents:
 *   - passwords exist and look hashed (bcrypt)
 *   - usernames contain no spaces (not full name)
 *   - student emails satisfy model rule (\.edu.in or gmail)
 */

const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env from project root
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const User = require('../models/User');

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_connect_test';

beforeAll(async () => {
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

afterAll(async () => {
  await mongoose.disconnect();
});

test('at least one user exists in the DB', async () => {
  const count = await User.countDocuments();
  expect(count).toBeGreaterThan(0);
});

test('all users have a password and it appears hashed (bcrypt)', async () => {
  const users = await User.find({}, 'email username password').lean();
  expect(users.length).toBeGreaterThan(0);

  const bcryptPrefix = /^\$2[aby]\$/; // bcrypt hashes start with $2a$, $2b$, or $2y$

  for (const u of users) {
    expect(u.password).toBeDefined();
    expect(typeof u.password).toBe('string');
    expect(u.password.length).toBeGreaterThanOrEqual(60); // bcrypt hashes ~60 chars
    // Check prefix
    expect(bcryptPrefix.test(u.password.substring(0,4))).toBe(true);
  }
});

test('usernames do not contain spaces (not full names)', async () => {
  const users = await User.find({}, 'username name').lean();
  for (const u of users) {
    expect(u.username).toBeDefined();
    expect(u.username.indexOf(' ')).toBe(-1);
    // Prefer username not equal to normalized name
    if (u.name) {
      const normalizedName = u.name.toLowerCase().replace(/\s+/g, '');
      const normalizedUsername = (u.username || '').toLowerCase().replace(/\s+/g, '');
      expect(normalizedUsername).not.toBe(normalizedName);
    }
  }
});

test('student emails follow .edu.in or @gmail.com (per model validation)', async () => {
  const students = await User.find({ role: 'student' }, 'email').lean();
  // If there are no student users this test is skipped
  if (!students || students.length === 0) {
    return expect(students.length).toBeGreaterThanOrEqual(0);
  }

  for (const s of students) {
    expect(s.email).toBeDefined();
    const ok = s.email.endsWith('.edu.in') || s.email.endsWith('@gmail.com');
    expect(ok).toBe(true);
  }
});
