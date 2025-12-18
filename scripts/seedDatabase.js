/**
 * Database Seeding Script - UConnect
 * Creates initial data for development and testing
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');
const Post = require('../models/Post');

// Sample data
const sampleUsers = [
  {
    email: 'admin@iitdelhi.edu.in',
    name: 'Admin User',
    username: 'admin',
    password: 'AdminPass123!',
    role: 'admin',
    isVerified: true,
    isActive: true
  },
  {
    email: 'priya.sharma@iitdelhi.edu.in',
    name: 'Priya Sharma',
    username: 'priya_sharma',
    password: 'StudentPass123!',
    role: 'student',
    isVerified: true,
    isActive: true
  },
  {
    email: 'rahul.kumar@iitdelhi.edu.in',
    name: 'Rahul Kumar',
    username: 'rahul_kumar',
    password: 'StudentPass123!',
    role: 'student',
    isVerified: true,
    isActive: true
  },
  {
    email: 'ananya.patel@iitdelhi.edu.in',
    name: 'Ananya Patel',
    username: 'ananya_patel',
    password: 'StudentPass123!',
    role: 'student',
    isVerified: true,
    isActive: true
  },
  {
    email: 'arjun.singh@iitdelhi.edu.in',
    name: 'Arjun Singh',
    username: 'arjun_singh',
    password: 'StudentPass123!',
    role: 'student',
    isVerified: true,
    isActive: true
  }
];

const samplePosts = [
  {
    content: "Just finished my Machine Learning project! Anyone interested in collaborating on AI research? The possibilities are endless and I'd love to work with fellow students on innovative projects. 🤖",
    campus: 'iitdelhi'
  },
  {
    content: "Tech fest planning meeting tomorrow at 4 PM in the auditorium. All volunteers welcome! We need help with organizing events, managing logistics, and coordinating with sponsors. 🎉",
    campus: 'iitdelhi'
  },
  {
    content: "Looking for study partners for the upcoming algorithms exam. Let's form a study group and tackle those complex problems together! 📚",
    campus: 'iitdelhi'
  },
  {
    content: "Amazing guest lecture by Dr. Smith on quantum computing today! The future of technology is so exciting. Anyone else attended? Would love to discuss the key takeaways.",
    campus: 'iitdelhi'
  },
  {
    content: "Campus placement season is here! Tips for interview preparation: practice coding problems daily, work on communication skills, and research the companies thoroughly. Good luck everyone! 💼",
    campus: 'iitdelhi'
  },
  {
    content: "Organizing a hackathon next month. Theme: 'Technology for Social Good'. Registration opens soon. Start thinking about innovative solutions to real-world problems! 💻",
    campus: 'iitdelhi'
  },
  {
    content: "Beautiful sunset from the campus library today. Sometimes we need to take a break from studies and appreciate the little things in life. 🌅",
    campus: 'iitdelhi'
  },
  {
    content: "New research paper published on renewable energy systems! Proud to be part of this groundbreaking work. Link in bio for those interested in sustainable technology.",
    campus: 'iitdelhi'
  }
];

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/campus_connect', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await User.deleteMany({});
    await Post.deleteMany({});
    console.log('✅ Existing data cleared');

    // Create users
    console.log('👥 Creating users...');
    const createdUsers = [];

    for (const userData of sampleUsers) {
      const user = new User(userData);
      await user.save();
      createdUsers.push(user);
      console.log(`✅ Created user: ${user.displayName} (${user.email})`);
    }

    // Create posts
    console.log('📝 Creating posts...');
    const studentUsers = createdUsers.filter(user => user.role === 'student');

    for (let i = 0; i < samplePosts.length; i++) {
      const postData = samplePosts[i];
      const randomUser = studentUsers[Math.floor(Math.random() * studentUsers.length)];

      const post = new Post({
        ...postData,
        author: randomUser._id,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) // Random time within last 7 days
      });

      await post.save();

      // Add some random likes
      const likeCount = Math.floor(Math.random() * 15) + 1;
      const likers = [];

      for (let j = 0; j < likeCount; j++) {
        const randomLiker = studentUsers[Math.floor(Math.random() * studentUsers.length)];
        if (!likers.includes(randomLiker._id.toString()) && randomLiker._id.toString() !== randomUser._id.toString()) {
          post.addLike(randomLiker._id);
          likers.push(randomLiker._id.toString());
        }
      }

      // Add some random comments
      const commentCount = Math.floor(Math.random() * 5);
      const comments = [
        "Great post! Thanks for sharing.",
        "I'm interested! Let me know how I can help.",
        "This is exactly what I was looking for.",
        "Count me in!",
        "Awesome initiative!",
        "Very informative, thanks!",
        "Looking forward to this!",
        "Great idea! Let's collaborate.",
        "This is so helpful!",
        "Thanks for organizing this!"
      ];

      for (let k = 0; k < commentCount; k++) {
        const randomCommenter = studentUsers[Math.floor(Math.random() * studentUsers.length)];
        const randomComment = comments[Math.floor(Math.random() * comments.length)];
        post.addComment(randomCommenter._id, randomComment);
      }

      await post.save();

      // Update user stats
      await User.findByIdAndUpdate(randomUser._id, {
        $inc: {
          'stats.postsCount': 1,
          'stats.likesReceived': post.likeCount
        }
      });

      console.log(`✅ Created post by ${randomUser.displayName}`);
    }

    // Update user comment stats
    console.log('📊 Updating user statistics...');
    for (const user of studentUsers) {
      const commentCount = await Post.aggregate([
        { $unwind: '$comments' },
        { $match: { 'comments.author': user._id } },
        { $count: 'total' }
      ]);

      await User.findByIdAndUpdate(user._id, {
        'stats.commentsCount': commentCount[0]?.total || 0
      });
    }

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   Users created: ${createdUsers.length}`);
    console.log(`   Posts created: ${samplePosts.length}`);
    console.log('\n🔐 Admin credentials:');
    console.log('   Email: admin@iitdelhi.edu.in');
    console.log('   Password: AdminPass123!');
    console.log('\n👤 Sample student credentials:');
    console.log('   Email: priya.sharma@iitdelhi.edu.in');
    console.log('   Password: StudentPass123!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the seeding script
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;