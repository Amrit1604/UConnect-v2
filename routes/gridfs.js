/**
 * GridFS File Serving Routes
 * Serves images stored in MongoDB GridFS
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { getFileStream, getFileMetadata } = require('../utils/gridfs');

/**
 * GET /gridfs/:fileId
 * Serve any file from GridFS by ID
 */
router.get('/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).send('Invalid file ID');
    }

    // Get file metadata
    const file = await getFileMetadata(fileId);
    
    if (!file) {
      return res.status(404).send('File not found');
    }

    // Set content type based on file metadata
    res.set('Content-Type', file.contentType || 'image/jpeg');
    res.set('Content-Disposition', `inline; filename="${file.filename}"`);

    // Stream file from GridFS
    const readStream = getFileStream(fileId);
    
    readStream.on('error', (error) => {
      console.error('Error streaming file from GridFS:', error);
      if (!res.headersSent) {
        res.status(404).send('File not found');
      }
    });

    readStream.pipe(res);

  } catch (error) {
    console.error('Error serving file from GridFS:', error);
    if (!res.headersSent) {
      res.status(500).send('Error retrieving file');
    }
  }
});

module.exports = router;
