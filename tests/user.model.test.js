// User model tests
const mongoose = require('mongoose');
const User = require('../models/User');

describe('User Model', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/uconnect_test');
  });
  afterAll(async () => {
    await mongoose.connection.close();
  });
  it('should create a user', async () => {
    const user = new User({
      username: 'testuser',
      email: 'testuser@example.com',
      password: 'hashedpassword',
      isVerified: false,
      isActive: true
    });
    const saved = await user.save();
    expect(saved.username).toBe('testuser');
    await User.deleteOne({ _id: saved._id });
  });
});
