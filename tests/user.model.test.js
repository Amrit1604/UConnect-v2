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

describe('User Model', () => {
  test('should create user with required fields', async () => {
    const user = new User({
      email: 'modeltest@university.edu.in',
      name: 'Model Test User',
      username: 'modeltestuser',
      password: 'password123'
    });

    const savedUser = await user.save();
    expect(savedUser.email).toBe('modeltest@university.edu.in');
    expect(savedUser.name).toBe('Model Test User');
    expect(savedUser.username).toBe('modeltestuser');
    expect(savedUser.role).toBe('student');
    expect(savedUser.campus).toBe('Main Campus');

    await User.findByIdAndDelete(savedUser._id);
  });

  test('should generate verification token', async () => {
    const user = new User({
      email: 'token@university.edu.in',
      name: 'Token User',
      username: 'tokenuser',
      password: 'password123'
    });

    const token = user.generateVerificationToken();
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(user.verificationToken).toBe(token);
    expect(user.verificationTokenExpires).toBeInstanceOf(Date);

    await User.findByIdAndDelete(user._id);
  });

  test('should generate password reset token', async () => {
    const user = new User({
      email: 'reset@university.edu.in',
      name: 'Reset User',
      username: 'resetuser',
      password: 'password123'
    });

    const token = user.generatePasswordResetToken();
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(user.resetPasswordToken).toBe(token);
    expect(user.resetPasswordExpires).toBeInstanceOf(Date);

    await User.findByIdAndDelete(user._id);
  });

  test('should return avatar URL', async () => {
    const user = new User({
      email: 'avatar@university.edu.in',
      name: 'Avatar User',
      username: 'avataruser',
      password: 'password123',
      avatarSeed: 'test-seed'
    });

    const avatarUrl = user.avatarUrl;
    expect(avatarUrl).toContain('dicebear.com');
    expect(avatarUrl).toContain('test-seed');

    await User.findByIdAndDelete(user._id);
  });

  test('should get user statistics', async () => {
    // Create test users
    const user1 = await new User({
      email: 'stats1@university.edu.in',
      name: 'Stats User 1',
      username: 'statsuser1',
      password: 'password123',
      isVerified: true
    }).save();

    const user2 = await new User({
      email: 'stats2@university.edu.in',
      name: 'Stats User 2',
      username: 'statsuser2',
      password: 'password123',
      isVerified: false
    }).save();

    const stats = await User.getStats();
    expect(stats.totalUsers).toBeGreaterThanOrEqual(2);
    expect(stats.verifiedUsers).toBeGreaterThanOrEqual(1);

    await User.findByIdAndDelete(user1._id);
    await User.findByIdAndDelete(user2._id);
  });
});
