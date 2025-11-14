/**
 * GridFS Configuration for MongoDB File Storage
 * Handles avatar and post image uploads directly to MongoDB
 */

const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const path = require('path');
const crypto = require('crypto');

let gfsBucket;

/**
 * Initialize GridFS bucket after MongoDB connection
 */
function initGridFS() {
  if (mongoose.connection.readyState === 1) {
    const db = mongoose.connection.db;
    gfsBucket = new GridFSBucket(db, {
      bucketName: 'uploads'
    });
    console.log('✅ GridFS initialized successfully');
    return gfsBucket;
  } else {
    console.error('❌ MongoDB not connected - GridFS initialization failed');
    return null;
  }
}

/**
 * Get GridFS bucket instance
 */
function getGridFSBucket() {
  if (!gfsBucket) {
    return initGridFS();
  }
  return gfsBucket;
}

/**
 * Create GridFS storage for avatars
 */
function createAvatarStorage() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI not set in environment');
    return null;
  }

  return new GridFsStorage({
    url: process.env.MONGODB_URI,
    file: (req, file) => {
      return new Promise((resolve, reject) => {
        crypto.randomBytes(16, (err, buf) => {
          if (err) {
            return reject(err);
          }
          const filename = buf.toString('hex') + path.extname(file.originalname);
          const fileInfo = {
            filename: filename,
            bucketName: 'uploads',
            metadata: {
              originalName: file.originalname,
              type: 'avatar',
              userId: req.user ? req.user._id.toString() : null,
              uploadedAt: new Date()
            }
          };
          resolve(fileInfo);
        });
      });
    }
  });
}

/**
 * Create GridFS storage for post images
 */
function createPostImageStorage() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI not set in environment');
    return null;
  }

  return new GridFsStorage({
    url: process.env.MONGODB_URI,
    file: (req, file) => {
      return new Promise((resolve, reject) => {
        crypto.randomBytes(16, (err, buf) => {
          if (err) {
            return reject(err);
          }
          const filename = buf.toString('hex') + path.extname(file.originalname);
          const fileInfo = {
            filename: filename,
            bucketName: 'uploads',
            metadata: {
              originalName: file.originalname,
              type: 'post',
              userId: req.user ? req.user._id.toString() : null,
              uploadedAt: new Date()
            }
          };
          resolve(fileInfo);
        });
      });
    }
  });
}

const avatarStorage = createAvatarStorage();
const postImageStorage = createPostImageStorage();

/**
 * Multer upload middleware for avatars
 */
const uploadAvatar = avatarStorage ? multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
  }
}) : null;

/**
 * Multer upload middleware for post images
 */
const uploadPostImages = postImageStorage ? multer({
  storage: postImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
  }
}) : null;

/**
 * Delete file from GridFS by ID
 */
async function deleteFile(fileId) {
  try {
    const bucket = getGridFSBucket();
    if (!bucket) {
      throw new Error('GridFS bucket not initialized');
    }
    
    await bucket.delete(new mongoose.Types.ObjectId(fileId));
    console.log(`✅ Deleted file from GridFS: ${fileId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error deleting file from GridFS:`, error);
    return false;
  }
}

/**
 * Get file stream from GridFS
 */
function getFileStream(fileId) {
  const bucket = getGridFSBucket();
  if (!bucket) {
    throw new Error('GridFS bucket not initialized');
  }
  
  return bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));
}

/**
 * Get file metadata from GridFS
 */
async function getFileMetadata(fileId) {
  try {
    const bucket = getGridFSBucket();
    if (!bucket) {
      throw new Error('GridFS bucket not initialized');
    }

    const files = await bucket.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();
    return files.length > 0 ? files[0] : null;
  } catch (error) {
    console.error('Error getting file metadata:', error);
    return null;
  }
}

module.exports = {
  initGridFS,
  getGridFSBucket,
  uploadAvatar,
  uploadPostImages,
  deleteFile,
  getFileStream,
  getFileMetadata
};
