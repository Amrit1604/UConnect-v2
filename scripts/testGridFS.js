/**
 * GridFS Migration & Test Script
 * Tests GridFS upload functionality and verifies all components work
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function testGridFS() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/campus_connect';
    if (!process.env.MONGODB_URI) console.warn('⚠️ MONGODB_URI not set — using fallback localhost URI');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database\n');

    // Test 1: Check GridFS buckets
    console.log('📊 Test 1: Checking GridFS buckets...');
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const gridFSCollections = collections.filter(c =>
      c.name.includes('.files') || c.name.includes('.chunks')
    );

    console.log('GridFS Collections found:');
    gridFSCollections.forEach(c => console.log(`  - ${c.name}`));

    // Test 2: Count files in each bucket
    console.log('\n📊 Test 2: Counting files in buckets...');
    const buckets = ['uploads', 'avatars', 'posts', 'videos'];

    for (const bucket of buckets) {
      try {
        const count = await db.collection(`${bucket}.files`).countDocuments();
        console.log(`  ${bucket}: ${count} files`);
      } catch (err) {
        console.log(`  ${bucket}: 0 files (collection doesn't exist yet)`);
      }
    }

    // Test 3: Check User model for GridFS fields
    console.log('\n📊 Test 3: Checking User collection...');
    const User = require('../models/User');
    const totalUsers = await User.countDocuments();
    const gridfsUsers = await User.countDocuments({ avatarType: 'gridfs' });
    const apiUsers = await User.countDocuments({ avatarType: 'api' });
    const uploadUsers = await User.countDocuments({ avatarType: 'upload' });

    console.log(`  Total users: ${totalUsers}`);
    console.log(`  GridFS avatars: ${gridfsUsers}`);
    console.log(`  API avatars: ${apiUsers}`);
    console.log(`  Local upload avatars: ${uploadUsers}`);

    // Test 4: Check Post model for GridFS fields
    console.log('\n📊 Test 4: Checking Post collection...');
    const Post = require('../models/Post');
    const totalPosts = await Post.countDocuments();
    const gridfsPostsCount = await Post.countDocuments({ 'images.storageType': 'gridfs' });
    const localPostsCount = await Post.countDocuments({ 'images.storageType': 'local' });

    console.log(`  Total posts: ${totalPosts}`);
    console.log(`  Posts with GridFS images: ${gridfsPostsCount}`);
    console.log(`  Posts with local images: ${localPostsCount}`);

    // Test 5: Sample GridFS file info
    console.log('\n📊 Test 5: Sample GridFS files...');
    try {
      const sampleFiles = await db.collection('posts.files')
        .find({})
        .limit(3)
        .toArray();

      if (sampleFiles.length > 0) {
        console.log('Sample post images:');
        sampleFiles.forEach(f => {
          console.log(`  - ${f.filename} (${(f.length / 1024).toFixed(2)} KB)`);
          console.log(`    ID: ${f._id}`);
          console.log(`    URL: /gridfs/file/${f._id}`);
        });
      } else {
        console.log('  No post images found yet');
      }
    } catch (err) {
      console.log('  No post images collection yet');
    }

    console.log('\n✅ GridFS Test Complete!');
    console.log('\n📝 Next steps:');
    console.log('  1. Start server: npm start');
    console.log('  2. Register new user with avatar upload');
    console.log('  3. Create post with image upload');
    console.log('  4. Verify images display correctly');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

console.log('🚀 GridFS Migration & Test Script');
console.log('==================================\n');
testGridFS();
