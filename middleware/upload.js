const multer = require('multer');

// Configure multer for temporary avatar storage (memory storage for registration)
const tempAvatarStorage = multer.memoryStorage();

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

module.exports = {
  uploadAvatarTemp
};
