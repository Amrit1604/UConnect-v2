/**
 * GridFS Configuration for MongoDB File Storage
 * Handles avatar and post image uploads directly to MongoDB
 */

const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const multer = require('multer');
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
 * Upload file buffer to GridFS
 */
async function uploadToGridFS(fileBuffer, filename, metadata) {
  return new Promise((resolve, reject) => {
    const bucket = getGridFSBucket();
    if (!bucket) {
      return reject(new Error('GridFS not initialized'));
    }

    const uploadStream = bucket.openUploadStream(filename, {
      metadata: metadata
    });

    uploadStream.on('error', reject);
    uploadStream.on('finish', () => {
      resolve({
        id: uploadStream.id,
        filename: filename
      });
    });

    uploadStream.end(fileBuffer);
  });
}

/**
 * Multer memory storage for avatars
 */
const avatarUploadMemory = multer({
  storage: multer.memoryStorage(),
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
});

/**
 * Multer memory storage for post images
 */
const postImagesUploadMemory = multer({
  storage: multer.memoryStorage(),
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
});

/**
 * Middleware to upload avatar to GridFS after multer processes it
 */
const uploadAvatar = [
  avatarUploadMemory.single('avatar'),
  async (req, res, next) => {
    if (!req.file) {
      return next();
    }

    try {
      const filename = crypto.randomBytes(16).toString('hex') + path.extname(req.file.originalname);
      const result = await uploadToGridFS(req.file.buffer, filename, {
        originalName: req.file.originalname,
        type: 'avatar',
        userId: req.user ? req.user._id.toString() : null,
        uploadedAt: new Date()
      });

      // Add GridFS info to req.file
      req.file.id = result.id;
      req.file.filename = result.filename;
      
      next();
    } catch (error) {
      console.error('Error uploading to GridFS:', error);
      next(error);
    }
  }
];

/**
 * Middleware to upload post images to GridFS after multer processes them
 */
const uploadPostImages = [
  postImagesUploadMemory.array('images', 5),
  async (req, res, next) => {
    if (!req.files || req.files.length === 0) {
      return next();
    }

    try {
      const uploadPromises = req.files.map(async (file) => {
        const filename = crypto.randomBytes(16).toString('hex') + path.extname(file.originalname);
        const result = await uploadToGridFS(file.buffer, filename, {
          originalName: file.originalname,
          type: 'post',
          userId: req.user ? req.user._id.toString() : null,
          uploadedAt: new Date()
        });

        // Add GridFS info to file object
        file.id = result.id;
        file.filename = result.filename;
        
        return file;
      });

      await Promise.all(uploadPromises);
      next();
    } catch (error) {
      console.error('Error uploading to GridFS:', error);
      next(error);
    }
  }
];

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
