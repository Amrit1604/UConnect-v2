// scripts/stressTestUsers.js
// Stress test: create 20 users, each with posts, comments, and videos
// Usage: node scripts/stressTestUsers.js

const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Post = require('../models/Post');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://amritjoshi16947_db_user:Amrit123@cluster0.jdhkwai.mongodb.net/uconnect_v2?retryWrites=true&w=majority&appName=Cluster0&tls=true&tlsAllowInvalidCertificates=true';

const INDIAN_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Ananya', 'Aadhya', 'Siya', 'Diya', 'Pari', 'Anika', 'Navya', 'Sara', 'Ira', 'Riya'
];

const CAMPUS = 'Chitkara';
const PASSWORD = 'Test@1234';
const VIDEO_PATH = path.join(__dirname, 'sample.mp4'); // Place a small sample.mp4 in scripts/

async function main() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  // Clean up test users and posts
  await User.deleteMany({ username: { $in: INDIAN_NAMES.map(n => n.toLowerCase()) } });
  await Post.deleteMany({ 'author.username': { $in: INDIAN_NAMES.map(n => n.toLowerCase()) } });

  // Create users
  const users = [];
  for (let i = 0; i < INDIAN_NAMES.length; i++) {
    const name = INDIAN_NAMES[i];
    const username = name.toLowerCase();
    const email = `${username}@gmail.com`;
    const user = new User({
      name,
      username,
      email,
      password: PASSWORD,
      campus: CAMPUS,
      avatarSeed: name,
      isActive: true
    });
    await user.save();
    users.push(user);
    console.log(`Created user: ${username}`);
  }

  // Create posts for each user
  for (const user of users) {
    for (let p = 0; p < 3; p++) {
      const post = new Post({
        author: user._id,
        title: faker.lorem.words(4),
        content: faker.lorem.sentences(2),
        campus: CAMPUS,
        tags: [faker.hacker.noun(), faker.hacker.verb()],
        isActive: true,
        createdAt: new Date(Date.now() - Math.random() * 100000000)
      });
      // Attach a video to one post per user
      if (p === 0 && fs.existsSync(VIDEO_PATH)) {
        post.videos = [{
          url: '/uploads/posts/sample.mp4',
          mimetype: 'video/mp4',
          originalName: 'sample.mp4',
          type: 'video'
        }];
      }
      await post.save();
      // Add comments from other users
      const commenters = users.filter(u => u._id.toString() !== user._id.toString());
      for (let c = 0; c < 2; c++) {
        const commenter = commenters[Math.floor(Math.random() * commenters.length)];
        post.comments.push({
          author: commenter._id,
          content: faker.lorem.sentence(),
          createdAt: new Date(Date.now() - Math.random() * 10000000)
        });
      }
      await post.save();
      console.log(`Created post for ${user.username}`);
    }
  }

  console.log('Stress test data created!');
  // Print summary and sample records to help verification
  try {
    const createdUsers = await User.find({ username: { $in: INDIAN_NAMES.map(n => n.toLowerCase()) } }).limit(20).lean();
    const userCount = await User.countDocuments({ username: { $in: INDIAN_NAMES.map(n => n.toLowerCase()) } });
    const postCount = await Post.countDocuments({ campus: CAMPUS });
    console.log(`Created users matching test list: ${userCount}`);
    createdUsers.forEach(u => console.log(` - ${u.username} <${u.email}> id:${u._id}`));
    console.log(`Total posts in campus '${CAMPUS}': ${postCount}`);
    const samplePosts = await Post.find({ campus: CAMPUS }).sort({ createdAt: -1 }).limit(5).select('author title createdAt comments').populate('author', 'username').lean();
    console.log('Recent sample posts:');
    samplePosts.forEach(p => console.log(` - post:${p._id} by:${p.author?.username || p.author} comments:${(p.comments||[]).length} title:${p.title || ''}`));
  } catch (e) {
    console.warn('Failed to read back samples:', e.message || e);
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
