// Post model tests
const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');

describe('Post Model', () => {
  let user;
  
  // Use existing mongoose connection from app.js
  beforeAll(async () => {
    // Create test user
    user = await User.create({ 
      name: 'Post Test User',
      username: 'postuser_model', 
      email: 'postuser@gmail.com', 
      password: 'hashedpassword123',
      campus: 'Test Campus',
      isVerified: true
    });
  });
  
  afterAll(async () => {
    // Clean up
    if (user && user._id) {
      await Post.deleteMany({ author: user._id });
      await User.deleteOne({ _id: user._id });
    }
  });
  
  it('should create a post', async () => {
    const post = new Post({
      author: user._id,
      content: 'Test post content',
      isActive: true
    });
    const saved = await post.save();
    expect(saved.content).toBe('Test post content');
    await Post.deleteOne({ _id: saved._id });
  });
});
