const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../public/uploads/avatars');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for temporary avatar storage (memory storage for registration)
const tempAvatarStorage = multer.memoryStorage();

// Configure multer for permanent avatar storage (after verification)
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for images only
const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// Create multer upload middleware for temporary storage (registration)
const uploadAvatarTemp = multer({
  storage: tempAvatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: imageFilter
});

// Create multer upload middleware for permanent storage
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: imageFilter
});

// Helper function to save temporary avatar to permanent location
const saveTempAvatarToDisk = (tempAvatarData, originalname) => {
  return new Promise((resolve, reject) => {
    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const filename = 'avatar-' + uniqueSuffix + path.extname(originalname);
      const filepath = path.join(uploadsDir, filename);

      console.log(`💾 Saving avatar to: ${filepath}`);
      console.log(`📊 Avatar data size: ${tempAvatarData.length} bytes`);

      fs.writeFile(filepath, tempAvatarData, (err) => {
        if (err) {
          console.error(`❌ Failed to save avatar: ${err.message}`);
          reject(err);
        } else {
          console.log(`✅ Avatar saved successfully: ${filename}`);
          resolve(filename);
        }
      });
    } catch (error) {
      console.error(`❌ Error in saveTempAvatarToDisk: ${error.message}`);
      reject(error);
    }
  });
};

module.exports = {
  uploadAvatar,
  uploadAvatarTemp,
  saveTempAvatarToDisk
};
