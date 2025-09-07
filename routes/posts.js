/**
 * Posts Routes - UConnect
 * Handles post creation, viewing, likes, comments, and reporting
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const Post = require('../models/Post');
const User = require('../models/User');
const { requireOwnership, logActivity } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const postValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Post content must be between 1 and 2000 characters')
];

const commentValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Comment must be between 1 and 500 characters')
];

// GET /posts - Show main feed
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const filter = req.query.filter || 'recent';

    let posts;

    if (filter === 'trending') {
      posts = await Post.getTrending(req.user.campus, limit);
    } else {
      posts = await Post.getRecent(req.user.campus, limit, skip);
    }

    // Get user statistics for sidebar
    const userStats = await User.getStats();
    const campusUsers = await User.countDocuments({
      campus: req.user.campus,
      isVerified: true,
      isActive: true
    });

    res.render('posts/feed', {
      title: 'Campus Feed',
      posts,
      currentFilter: filter,
      currentPage: page,
      hasNextPage: posts.length === limit,
      userStats,
      campusUsers,
      user: req.user
    });

  } catch (error) {
    console.error('Feed error:', error);
    req.flash('error', 'Failed to load posts');
    res.redirect('/');
  }
});

// GET /posts/create - Show create post form
router.get('/create', (req, res) => {
  res.render('posts/create', {
    title: 'Create Post',
    errors: [],
    formData: {}
  });
});

// POST /posts/create - Handle post creation
router.post('/create',
  postValidation,
  logActivity('create post'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.render('posts/create', {
          title: 'Create Post',
          errors: errors.array(),
          formData: req.body
        });
      }

      const { content } = req.body;

      const post = new Post({
        author: req.user._id,
        content,
        campus: req.user.campus
      });

      await post.save();

      // Update user stats
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { 'stats.postsCount': 1 }
      });

      req.flash('success', 'Post created successfully!');
      res.redirect('/posts');

    } catch (error) {
      console.error('Post creation error:', error);
      res.render('posts/create', {
        title: 'Create Post',
        errors: [{ msg: 'Failed to create post. Please try again.' }],
        formData: req.body
      });
    }
  }
);

// GET /posts/:id - Show single post
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'displayName username email avatar avatarSeed avatarType')
      .populate('comments.author', 'displayName username email avatar avatarSeed avatarType');

    if (!post || !post.isActive) {
      req.flash('error', 'Post not found');
      return res.redirect('/posts');
    }

    // Check if post is from same campus
    if (post.campus !== req.user.campus) {
      req.flash('error', 'You can only view posts from your campus');
      return res.redirect('/posts');
    }

    res.render('posts/single', {
      title: 'Post Details',
      post,
      user: req.user
    });

  } catch (error) {
    console.error('Single post error:', error);
    req.flash('error', 'Failed to load post');
    res.redirect('/posts');
  }
});

// POST /posts/:id/like - Toggle like on post
router.post('/:id/like',
  logActivity('like/unlike post'),
  async (req, res) => {
    try {
      const post = await Post.findById(req.params.id);

      if (!post || !post.isActive) {
        return res.status(404).json({ success: false, message: 'Post not found' });
      }

      // Check campus access
      if (post.campus !== req.user.campus) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      let liked;
      if (post.isLikedBy(req.user._id)) {
        post.removeLike(req.user._id);
        liked = false;
      } else {
        post.addLike(req.user._id);
        liked = true;

        // Update author's like count
        if (post.author.toString() !== req.user._id.toString()) {
          await User.findByIdAndUpdate(post.author, {
            $inc: { 'stats.likesReceived': 1 }
          });
        }
      }

      await post.save();

      // Return JSON for AJAX requests
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.json({
          success: true,
          liked,
          likeCount: post.likeCount
        });
      }

      res.redirect('back');

    } catch (error) {
      console.error('Like error:', error);
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(500).json({ success: false, message: 'Failed to update like' });
      }
      req.flash('error', 'Failed to update like');
      res.redirect('back');
    }
  }
);

// POST /posts/:id/comment - Add comment to post
router.post('/:id/comment',
  commentValidation,
  logActivity('add comment'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash('error', errors.array()[0].msg);
        return res.redirect('back');
      }

      const post = await Post.findById(req.params.id);

      if (!post || !post.isActive) {
        req.flash('error', 'Post not found');
        return res.redirect('/posts');
      }

      // Check campus access
      if (post.campus !== req.user.campus) {
        req.flash('error', 'Access denied');
        return res.redirect('/posts');
      }

      const { content } = req.body;
      post.addComment(req.user._id, content);
      await post.save();

      // Update user stats
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { 'stats.commentsCount': 1 }
      });

      req.flash('success', 'Comment added successfully!');
      res.redirect(`/posts/${req.params.id}`);

    } catch (error) {
      console.error('Comment error:', error);
      req.flash('error', 'Failed to add comment');
      res.redirect('back');
    }
  }
);

// POST /posts/:id/report - Report a post
router.post('/:id/report',
  body('reason').isIn(['spam', 'inappropriate', 'harassment', 'fake', 'other']),
  body('description').optional().isLength({ max: 500 }),
  logActivity('report post'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash('error', 'Invalid report data');
        return res.redirect('back');
      }

      const post = await Post.findById(req.params.id);

      if (!post || !post.isActive) {
        req.flash('error', 'Post not found');
        return res.redirect('/posts');
      }

      const { reason, description } = req.body;
      const reported = post.addReport(req.user._id, reason, description);

      if (!reported) {
        req.flash('warning', 'You have already reported this post');
        return res.redirect('back');
      }

      await post.save();

      req.flash('success', 'Post reported successfully. Our moderators will review it.');
      res.redirect('back');

    } catch (error) {
      console.error('Report error:', error);
      req.flash('error', 'Failed to report post');
      res.redirect('back');
    }
  }
);

// GET /posts/:id/edit - Show edit post form
router.get('/:id/edit',
  requireOwnership(Post),
  (req, res) => {
    res.render('posts/edit', {
      title: 'Edit Post',
      post: req.resource,
      errors: [],
      formData: { content: req.resource.content }
    });
  }
);

// PUT /posts/:id - Update post
router.put('/:id',
  requireOwnership(Post),
  postValidation,
  logActivity('edit post'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.render('posts/edit', {
          title: 'Edit Post',
          post: req.resource,
          errors: errors.array(),
          formData: req.body
        });
      }

      const { content } = req.body;
      req.resource.content = content;
      await req.resource.save();

      req.flash('success', 'Post updated successfully!');
      res.redirect(`/posts/${req.resource._id}`);

    } catch (error) {
      console.error('Post update error:', error);
      res.render('posts/edit', {
        title: 'Edit Post',
        post: req.resource,
        errors: [{ msg: 'Failed to update post. Please try again.' }],
        formData: req.body
      });
    }
  }
);

// DELETE /posts/:id - Delete post
router.delete('/:id',
  requireOwnership(Post),
  logActivity('delete post'),
  async (req, res) => {
    try {
      // Soft delete - mark as inactive
      req.resource.isActive = false;
      await req.resource.save();

      // Update user stats
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { 'stats.postsCount': -1 }
      });

      req.flash('success', 'Post deleted successfully!');

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.json({ success: true });
      }

      res.redirect('/posts');

    } catch (error) {
      console.error('Post deletion error:', error);

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(500).json({ success: false, message: 'Failed to delete post' });
      }

      req.flash('error', 'Failed to delete post');
      res.redirect('back');
    }
  }
);

// GET /posts/user/:userId - Show user's posts
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      req.flash('error', 'User not found');
      return res.redirect('/posts');
    }

    // Check if user is from same campus
    if (user.campus !== req.user.campus) {
      req.flash('error', 'You can only view profiles from your campus');
      return res.redirect('/posts');
    }

    const posts = await Post.getByUser(userId, limit, skip);

    res.render('posts/user-posts', {
      title: `${user.displayName}'s Posts`,
      posts,
      profileUser: user,
      currentPage: page,
      hasNextPage: posts.length === limit,
      user: req.user
    });

  } catch (error) {
    console.error('User posts error:', error);
    req.flash('error', 'Failed to load user posts');
    res.redirect('/posts');
  }
});

module.exports = router;