const mongoose = require('mongoose');
const Post = require('../models/Post');
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

describe('Post Model', () => {
  let testUser;

  beforeEach(async () => {
    // Create a test user for posts
    testUser = await new User({
      email: 'posttest@university.edu.in',
      name: 'Post Test User',
      username: 'posttestuser',
      password: 'password123'
    }).save();
  });

  afterEach(async () => {
    // Cleanup posts and user
    await Post.deleteMany({ author: testUser._id });
    await User.findByIdAndDelete(testUser._id);
  });

  test('should create post with required fields', async () => {
    const post = new Post({
      author: testUser._id,
      category: 'general',
      content: 'This is a test post content',
      campus: 'Main Campus'
    });

    const savedPost = await post.save();
    expect(savedPost.author.toString()).toBe(testUser._id.toString());
    expect(savedPost.category).toBe('general');
    expect(savedPost.content).toBe('This is a test post content');
    expect(savedPost.campus).toBe('Main Campus');
    expect(savedPost.isActive).toBe(true);

    await Post.findByIdAndDelete(savedPost._id);
  });

  test('should add and remove likes correctly', async () => {
    const post = await new Post({
      author: testUser._id,
      category: 'general',
      content: 'Test post for likes',
      campus: 'Main Campus'
    }).save();

    // Add like
    const addResult = post.addLike(testUser._id);
    expect(addResult).toBe(true);
    expect(post.likes.length).toBe(1);
    expect(post.likes[0].user.toString()).toBe(testUser._id.toString());

    await post.save();

    // Try to add like again (should not add duplicate)
    const addAgainResult = post.addLike(testUser._id);
    expect(addAgainResult).toBe(false);

    // Remove like
    const removeResult = post.removeLike(testUser._id);
    expect(removeResult).toBe(true);
    expect(post.likes.length).toBe(0);

    await Post.findByIdAndDelete(post._id);
  });

  test('should add comments correctly', async () => {
    const post = await new Post({
      author: testUser._id,
      category: 'general',
      content: 'Test post for comments',
      campus: 'Main Campus'
    }).save();

    post.addComment(testUser._id, 'This is a test comment');
    await post.save();

    expect(post.comments.length).toBe(1);
    expect(post.comments[0].author.toString()).toBe(testUser._id.toString());
    expect(post.comments[0].content).toBe('This is a test comment');

    await Post.findByIdAndDelete(post._id);
  });

  test('should calculate virtual likeCount correctly', async () => {
    const post = await new Post({
      author: testUser._id,
      category: 'general',
      content: 'Test post for virtuals',
      campus: 'Main Campus',
      likes: [
        { user: testUser._id, createdAt: new Date() },
        { user: new mongoose.Types.ObjectId(), createdAt: new Date() }
      ]
    }).save();

    expect(post.likeCount).toBe(2);

    await Post.findByIdAndDelete(post._id);
  });

  test('should get posts by category', async () => {
    const post1 = await new Post({
      author: testUser._id,
      category: 'study',
      content: 'Study post 1',
      campus: 'Main Campus'
    }).save();

    const post2 = await new Post({
      author: testUser._id,
      category: 'general',
      content: 'General post 1',
      campus: 'Main Campus'
    }).save();

    const studyPosts = await Post.getByCategory('Main Campus', 'study');
    expect(studyPosts.length).toBeGreaterThanOrEqual(1);
    expect(studyPosts.some(p => p._id.toString() === post1._id.toString())).toBe(true);

    await Post.findByIdAndDelete(post1._id);
    await Post.findByIdAndDelete(post2._id);
  });
});
