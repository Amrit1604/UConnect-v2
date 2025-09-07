/**
 * Posts Routes - UConnect
 * Handles post creation, viewing, likes, comments, and reporting
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const Post = require('../models/Post');
const User = require('../models/User');
const { requireAuth, requireOwnership, logActivity } = require('../middleware/auth');
const { uploadPostImage, optimizeImage } = require('../middleware/uploadImages');

const router = express.Router();

// Validation rules
const postValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Post content must be between 1 and 2000 characters'),
  body('category').isIn([
    'lost-found', 'hostels', 'canteen', 'pgs', 'general',
    'study', 'staff', 'events', 'sports', 'academics'
  ]),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('location').optional().isLength({ max: 100 }).withMessage('Location cannot exceed 100 characters'),
  body('priority').optional().isIn(['low', 'normal', 'high', 'urgent'])
];

const commentValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Comment must be between 1 and 500 characters')
];

// GET /posts - 🚀 ADVANCED FEED WITH CATEGORIES & SEARCH
router.get('/', requireAuth, async (req, res) => {
  try {
    // 🚨 Ensure user has a campus assigned
    if (!req.user.campus) {
      console.log(`⚠️ User ${req.user.username} has no campus, setting to 'Main Campus'`);
      await User.findByIdAndUpdate(req.user._id, { campus: 'Main Campus' });
      req.user.campus = 'Main Campus';
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const filter = req.query.filter || 'recent';
    const category = req.query.category;
    const search = req.query.search;
    const tag = req.query.tag;

    let posts;
    let currentCategory = category || 'all';

    // 🎯 ADVANCED FILTERING LOGIC
    if (search || tag || (category && category !== 'all')) {
      // Use advanced search
      const tags = tag ? [tag] : [];
      posts = await Post.searchPosts(req.user.campus, search, category, tags, limit);
    } else if (filter === 'trending') {
      posts = await Post.getTrending(req.user.campus, limit);
    } else if (filter === 'popular') {
      posts = await Post.find({
        campus: req.user.campus,
        isActive: true,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      })
      .populate('author', 'username avatar avatarType avatarSeed')
      .populate('comments.author', 'username avatar avatarType avatarSeed')
      .sort({ engagementScore: -1 })
      .skip(skip)
      .limit(limit);
    } else {
      posts = await Post.getRecent(req.user.campus, limit, skip);
    }

    // �️ Filter out posts with missing authors to prevent errors
    posts = posts.filter(post => post.author && post.author._id);
    console.log(`📊 Filtered posts: ${posts.length} posts with valid authors`);

    // �📊 Get category statistics
    const categoryStats = await Post.getCategoryStats(req.user.campus);
    const categoryStatsObj = {};
    categoryStats.forEach(stat => {
      categoryStatsObj[stat._id] = stat.count;
    });

    // 🔥 Get trending posts for sidebar
    const trendingPosts = await Post.getTrending(req.user.campus, 10);

    // 📈 Get user statistics for sidebar
    const userStats = await User.getStats();
    const campusUsers = await User.countDocuments({
      campus: req.user.campus,
      isVerified: true,
      isActive: true
    });

    // 💎 Calculate total engagement
    const totalLikes = await Post.aggregate([
      { $match: { campus: req.user.campus, isActive: true } },
      { $project: { likeCount: { $size: '$likes' } } },
      { $group: { _id: null, total: { $sum: '$likeCount' } } }
    ]);

    const totalComments = await Post.aggregate([
      { $match: { campus: req.user.campus, isActive: true } },
      { $project: { commentCount: { $size: '$comments' } } },
      { $group: { _id: null, total: { $sum: '$commentCount' } } }
    ]);

    // 🎨 Category display names for beautiful UI
    const categoryDisplayNames = {
      'lost-found': '🔍 Lost & Found',
      'hostels': '🏠 Hostels',
      'canteen': '🍕 Canteen',
      'pgs': '🏡 PGs',
      'general': '💬 General',
      'study': '📚 Study Groups',
      'staff': '👨‍🏫 Staff',
      'events': '🎉 Events',
      'sports': '⚽ Sports',
      'academics': '🎓 Academics'
    };

    res.render('posts/feed-instagram', {
      title: `${currentCategory === 'all' ? 'Campus Feed' : categoryDisplayNames[currentCategory] || 'Posts'}`,
      posts,
      trendingPosts,
      currentFilter: filter,
      currentCategory,
      currentPage: page,
      hasNextPage: posts.length === limit,
      userStats,
      campusUsers,
      categoryStats: categoryStatsObj,
      categoryDisplayNames,
      totalPosts: posts.length,
      totalLikes: totalLikes[0]?.total || 0,
      totalComments: totalComments[0]?.total || 0,
      searchQuery: search,
      selectedTag: tag,
      user: req.user
    });

  } catch (error) {
    console.error('🚨 Feed error:', error);
    req.flash('error', 'Failed to load posts');
    res.redirect('/');
  }
});

// GET /posts/category/:category - Category filtering
router.get('/category/:category', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const category = req.params.category;

    const posts = await Post.find({ campus: req.user.campus, category: category, isActive: true })
      .populate('author', 'username avatar avatarType avatarSeed')
      .populate('comments.author', 'username avatar avatarType avatarSeed')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get user statistics for sidebar
    const userStats = await User.getStats();
    const campusUsers = await User.countDocuments({
      campus: req.user.campus,
      isVerified: true,
      isActive: true
    });

    res.render('posts/feed', {
      title: `${category} Posts`,
      posts,
      currentFilter: 'recent',
      currentPage: page,
      hasNextPage: posts.length === limit,
      userStats,
      campusUsers,
      user: req.user
    });

  } catch (error) {
    console.error('Category feed error:', error);
    req.flash('error', 'Failed to load posts for this category');
    res.redirect('/posts');
  }
});

// GET /posts/create - Show post creation form
router.get('/create', requireAuth, (req, res) => {
  res.render('posts/create-ultimate', {
    title: 'Create Post',
    errors: [],
    formData: {}
  });
});

// POST /posts/create - 🎯 ULTIMATE CREATE POST WITH IMAGES & REAL-TIME
router.post('/create', requireAuth, uploadPostImage.array('images', 5), postValidation, logActivity('create post'), async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.render('posts/create-ultimate', {
          title: 'Create Post',
          errors: errors.array(),
          formData: req.body
        });
      }

      const { content, category, tags, location, priority } = req.body;

      // Process uploaded images
      const images = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          // Optimize image
          await optimizeImage(file.path);

          images.push({
            filename: file.filename,
            originalName: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
            url: `/uploads/posts/${file.filename}`
          });

          console.log(`📸 Image uploaded: ${file.filename}`);
        }
      }

      // 🏷️ Process tags - split by comma and clean
      let processedTags = [];
      if (tags) {
        if (Array.isArray(tags)) {
          processedTags = tags.filter(tag => tag.trim()).map(tag => tag.trim().toLowerCase());
        } else if (typeof tags === 'string') {
          processedTags = tags.split(',').filter(tag => tag.trim()).map(tag => tag.trim().toLowerCase());
        }
      }

      const post = new Post({
        author: req.user._id,
        content,
        category: category || 'general',
        tags: processedTags,
        location: location?.trim(),
        priority: priority || 'normal',
        images: images, // Add images to post
        campus: req.user.campus || 'Main Campus' // Fallback for users without campus
      });

      // 🚨 If user has no campus, update them with default campus
      if (!req.user.campus) {
        console.log(`⚠️ User ${req.user.username} has no campus, setting to 'Main Campus'`);
        await User.findByIdAndUpdate(req.user._id, { campus: 'Main Campus' });
        req.user.campus = 'Main Campus';
      }

      await post.save();
      console.log(`📝 Post created with ${images.length} images by:`, req.user.username);

      // 🚀 REAL-TIME SOCKET.IO BROADCAST
      const io = req.app.get('io');
      if (io) {
        const populatedPost = await Post.findById(post._id)
          .populate('author', 'username name avatar avatarType avatarSeed');

        io.to(post.campus).emit('new-post', {
          post: populatedPost,
          campus: post.campus
        });
        console.log(`⚡ Real-time broadcast: New post to ${post.campus}`);
      }

      // 📊 Update user stats
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { 'stats.postsCount': 1 }
      });

      req.flash('success', `✅ ${category === 'lost-found' ? 'Lost item reported' : 'Post created'} successfully!`);

      // 🎯 Smart redirect based on category
      if (category && category !== 'general') {
        res.redirect(`/posts?category=${category}`);
      } else {
        res.redirect('/posts');
      }

    } catch (error) {
      console.error('🚨 Post creation error:', error);
      res.render('posts/create-advanced', {
        title: 'Create Post',
        errors: [{ msg: 'Failed to create post. Please try again.' }],
        formData: req.body
      });
    }
  }
);

// GET /posts/:id - Show single post
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'username avatar avatarType avatarSeed')
      .populate('comments.author', 'username avatar avatarType avatarSeed');

    if (!post || !post.isActive) {
      req.flash('error', 'Post not found');
      return res.redirect('/posts');
    }

    // Check if post is from same campus
    if (post.campus !== req.user.campus) {
      req.flash('error', 'You can only view posts from your campus');
      return res.redirect('/posts');
    }

    // Ensure virtual fields are included
    if (post.author) {
      post.author = post.author.toObject({ virtuals: true });
    }
    post.comments.forEach(comment => {
      if (comment.author) {
        comment.author = comment.author.toObject({ virtuals: true });
      }
    });

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
  requireAuth,
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

      // 🚀 REAL-TIME SOCKET.IO BROADCAST
      const io = req.app.get('io');
      if (io) {
        io.to(post.campus).emit('post-liked', {
          postId: post._id,
          likes: post.likeCount,
          isLiked: liked,
          likedBy: req.user.username
        });
        console.log(`⚡ Real-time broadcast: Post ${liked ? 'liked' : 'unliked'} by ${req.user.username}`);
      }

      // Return JSON for AJAX requests
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.json({
          success: true,
          liked,
          likeCount: post.likeCount,
          likes: post.likeCount, // For frontend compatibility
          isLiked: liked
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
  requireAuth,
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

      // 🚀 REAL-TIME SOCKET.IO BROADCAST FOR NEW COMMENT
      const io = req.app.get('io');
      if (io) {
        // Get the latest comment with author info
        const populatedPost = await Post.findById(post._id)
          .populate('comments.author', 'username avatar avatarType avatarSeed');

        const latestComment = populatedPost.comments[populatedPost.comments.length - 1];

        io.to(post.campus).emit('new-comment', {
          postId: post._id,
          comment: {
            _id: latestComment._id,
            content: latestComment.content,
            createdAt: latestComment.createdAt,
            author: {
              _id: latestComment.author._id,
              username: latestComment.author.username,
              avatarUrl: latestComment.author.avatarUrl
            }
          }
        });
        console.log(`⚡ Real-time broadcast: New comment on post by ${req.user.username}`);
      }

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
  requireAuth,
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
      title: `${user.name}'s Posts`,
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
