/**
 * Gossip Routes - UConnect
 * Handles anonymous gossip messages with real-time functionality
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const crypto = require('crypto');
const Gossip = require('../models/Gossip');
const { requireAuth } = require('../middleware/auth');
const { generateAnonId } = require('../utils/anon');

const router = express.Router();

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Generate anonymous ID based on user session + timestamp
 * This allows users to identify their own messages without revealing identity
 */
function generateAnonIdOld(req) {
  const sessionId = req.sessionID;
  const userAgent = req.get('user-agent') || '';
  const combined = `${sessionId}:${userAgent}`;
  return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 16);
}

// ==========================================
// ROUTES
// ==========================================

/**
 * GET /gossip - Render gossip page
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const anonId = generateAnonId(req);
    
    // Get paginated gossips
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const [gossips, totalCount] = await Promise.all([
      Gossip.getActiveGossips(limit, skip),
      Gossip.countDocuments({ status: 'active' })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.render('layout', {
      title: 'Gossip Box',
      bodyTemplate: 'posts/gossip-body',
      additionalCSS: ['/css/feed-neo.css', '/css/gossip.css', '/css/gossip-neo.css'],
      additionalJS: ['/js/gossip.js'],
      gossips,
      anonId,
      page,
      totalPages,
      totalCount,
      currentPath: '/gossip'
    });
  } catch (error) {
    console.error('❌ Error loading gossip page:', error);
    req.flash('error', 'Failed to load gossip page');
    res.redirect('/posts');
  }
});

/**
 * GET /gossip/api/all - Fetch all active gossips (API endpoint for real-time updates)
 */
router.get('/api/all', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const gossips = await Gossip.getActiveGossips(limit, skip);
    const totalCount = await Gossip.countDocuments({ status: 'active' });

    res.json({
      success: true,
      gossips,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (error) {
    console.error('❌ Error fetching gossips:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch gossips' 
    });
  }
});

/**
 * POST /gossip/create - Create a new gossip message
 */
router.post(
  '/create',
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Gossip content is required')
    .isLength({ min: 5, max: 1000 })
    .withMessage('Gossip must be between 5 and 1000 characters'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg
        });
      }

      const anonId = generateAnonId(req);
      
      const newGossip = new Gossip({
        content: req.body.content,
        anonId,
        ipHash: crypto.createHash('sha256')
          .update(req.ip + (req.get('user-agent') || ''))
          .digest('hex')
          .substring(0, 16),
        status: 'active'
      });

      const savedGossip = await newGossip.save();

      // Emit real-time event
      const io = req.app.get('io');
      if (io) {
        io.to('gossip').emit('gossipCreated', {
          _id: savedGossip._id,
          content: savedGossip.content,
          anonId: savedGossip.anonId,
          likes: savedGossip.likes,
          comments: savedGossip.comments,
          createdAt: savedGossip.createdAt
        });
      }

      res.json({
        success: true,
        message: 'Gossip posted successfully!',
        gossip: savedGossip
      });
    } catch (error) {
      console.error('❌ Error creating gossip:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create gossip'
      });
    }
  }
);

/**
 * POST /gossip/:gossipId/like - Toggle like on a gossip
 */
router.post('/like/:gossipId', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.gossipId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gossip ID'
      });
    }

    const anonId = generateAnonId(req);
    const gossip = await Gossip.findById(req.params.gossipId);

    if (!gossip) {
      return res.status(404).json({
        success: false,
        message: 'Gossip not found'
      });
    }

    const wasLiked = gossip.isLikedBy(anonId);
    await gossip.toggleLike(anonId);

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.to('gossip').emit('gossipLiked', {
        gossipId: gossip._id,
        likes: gossip.likes,
        liked: !wasLiked
      });
    }

    res.json({
      success: true,
      liked: !wasLiked,
      likes: gossip.likes
    });
  } catch (error) {
    console.error('❌ Error liking gossip:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to like gossip'
    });
  }
});

/**
 * POST /gossip/:gossipId/comment - Add a comment to gossip
 */
router.post(
  '/comment/:gossipId',
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Comment content is required')
    .isLength({ min: 1, max: 300 })
    .withMessage('Comment must be between 1 and 300 characters'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg
        });
      }

      if (!mongoose.Types.ObjectId.isValid(req.params.gossipId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid gossip ID'
        });
      }

      const anonId = generateAnonId(req);
      const gossip = await Gossip.findById(req.params.gossipId);

      if (!gossip) {
        return res.status(404).json({
          success: false,
          message: 'Gossip not found'
        });
      }

      await Gossip.addComment(req.params.gossipId, req.body.content, anonId);
      const updatedGossip = await Gossip.findById(req.params.gossipId);

      // Emit real-time event
      const io = req.app.get('io');
      if (io) {
        const newComment = updatedGossip.comments[updatedGossip.comments.length - 1];
        io.to('gossip').emit('commentAdded', {
          gossipId: updatedGossip._id,
          comment: {
            content: newComment.content,
            anonId: newComment.anonId,
            likes: newComment.likes,
            createdAt: newComment.createdAt,
            index: updatedGossip.comments.length - 1
          }
        });
      }

      res.json({
        success: true,
        message: 'Comment added successfully!',
        comment: updatedGossip.comments[updatedGossip.comments.length - 1]
      });
    } catch (error) {
      console.error('❌ Error adding comment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add comment'
      });
    }
  }
);

/**
 * POST /gossip/:gossipId/comment/:commentIndex/like - Like a comment
 */
router.post('/comment/:gossipId/:commentIndex/like', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.gossipId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gossip ID'
      });
    }

    const commentIndex = parseInt(req.params.commentIndex);
    const gossip = await Gossip.findById(req.params.gossipId);

    if (!gossip) {
      return res.status(404).json({
        success: false,
        message: 'Gossip not found'
      });
    }

    if (commentIndex < 0 || commentIndex >= gossip.comments.length) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    await Gossip.likeComment(req.params.gossipId, commentIndex);
    const updatedGossip = await Gossip.findById(req.params.gossipId);

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.to('gossip').emit('commentLiked', {
        gossipId: updatedGossip._id,
        commentIndex,
        likes: updatedGossip.comments[commentIndex].likes
      });
    }

    res.json({
      success: true,
      likes: updatedGossip.comments[commentIndex].likes
    });
  } catch (error) {
    console.error('❌ Error liking comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to like comment'
    });
  }
});

/**
 * DELETE /gossip/:gossipId - Delete own gossip (soft delete)
 */
router.delete('/:gossipId', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.gossipId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gossip ID'
      });
    }

    const anonId = generateAnonId(req);
    const gossip = await Gossip.findById(req.params.gossipId);

    if (!gossip) {
      return res.status(404).json({
        success: false,
        message: 'Gossip not found'
      });
    }

    // Check if user owns the gossip
    if (gossip.anonId !== anonId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own gossip'
      });
    }

    await gossip.softDelete();

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.to('gossip').emit('gossipDeleted', {
        gossipId: gossip._id
      });
    }

    res.json({
      success: true,
      message: 'Gossip deleted successfully!'
    });
  } catch (error) {
    console.error('❌ Error deleting gossip:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete gossip'
    });
  }
});

/**
 * DELETE /gossip/:gossipId/comment/:commentIndex - Delete own comment
 */
router.delete('/:gossipId/comment/:commentIndex', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.gossipId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gossip ID'
      });
    }

    const commentIndex = parseInt(req.params.commentIndex);
    const anonId = generateAnonId(req);
    const gossip = await Gossip.findById(req.params.gossipId);

    if (!gossip) {
      return res.status(404).json({
        success: false,
        message: 'Gossip not found'
      });
    }

    if (commentIndex < 0 || commentIndex >= gossip.comments.length) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    await Gossip.deleteComment(req.params.gossipId, commentIndex, anonId);

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.to('gossip').emit('commentDeleted', {
        gossipId: gossip._id,
        commentIndex
      });
    }

    res.json({
      success: true,
      message: 'Comment deleted successfully!'
    });
  } catch (error) {
    console.error('❌ Error deleting comment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete comment'
    });
  }
});

/**
 * GET /gossip-standalone - Standalone gossip page (no auth required)
 */
router.get('/standalone', async (req, res) => {
  try {
    const anonId = generateAnonId(req);

    // Get paginated gossips
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const [gossips, totalCount] = await Promise.all([
      Gossip.getActiveGossips(limit, skip),
      Gossip.countDocuments({ status: 'active' })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.render('gossip-standalone', {
      title: 'Gossip Box - Standalone',
      gossips,
      anonId,
      page,
      totalPages,
      totalCount,
      currentPath: '/gossip/standalone'
    });
  } catch (error) {
    console.error('❌ Error loading standalone gossip page:', error);
    res.status(500).send('Failed to load gossip page');
  }
});

module.exports = router;
