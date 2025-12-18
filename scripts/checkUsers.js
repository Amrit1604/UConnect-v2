/**
 * Quick script to check all users/emails in MongoDB
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const users = await mongoose.connection.db.collection('users').find({}).toArray();
    
    console.log(`📊 Total Users: ${users.length}\n`);
    console.log('═══════════════════════════════════════════════════════');
    
    users.forEach((u, i) => {
      console.log(`${i + 1}. ${u.email}`);
      console.log(`   Username: ${u.username}`);
      console.log(`   Verified: ${u.isVerified ? '✅ Yes' : '❌ No'}`);
      console.log(`   Created: ${u.createdAt || 'N/A'}`);
      console.log('');
    });

    console.log('═══════════════════════════════════════════════════════');
    
    // Also check pending verifications
    const pending = await mongoose.connection.db.collection('pendingusers').find({}).toArray();
    if (pending.length > 0) {
      console.log(`\n⏳ Pending Verifications: ${pending.length}`);
      pending.forEach((p, i) => {
        console.log(`${i + 1}. ${p.email} (${p.username})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkUsers();
