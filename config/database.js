const mongoose = require('mongoose');

/**
 * Database Configuration
 * Handles MongoDB connection setup
 */
const connectDB = async () => {
  try {
    // The MongoDB Node.js driver 4.x removed the need for these options;
    // passing them causes deprecation warnings. Connect with the URI only.
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/campus_connect');
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
};

module.exports = { connectDB };