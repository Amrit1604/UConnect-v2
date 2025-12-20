/**
 * PendingRegistration Model - UConnect
 * Stores temporary registration data until email is verified
 */

const mongoose = require('mongoose');

const pendingRegistrationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true
  },

  name: {
    type: String,
    required: true
  },

  username: {
    type: String,
    required: true,
    lowercase: true
  },

  encryptedPassword: {
    type: String,
    required: true
  },

  verificationToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  avatarType: {
    type: String,
    enum: ['api', 'upload', 'gridfs'],
    default: 'api'
  },

  avatarSeed: String,

  // For uploaded avatars
  tempAvatar: {
    data: String,  // base64 encoded
    originalname: String,
    mimetype: String
  },

  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }  // TTL index - MongoDB auto-deletes when expiresAt is reached
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create indexes
pendingRegistrationSchema.index({ verificationToken: 1 });
pendingRegistrationSchema.index({ expiresAt: 1 });

const PendingRegistration = mongoose.model('PendingRegistration', pendingRegistrationSchema);

module.exports = PendingRegistration;
