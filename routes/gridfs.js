/**
 * GridFS Routes - Serve files stored in GridFS
 * Handles avatar and file downloads from MongoDB GridFS
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { getGridFSBucket } = require('../utils/gridfs');

/**
 * GET /gridfs/file/:fileId
 * Serve a file from GridFS by ID (checks all buckets)
 */
router.get('/file/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const objectId = new mongoose.Types.ObjectId(fileId);
    const db = mongoose.connection.db;

    const buckets = ['uploads', 'avatars', 'posts', 'videos'];
    let file = null;
    let bucketName = null;

    for (const bucket of buckets) {
      const files = await db.collection(`${bucket}.files`).find({ _id: objectId }).toArray();
      if (files.length > 0) {
        file = files[0];
        bucketName = bucket;
        break;
      }
    }

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Set appropriate headers
    res.set('Content-Type', file.contentType || file.metadata?.mimetype || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${file.metadata?.originalName || file.filename}"`);
    res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

    // Stream the file from correct bucket
    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: bucketName
    });

    const downloadStream = bucket.openDownloadStream(objectId);

    downloadStream.on('error', (error) => {
      console.error('❌ GridFS stream error:', error);
      if (!res.headersSent) {
        res.status(404).json({ error: 'File not found' });
      }
    });

    downloadStream.pipe(res);

  } catch (error) {
    console.error('❌ Error serving GridFS file:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * GET /gridfs/avatar/:fileId
 * Serve an avatar from GridFS (alias for /file/:fileId)
 */
router.get('/avatar/:fileId', async (req, res) => {
  // Redirect to main file route
  req.url = `/file/${req.params.fileId}`;
  router.handle(req, res);
});

/**
 * GET /gridfs/info/:fileId
 * Get file metadata without downloading
 */
router.get('/info/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const objectId = new mongoose.Types.ObjectId(fileId);
    const db = mongoose.connection.db;
    const files = await db.collection('uploads.files').find({ _id: objectId }).toArray();

    if (files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = files[0];
    res.json({
      _id: file._id,
      filename: file.filename,
      contentType: file.contentType,
      length: file.length,
      uploadDate: file.uploadDate,
      metadata: file.metadata
    });

  } catch (error) {
    console.error('❌ Error getting file info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
