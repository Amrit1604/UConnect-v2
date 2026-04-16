// User model tests
const mongoose = require('mongoose');
const User = require('../models/User');

describe('User Model', () => {
  // Use existing mongoose connection from app.js
  afterAll(async () => {
    // Clean up test user
    await User.deleteMany({ email: 'testuser@gmail.com' });
  });

  it('should create a user', async () => {
    const user = new User({
      name: 'Test User',
      username: 'testuser_model',
      email: 'testuser@gmail.com',
      password: 'hashedpassword123',
      campus: 'Test Campus',
      isVerified: true,
      isActive: true
    });
    const saved = await user.save();
    expect(saved.username).toBe('testuser_model');
    await User.deleteOne({ _id: saved._id });
  });
});
