const mongoose = require('mongoose');

/**
 * Database Configuration
 * Handles MongoDB connection setup
 */
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/campus_connect';
    console.log('🔍 Attempting to connect to MongoDB...');
    console.log('📍 MongoDB URI:', mongoUri ? 'URI is set' : 'URI is NOT set');
    console.log('📏 URI length:', mongoUri.length);

    // The MongoDB Node.js driver 4.x removed the need for these options;
    // passing them causes deprecation warnings. Connect with the URI only.
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    console.error('❌ URI being used:', process.env.MONGODB_URI);
    process.exit(1);
  }
};

module.exports = { connectDB };