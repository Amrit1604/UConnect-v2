/**
 * GridFS Utility for Avatar Storage
 * Handles file uploads and deletions using MongoDB GridFS
 */

const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');

// Global GridFSBucket instance
let gfsBucket;

/**
 * Initialize GridFS bucket
 * Call this after mongoose connection is established
 */
function initGridFS() {
  try {
    const db = mongoose.connection.db;
    gfsBucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: 'uploads'
    });
    console.log('✅ GridFS initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing GridFS:', error);
  }
}

/**
 * Get the GridFS bucket instance
 */
function getGridFSBucket() {
  if (!gfsBucket) {
    const db = mongoose.connection.db;
    gfsBucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: 'uploads'
    });
  }
  return gfsBucket;
}

// GridFS storage configuration
const storage = new GridFsStorage({
  url: process.env.MONGODB_URI,
  options: { useNewUrlParser: true, useUnifiedTopology: true },
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString('hex') + path.extname(file.originalname);

        // Determine bucket based on file type
        let bucketName = 'uploads';
        if (file.fieldname === 'avatar') {
          bucketName = 'avatars';
        } else if (file.fieldname === 'images' || file.fieldname === 'image') {
          bucketName = 'posts';
        } else if (file.fieldname === 'videos' || file.fieldname === 'video') {
          bucketName = 'videos';
        }

        const fileInfo = {
          filename: filename,
          bucketName: bucketName,
          metadata: {
            originalName: file.originalname,
            uploadedBy: req.user ? req.user._id : null,
            uploadedAt: new Date(),
            fieldname: file.fieldname
          }
        };
        resolve(fileInfo);
      });
    });
  }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

// Multer upload middleware for avatars
const uploadAvatar = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
}).single('avatar');

// Multer upload middleware for post images (multiple files)
const uploadPostImages = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit per file
  },
  fileFilter: fileFilter
}).array('images', 5); // Max 5 images per post

// Multer upload middleware for single post image
const uploadPostImage = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
}).single('image');

// Combined upload for posts with images and videos
const uploadPostMedia = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max per file
  },
  fileFilter: (req, file, cb) => {
    // Allow both images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  }
}).fields([
  { name: 'images', maxCount: 5 },
  { name: 'videos', maxCount: 1 }
]);

// Chat media upload (voice, images, videos, files)
const uploadChatMedia = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB max for chat files
  },
  fileFilter: (req, file, cb) => {
    // Allow images, videos, audio, and common file types
    const allowedMimeTypes = [
      'image/',
      'video/',
      'audio/',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument',
      'text/plain',
      'application/zip',
      'application/x-rar'
    ];

    const isAllowed = allowedMimeTypes.some(type => file.mimetype.startsWith(type));

    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed for chat'), false);
    }
  }
}).single('file');

/**
 * Delete a file from GridFS by ID
 * @param {string} fileId - The GridFS file ID
 * @returns {Promise<boolean>} - True if deleted successfully
 */
async function deleteFile(fileId) {
  try {
    if (!fileId) {
      console.log('⚠️ No fileId provided to deleteFile');
      return false;
    }

    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: 'uploads'
    });

    // Convert string ID to ObjectId if needed
    const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;

    await bucket.delete(objectId);
    console.log('✅ GridFS file deleted:', fileId);
    return true;
  } catch (error) {
    // Common during cleanup: file already gone
    const message = (error && error.message) ? error.message : String(error);
    if (typeof message === 'string' && message.toLowerCase().includes('file not found')) {
      console.warn('⚠️ GridFS file already missing, skipping delete:', fileId);
      return false;
    }
    console.error('❌ Error deleting GridFS file:', error);
    return false;
  }
}

/**
 * Get a file stream from GridFS
 * @param {string} fileId - The GridFS file ID
 * @returns {ReadStream} - File stream
 */
function getFileStream(fileId) {
  const db = mongoose.connection.db;
  const bucket = new mongoose.mongo.GridFSBucket(db, {
    bucketName: 'uploads'
  });

  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  return bucket.openDownloadStream(objectId);
}

/**
 * Get file info from GridFS
 * @param {string} fileId - The GridFS file ID
 * @returns {Promise<Object>} - File metadata
 */
async function getFileInfo(fileId) {
  try {
    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: 'uploads'
    });

    const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;

    // Find the file in the uploads.files collection
    const files = await db.collection('uploads.files').find({ _id: objectId }).toArray();

    if (files.length === 0) {
      throw new Error('File not found');
    }

    return files[0];
  } catch (error) {
    console.error('❌ Error getting file info:', error);
    throw error;
  }
}

/**
 * Save buffer to GridFS
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @param {Object} metadata - Additional metadata
 * @param {string} bucketName - Bucket name (default: 'uploads')
 * @returns {Promise<ObjectId>} - GridFS file ID
 */
async function saveBufferToGridFS(buffer, filename, metadata = {}, bucketName = 'uploads') {
  return new Promise((resolve, reject) => {
    try {
      const db = mongoose.connection.db;
      const bucket = new mongoose.mongo.GridFSBucket(db, {
        bucketName: bucketName
      });

      const uploadStream = bucket.openUploadStream(filename, {
        metadata: {
          ...metadata,
          uploadedAt: new Date()
        }
      });

      uploadStream.on('finish', () => {
        console.log(`✅ Buffer saved to GridFS: ${filename} (ID: ${uploadStream.id})`);
        resolve(uploadStream.id);
      });

      uploadStream.on('error', (error) => {
        console.error(`❌ Error saving buffer to GridFS:`, error);
        reject(error);
      });

      uploadStream.end(buffer);
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  initGridFS,
  getGridFSBucket,
  uploadAvatar,
  uploadPostImages,
  uploadPostImage,
  uploadPostMedia,
  uploadChatMedia,
  deleteFile,
  getFileStream,
  getFileInfo,
  saveBufferToGridFS
};
