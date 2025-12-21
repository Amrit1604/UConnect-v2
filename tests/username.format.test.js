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

describe('Username Format Validation', () => {
  test('should accept valid username with letters and numbers', async () => {
    const user = new User({
      email: 'test1@university.edu.in',
      name: 'Test User',
      username: 'testuser123',
      password: 'password123'
    });

    const savedUser = await user.save();
    expect(savedUser.username).toBe('testuser123');

    await User.findByIdAndDelete(savedUser._id);
  });

  test('should accept valid username with underscores', async () => {
    const user = new User({
      email: 'test2@university.edu.in',
      name: 'Test User 2',
      username: 'test_user_123',
      password: 'password123'
    });

    const savedUser = await user.save();
    expect(savedUser.username).toBe('test_user_123');

    await User.findByIdAndDelete(savedUser._id);
  });

  test('should reject username shorter than 3 characters', async () => {
    const user = new User({
      email: 'test3@university.edu.in',
      name: 'Test User 3',
      username: 'ab',
      password: 'password123'
    });

    await expect(user.save()).rejects.toThrow(/Username must be at least 3 characters/);
  });

  test('should reject username longer than 20 characters', async () => {
    const user = new User({
      email: 'test4@university.edu.in',
      name: 'Test User 4',
      username: 'verylongusernamethatexceedslimit',
      password: 'password123'
    });

    await expect(user.save()).rejects.toThrow(/Username cannot exceed 20 characters/);
  });

  test('should reject username with invalid characters', async () => {
    const user = new User({
      email: 'test5@university.edu.in',
      name: 'Test User 5',
      username: 'test@user!',
      password: 'password123'
    });

    await expect(user.save()).rejects.toThrow(/Username can only contain letters, numbers, and underscores/);
  });
});
