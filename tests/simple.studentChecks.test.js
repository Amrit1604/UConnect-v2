const mongoose = require('mongoose');
const User = require('../models/User');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_connect_test';

beforeAll(async () => {
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('Student Validation Checks', () => {
  test('should accept valid .edu.in email for students', async () => {
    const user = new User({
      email: 'student@university.edu.in',
      name: 'Student User',
      username: 'studentuser',
      password: 'password123',
      role: 'student'
    });

    const savedUser = await user.save();
    expect(savedUser.email).toBe('student@university.edu.in');
    expect(savedUser.role).toBe('student');

    await User.findByIdAndDelete(savedUser._id);
  });

  test('should accept Gmail email for students in test environment', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    const user = new User({
      email: 'student@gmail.com',
      name: 'Test Student',
      username: 'teststudent',
      password: 'password123',
      role: 'student'
    });

    const savedUser = await user.save();
    expect(savedUser.email).toBe('student@gmail.com');

    process.env.NODE_ENV = originalEnv;
    await User.findByIdAndDelete(savedUser._id);
  });

  test('should reject invalid email domains for students', async () => {
    const user = new User({
      email: 'student@invalid.com',
      name: 'Invalid Student',
      username: 'invalidstudent',
      password: 'password123',
      role: 'student'
    });

    await expect(user.save()).rejects.toThrow(/Please use a valid .edu.in email address/);
  });

  test('should set default role as student', async () => {
    const user = new User({
      email: 'default@university.edu.in',
      name: 'Default User',
      username: 'defaultuser',
      password: 'password123'
    });

    const savedUser = await user.save();
    expect(savedUser.role).toBe('student');

    await User.findByIdAndDelete(savedUser._id);
  });

  test('should allow admin role to be set explicitly', async () => {
    const user = new User({
      email: 'admin@university.edu.in',
      name: 'Admin User',
      username: 'adminuser',
      password: 'password123',
      role: 'admin'
    });

    const savedUser = await user.save();
    expect(savedUser.role).toBe('admin');

    await User.findByIdAndDelete(savedUser._id);
  });
});
