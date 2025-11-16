/*
 * Seed sample users for follow/unfollow testing
 * Usage: node scripts/seedFollowUsers.js
 */
require('dotenv').config();
const { connectDB } = require('../config/database');
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  try {
    await connectDB();

    const campus = 'Main Campus';
    const now = new Date();

    const samples = [
      {
        email: 'neo_student1@gmail.com',
        name: 'Neo Student One',
        username: 'neo_student1',
        password: 'Password@123',
        isVerified: true,
        campus,
        avatarType: 'api',
        avatarSeed: 'neo-student-one',
        stats: { postsCount: 0, followersCount: 0, followingCount: 0, totalLikesReceived: 0, commentsCount: 0 },
        createdAt: now,
        updatedAt: now,
      },
      {
        email: 'neo_student2@gmail.com',
        name: 'Neo Student Two',
        username: 'neo_student2',
        password: 'Password@123',
        isVerified: true,
        campus,
        avatarType: 'api',
        avatarSeed: 'neo-student-two',
        stats: { postsCount: 0, followersCount: 0, followingCount: 0, totalLikesReceived: 0, commentsCount: 0 },
        createdAt: now,
        updatedAt: now,
      },
      {
        email: 'neo_student3@gmail.com',
        name: 'Neo Student Three',
        username: 'neo_student3',
        password: 'Password@123',
        isVerified: true,
        campus,
        avatarType: 'api',
        avatarSeed: 'neo-student-three',
        stats: { postsCount: 0, followersCount: 0, followingCount: 0, totalLikesReceived: 0, commentsCount: 0 },
        createdAt: now,
        updatedAt: now,
      },
    ];

    // Upsert by email/username to avoid duplicates
    const results = [];
    for (const s of samples) {
      const existing = await User.findOne({ $or: [{ email: s.email }, { username: s.username }] });
      if (existing) {
        results.push({ action: 'skipped', id: existing._id, email: existing.email, username: existing.username });
        continue;
      }
      const user = new User(s);
      await user.save();
      results.push({ action: 'created', id: user._id, email: user.email, username: user.username });
    }

    console.table(results);
    console.log('\n✅ Seeding complete. You can now login as any of:');
    samples.forEach(s => console.log(` - ${s.email} / Password@123`));

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
})();
