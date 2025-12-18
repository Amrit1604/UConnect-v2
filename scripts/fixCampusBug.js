/**
 * CRITICAL FIX: Campus Isolation Bug
 *
 * This script updates ALL users to "Main Campus" to fix the issue where
 * users couldn't see each other's posts due to different campus assignments.
 *
 * RUN THIS IMMEDIATELY: node scripts/fixCampusBug.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');

async function fixCampusBug() {
  try {
    // Connect to database
    console.log('🔌 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to database');

    // Update ALL users to Main Campus
    console.log('\n📊 Checking users...');
    const usersBeforeFix = await User.find({});
    console.log(`Found ${usersBeforeFix.length} total users`);

    usersBeforeFix.forEach(user => {
      console.log(`  - ${user.username} (${user.email}): campus = "${user.campus}"`);
    });

    console.log('\n🔧 Updating all users to Main Campus...');
    const userUpdateResult = await User.updateMany(
      {},
      { $set: { campus: 'Main Campus' } }
    );
    console.log(`✅ Updated ${userUpdateResult.modifiedCount} users`);

    // Update ALL posts to Main Campus
    console.log('\n📝 Checking posts...');
    const postsBeforeFix = await Post.find({});
    console.log(`Found ${postsBeforeFix.length} total posts`);

    const postsByCampus = {};
    postsBeforeFix.forEach(post => {
      postsByCampus[post.campus] = (postsByCampus[post.campus] || 0) + 1;
    });
    console.log('Posts by campus:', postsByCampus);

    console.log('\n🔧 Updating all posts to Main Campus...');
    const postUpdateResult = await Post.updateMany(
      {},
      { $set: { campus: 'Main Campus' } }
    );
    console.log(`✅ Updated ${postUpdateResult.modifiedCount} posts`);

    // Verify the fix
    console.log('\n✅ VERIFICATION:');
    const usersAfterFix = await User.find({});
    const mainCampusUsers = usersAfterFix.filter(u => u.campus === 'Main Campus');
    console.log(`✅ ${mainCampusUsers.length}/${usersAfterFix.length} users now on Main Campus`);

    const postsAfterFix = await Post.find({});
    const mainCampusPosts = postsAfterFix.filter(p => p.campus === 'Main Campus');
    console.log(`✅ ${mainCampusPosts.length}/${postsAfterFix.length} posts now on Main Campus`);

    if (mainCampusUsers.length === usersAfterFix.length && mainCampusPosts.length === postsAfterFix.length) {
      console.log('\n🎉 SUCCESS! All users and posts are now on Main Campus.');
      console.log('🔥 Users can now see each other\'s posts!');
    } else {
      console.log('\n⚠️ WARNING: Some users or posts still not on Main Campus');
    }

    console.log('\n📊 Final Stats:');
    console.log(`Total Users: ${usersAfterFix.length}`);
    console.log(`Total Active Posts: ${postsAfterFix.filter(p => p.isActive).length}`);
    console.log(`Total Posts: ${postsAfterFix.length}`);

  } catch (error) {
    console.error('❌ Error fixing campus bug:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the fix
console.log('🚨 CRITICAL FIX: Campus Isolation Bug');
console.log('=====================================\n');
fixCampusBug();
