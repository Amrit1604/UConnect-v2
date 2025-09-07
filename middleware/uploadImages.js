/**
 * 🔥 MULTER CONFIGURATION FOR POST IMAGES ⚡
 * Handles file uploads for posts with proper validation
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// Ensure upload directories exist
const uploadDirs = [
  'public/uploads/posts',
  'public/uploads/avatars'
];

uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// Configure storage for post images
const postStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/posts');
  },
  filename: (req, file, cb) => {
    const uniqueName = `post-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Configure storage for avatars
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/avatars');
  },
  filename: (req, file, cb) => {
    const uniqueName = `avatar-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter for images
const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Post image upload middleware
const uploadPostImage = multer({
  storage: postStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5 // Maximum 5 images per post
  },
  fileFilter: imageFilter
});

// Avatar upload middleware
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
    files: 1 // Single avatar
  },
  fileFilter: imageFilter
});

// Image optimization middleware
const optimizeImage = async (filePath, width = 800, quality = 80) => {
  try {
    await sharp(filePath)
      .resize(width, null, {
        withoutEnlargement: true,
        fit: 'inside'
      })
      .jpeg({ quality })
      .toFile(filePath.replace(/\.[^/.]+$/, '_optimized.jpg'));

    // Replace original with optimized
    fs.unlinkSync(filePath);
    fs.renameSync(filePath.replace(/\.[^/.]+$/, '_optimized.jpg'), filePath);

    console.log(`✅ Image optimized: ${path.basename(filePath)}`);
  } catch (error) {
    console.error('❌ Image optimization failed:', error.message);
  }
};

module.exports = {
  uploadPostImage,
  uploadAvatar,
  optimizeImage
};
