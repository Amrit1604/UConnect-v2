/**
 * Migrate Local Uploads to GridFS (MongoDB)
 * 
 * This script uploads all existing local files to MongoDB GridFS
 * and updates User/Post records with GridFS file IDs.
 * 
 * RUN THIS AFTER updating to GridFS: node scripts/migrateToGridFS.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Post = require('../models/Post');

let gfsBucket;

async function migrateToGridFS() {
  try {
    // Connect to database
    console.log('🔌 Connecting to database...');
    // mongoose v6+ and the underlying driver v4+ no longer require these options.
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    // Initialize GridFS
    const db = mongoose.connection.db;
    gfsBucket = new GridFSBucket(db, {
      bucketName: 'uploads'
    });
    console.log('✅ GridFS initialized');

    // Migrate avatars
    console.log('\n📸 === MIGRATING AVATARS ===');
    await migrateAvatars();

    // Migrate post images
    console.log('\n🖼️  === MIGRATING POST IMAGES ===');
    await migratePostImages();

    console.log('\n🎉 === MIGRATION COMPLETE ===');
    console.log('All files have been uploaded to MongoDB GridFS!');
    console.log('Users and posts now reference GridFS file IDs.');
    console.log('\n⚠️  IMPORTANT: You can now delete local uploads folder if desired.');
    console.log('But keep a backup just in case!');

  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

async function migrateAvatars() {
  const avatarsDir = path.join(__dirname, '../public/uploads/avatars');
  
  if (!fs.existsSync(avatarsDir)) {
    console.log('⚠️  No avatars directory found, skipping avatar migration');
    return;
  }

  const files = fs.readdirSync(avatarsDir);
  console.log(`Found ${files.length} avatar files`);

  let migratedCount = 0;
  let skippedCount = 0;

  for (const filename of files) {
    try {
      const filePath = path.join(avatarsDir, filename);
      const stats = fs.statSync(filePath);

      if (!stats.isFile()) {
        skippedCount++;
        continue;
      }

      // Find user with this avatar
      const user = await User.findOne({ avatar: filename, avatarType: 'upload' });

      if (!user) {
        console.log(`⚠️  No user found for avatar: ${filename} (orphaned file)`);
        skippedCount++;
        continue;
      }

      // Upload to GridFS
      const readStream = fs.createReadStream(filePath);
      const uploadStream = gfsBucket.openUploadStream(filename, {
        metadata: {
          originalName: filename,
          type: 'avatar',
          userId: user._id.toString(),
          uploadedAt: new Date()
        }
      });

      await new Promise((resolve, reject) => {
        readStream.pipe(uploadStream)
          .on('error', reject)
          .on('finish', resolve);
      });

      // Update user with GridFS file ID
      user.avatarGridFSId = uploadStream.id;
      user.avatarType = 'gridfs';
      await user.save();

      console.log(`✅ Migrated avatar for user ${user.username}: ${filename} → GridFS ID: ${uploadStream.id}`);
      migratedCount++;

    } catch (error) {
      console.error(`❌ Error migrating avatar ${filename}:`, error.message);
      skippedCount++;
    }
  }

  console.log(`\n📊 Avatar Migration Summary:`);
  console.log(`   Migrated: ${migratedCount}`);
  console.log(`   Skipped: ${skippedCount}`);
}

async function migratePostImages() {
  const postsDir = path.join(__dirname, '../public/uploads/posts');
  
  if (!fs.existsSync(postsDir)) {
    console.log('⚠️  No posts directory found, skipping post image migration');
    return;
  }

  const files = fs.readdirSync(postsDir);
  console.log(`Found ${files.length} post image files`);

  let migratedCount = 0;
  let skippedCount = 0;

  // Get all posts with images
  const posts = await Post.find({ 'images.0': { $exists: true } });
  console.log(`Found ${posts.length} posts with images`);

  for (const post of posts) {
    for (let i = 0; i < post.images.length; i++) {
      const image = post.images[i];
      const filename = image.filename;
      const filePath = path.join(postsDir, filename);

      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Image file not found: ${filename} (post ${post._id})`);
        skippedCount++;
        continue;
      }

      try {
        // Upload to GridFS
        const readStream = fs.createReadStream(filePath);
        const uploadStream = gfsBucket.openUploadStream(filename, {
          metadata: {
            originalName: image.originalName,
            type: 'post',
            postId: post._id.toString(),
            uploadedAt: new Date()
          }
        });

        await new Promise((resolve, reject) => {
          readStream.pipe(uploadStream)
            .on('error', reject)
            .on('finish', resolve);
        });

        // Update post image with GridFS file ID
        post.images[i].gridFSId = uploadStream.id;
        post.images[i].url = `/gridfs/${uploadStream.id}`;
        post.images[i].storageType = 'gridfs';

        console.log(`✅ Migrated post image: ${filename} → GridFS ID: ${uploadStream.id}`);
        migratedCount++;

      } catch (error) {
        console.error(`❌ Error migrating post image ${filename}:`, error.message);
        skippedCount++;
      }
    }

    // Save updated post
    await post.save();
  }

  console.log(`\n📊 Post Image Migration Summary:`);
  console.log(`   Migrated: ${migratedCount}`);
  console.log(`   Skipped: ${skippedCount}`);
}

// Run the migration
console.log('🚀 GRIDFS MIGRATION SCRIPT');
console.log('===========================\n');
console.log('This will upload all local files to MongoDB GridFS.');
console.log('Your local files will NOT be deleted (backup safety).\n');

migrateToGridFS();
