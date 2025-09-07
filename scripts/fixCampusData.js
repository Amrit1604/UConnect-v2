/**
 * Fix Campus Data Script
 * Updates all users without a campus to use "Main Campus"
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/campus_connect', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function fixCampusData() {
  try {
    console.log('🔧 Starting campus data fix...');

    // Find users without campus
    const usersWithoutCampus = await User.find({
      $or: [
        { campus: null },
        { campus: undefined },
        { campus: '' }
      ]
    });

    console.log(`📊 Found ${usersWithoutCampus.length} users without campus`);

    // Update users to have "Main Campus"
    const userUpdateResult = await User.updateMany(
      {
        $or: [
          { campus: null },
          { campus: undefined },
          { campus: '' }
        ]
      },
      { campus: 'Main Campus' }
    );

    console.log(`✅ Updated ${userUpdateResult.modifiedCount} users to "Main Campus"`);

    // Find posts without campus
    const postsWithoutCampus = await Post.find({
      $or: [
        { campus: null },
        { campus: undefined },
        { campus: '' }
      ]
    });

    console.log(`📊 Found ${postsWithoutCampus.length} posts without campus`);

    // Update posts to have "Main Campus"
    const postUpdateResult = await Post.updateMany(
      {
        $or: [
          { campus: null },
          { campus: undefined },
          { campus: '' }
        ]
      },
      { campus: 'Main Campus' }
    );

    console.log(`✅ Updated ${postUpdateResult.modifiedCount} posts to "Main Campus"`);

    // Verify the fix
    const usersStillWithoutCampus = await User.countDocuments({
      $or: [
        { campus: null },
        { campus: undefined },
        { campus: '' }
      ]
    });

    const postsStillWithoutCampus = await Post.countDocuments({
      $or: [
        { campus: null },
        { campus: undefined },
        { campus: '' }
      ]
    });

    console.log(`🔍 Verification:`);
    console.log(`   Users without campus: ${usersStillWithoutCampus}`);
    console.log(`   Posts without campus: ${postsStillWithoutCampus}`);

    // Show campus distribution
    const campusStats = await User.aggregate([
      { $group: { _id: '$campus', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('\n📊 Campus Distribution:');
    campusStats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count} users`);
    });

    console.log('\n🎉 Campus data fix completed successfully!');

  } catch (error) {
    console.error('❌ Error fixing campus data:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the fix
fixCampusData();
