/**
 * Supabase Upload Middleware
 * Handles file uploads with optimization before sending to Supabase
 */

const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const { uploadFile, generateFilePath } = require('../services/supabaseStorage');

// Use memory storage (files stored in RAM, then sent to Supabase)
const storage = multer.memoryStorage();

// File size limits
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB for images
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB for videos

// File filter for images and videos
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const allowedVideoTypes = /mp4|webm|mov|avi/;
  
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const mimetype = file.mimetype;

  if (mimetype.startsWith('image/') && allowedImageTypes.test(ext)) {
    return cb(null, true);
  } else if (mimetype.startsWith('video/') && allowedVideoTypes.test(ext)) {
    return cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed: images (${allowedImageTypes.source}) and videos (${allowedVideoTypes.source})`));
  }
};

// Multer configuration for posts (images + videos)
const uploadPostMedia = multer({
  storage: storage,
  limits: {
    fileSize: MAX_VIDEO_SIZE // Max limit (videos can be up to 50MB)
  },
  fileFilter: fileFilter
}).fields([
  { name: 'images', maxCount: 5 },
  { name: 'videos', maxCount: 2 }
]);

// Multer configuration for avatars (images only)
const uploadAvatar = multer({
  storage: storage,
  limits: {
    fileSize: MAX_IMAGE_SIZE
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const mimetype = file.mimetype;

    if (mimetype.startsWith('image/') && allowedTypes.test(ext)) {
      return cb(null, true);
    } else {
      cb(new Error('Only images are allowed for avatars'));
    }
  }
}).single('avatar');

// Multer configuration for chat media
const uploadChatMedia = multer({
  storage: storage,
  limits: {
    fileSize: MAX_VIDEO_SIZE
  },
  fileFilter: fileFilter
}).single('media');

/**
 * Process and upload image to Supabase with optimization
 * @param {Buffer} buffer - Image buffer
 * @param {String} folder - Folder name (avatars/posts/chat)
 * @param {String} userId - User ID
 * @param {String} filename - Original filename
 * @returns {Promise<Object>} { url, path, size, error }
 */
async function processAndUploadImage(buffer, folder, userId, filename) {
  try {
    console.log(`🖼️ Optimizing image: ${filename}`);

    // Optimize image with Sharp
    const optimizedBuffer = await sharp(buffer)
      .resize(1920, 1920, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();

    const filePath = generateFilePath(folder, userId, filename.replace(/\.[^.]+$/, '.jpg'));
    const result = await uploadFile(optimizedBuffer, filePath, 'image/jpeg');

    return {
      url: result.url,
      path: result.path,
      size: optimizedBuffer.length,
      error: result.error
    };
  } catch (error) {
    console.error('❌ Image processing error:', error);
    return { error: error.message };
  }
}

/**
 * Upload video to Supabase (no processing, direct upload)
 * @param {Buffer} buffer - Video buffer
 * @param {String} folder - Folder name
 * @param {String} userId - User ID
 * @param {String} filename - Original filename
 * @param {String} mimetype - Video MIME type
 * @returns {Promise<Object>} { url, path, size, error }
 */
async function uploadVideo(buffer, folder, userId, filename, mimetype) {
  try {
    console.log(`🎥 Uploading video: ${filename} (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);

    const filePath = generateFilePath(folder, userId, filename);
    const result = await uploadFile(buffer, filePath, mimetype);

    return {
      url: result.url,
      path: result.path,
      size: buffer.length,
      error: result.error
    };
  } catch (error) {
    console.error('❌ Video upload error:', error);
    return { error: error.message };
  }
}

/**
 * Middleware to handle post media upload (called after multer)
 * Processes files and uploads to Supabase
 */
async function handlePostMediaUpload(req, res, next) {
  try {
    if (!req.files) {
      return next();
    }

    const userId = req.user._id.toString();
    req.uploadedMedia = { images: [], videos: [] };

    // Process images
    if (req.files.images) {
      console.log(`📸 Processing ${req.files.images.length} images`);
      
      for (const file of req.files.images) {
        const result = await processAndUploadImage(
          file.buffer,
          'posts',
          userId,
          file.originalname
        );

        if (result.error) {
          console.error(`❌ Failed to upload image: ${file.originalname}`, result.error);
          continue;
        }

        req.uploadedMedia.images.push({
          filename: path.basename(result.path),
          originalName: file.originalname,
          size: result.size,
          mimetype: 'image/jpeg',
          url: result.url,
          path: result.path,
          storageType: 'supabase'
        });
      }
    }

    // Process videos
    if (req.files.videos) {
      console.log(`🎥 Processing ${req.files.videos.length} videos`);
      
      for (const file of req.files.videos) {
        // Check size limit
        if (file.size > MAX_VIDEO_SIZE) {
          console.warn(`⛔ Video too large: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
          continue;
        }

        const result = await uploadVideo(
          file.buffer,
          'posts',
          userId,
          file.originalname,
          file.mimetype
        );

        if (result.error) {
          console.error(`❌ Failed to upload video: ${file.originalname}`, result.error);
          continue;
        }

        req.uploadedMedia.videos.push({
          type: 'video',
          filename: path.basename(result.path),
          originalName: file.originalname,
          size: result.size,
          mimetype: file.mimetype,
          url: result.url,
          path: result.path,
          storageType: 'supabase'
        });
      }
    }

    next();
  } catch (error) {
    console.error('❌ Media upload middleware error:', error);
    next(error);
  }
}

/**
 * Middleware to handle avatar upload (called after multer)
 */
async function handleAvatarUpload(req, res, next) {
  try {
    if (!req.file) {
      return next();
    }

    const userId = req.user._id.toString();

    const result = await processAndUploadImage(
      req.file.buffer,
      'avatars',
      userId,
      req.file.originalname
    );

    if (result.error) {
      return res.status(500).json({ error: 'Failed to upload avatar', details: result.error });
    }

    req.uploadedAvatar = {
      url: result.url,
      path: result.path,
      size: result.size,
      storageType: 'supabase'
    };

    next();
  } catch (error) {
    console.error('❌ Avatar upload error:', error);
    next(error);
  }
}

module.exports = {
  uploadPostMedia,
  uploadAvatar,
  uploadChatMedia,
  handlePostMediaUpload,
  handleAvatarUpload,
  processAndUploadImage,
  uploadVideo
};
