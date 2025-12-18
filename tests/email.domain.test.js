/**
 * Check: student emails end with @chitkara.edu.in
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

test('student emails use chitkara.edu.in domain', async () => {
  const students = await User.find({ role: 'student' }, 'email').lean();
  if (!students || students.length === 0) {
    return expect(students.length).toBeGreaterThanOrEqual(0);
  }

  for (const s of students) {
    expect(s.email).toBeDefined();
    expect(s.email.toLowerCase().endsWith('@chitkara.edu.in')).toBe(true);
  }
});
