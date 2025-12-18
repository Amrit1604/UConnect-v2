// Post model tests
const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');

describe('Post Model', () => {
  let user;
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/uconnect_test');
    user = new User({ username: 'postuser', email: 'postuser@example.com', password: 'pw' });
    await user.save();
  });
  afterAll(async () => {
    await User.deleteOne({ _id: user._id });
    await mongoose.connection.close();
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
