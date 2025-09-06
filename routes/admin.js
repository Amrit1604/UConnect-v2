/**
 * Admin Routes - UConnect
 * Handles administrative functions and moderation
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Post = require('../models/Post');
const { logActivity } = require('../middleware/auth');

const router = express.Router();

// GET /admin - Admin dashboard
router.get('/', async (req, res) => {
  try {
    // Get overall statistics
    const userStats = await User.getStats();
    const totalPosts = await Post.countDocuments({ isActive: true });
    const reportedPosts = await Post.countDocuments({ isReported: true });
    const totalCampuses = await User.distinct('campus').then(campuses => campuses.length);

    // Get recent activity
    const recentUsers = await User.find({ isVerified: true })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('displayName email campus createdAt');

    const recentPosts = await Post.find({ isActive: true })
      .populate('author', 'displayName email campus')
      .sort({ createdAt: -1 })
      .limit(10);

    // Get campus statistics
    const campusStats = await User.aggregate([
      {
        $match: { isVerified: true, isActive: true }
      },
      {
        $group: {
          _id: '$campus',
          userCount: { $sum: 1 },
          totalPosts: { $sum: '$stats.postsCount' },
          totalLikes: { $sum: '$stats.likesReceived' }
        }
      },
      {
        $sort: { userCount: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      userStats,
      totalPosts,
      reportedPosts,
      totalCampuses,
      recentUsers,
      recentPosts,
      campusStats,
      user: req.user
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    req.flash('error', 'Failed to load admin dashboard');
    res.redirect('/posts');
  }
});

// GET /admin/users - Manage users
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const filter = req.query.filter || 'all';

    let query = {};

    // Apply search filter
    if (search) {
      query.$or = [
        { displayName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { campus: { $regex: search, $options: 'i' } }
      ];
    }

    // Apply status filter
    switch (filter) {
      case 'verified':
        query.isVerified = true;
        break;
      case 'unverified':
        query.isVerified = false;
        break;
      case 'inactive':
        query.isActive = false;
        break;
      case 'active':
        query.isActive = true;
        break;
    }

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments(query);

    res.render('admin/users', {
      title: 'Manage Users',
      users,
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      hasNextPage: skip + users.length < totalUsers,
      search,
      filter,
      totalUsers,
      user: req.user
    });

  } catch (error) {
    console.error('Admin users error:', error);
    req.flash('error', 'Failed to load users');
    res.redirect('/admin');
  }
});

// POST /admin/users/:id/toggle-status - Toggle user active status
router.post('/users/:id/toggle-status',
  logActivity('toggle user status'),
  async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await User.findById(userId);

      if (!user) {
        req.flash('error', 'User not found');
        return res.redirect('/admin/users');
      }

      // Prevent admin from deactivating themselves
      if (userId === req.user._id.toString()) {
        req.flash('error', 'You cannot deactivate your own account');
        return res.redirect('/admin/users');
      }

      user.isActive = !user.isActive;
      await user.save();

      // If deactivating, also deactivate their posts
      if (!user.isActive) {
        await Post.updateMany(
          { author: userId },
          { isActive: false }
        );
      }

      req.flash('success', `User ${user.isActive ? 'activated' : 'deactivated'} successfully`);
      res.redirect('/admin/users');

    } catch (error) {
      console.error('Toggle user status error:', error);
      req.flash('error', 'Failed to update user status');
      res.redirect('/admin/users');
    }
  }
);

// POST /admin/users/:id/verify - Manually verify user
router.post('/users/:id/verify',
  logActivity('manually verify user'),
  async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await User.findById(userId);

      if (!user) {
        req.flash('error', 'User not found');
        return res.redirect('/admin/users');
      }

      user.isVerified = true;
      user.verificationToken = null;
      user.verificationTokenExpires = null;
      await user.save();

      req.flash('success', 'User verified successfully');
      res.redirect('/admin/users');

    } catch (error) {
      console.error('Manual verification error:', error);
      req.flash('error', 'Failed to verify user');
      res.redirect('/admin/users');
    }
  }
);

// GET /admin/posts - Manage posts
router.get('/posts', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const filter = req.query.filter || 'all';

    let query = {};

    switch (filter) {
      case 'reported':
        query.isReported = true;
        break;
      case 'inactive':
        query.isActive = false;
        break;
      case 'active':
        query.isActive = true;
        break;
    }

    const posts = await Post.find(query)
      .populate('author', 'displayName email campus')
      .populate('reports.reporter', 'displayName email')
      .sort({ reportCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPosts = await Post.countDocuments(query);

    res.render('admin/posts', {
      title: 'Manage Posts',
      posts,
      currentPage: page,
      totalPages: Math.ceil(totalPosts / limit),
      hasNextPage: skip + posts.length < totalPosts,
      filter,
      totalPosts,
      user: req.user
    });

  } catch (error) {
    console.error('Admin posts error:', error);
    req.flash('error', 'Failed to load posts');
    res.redirect('/admin');
  }
});

// POST /admin/posts/:id/toggle-status - Toggle post active status
router.post('/posts/:id/toggle-status',
  logActivity('toggle post status'),
  async (req, res) => {
    try {
      const postId = req.params.id;
      const post = await Post.findById(postId);

      if (!post) {
        req.flash('error', 'Post not found');
        return res.redirect('/admin/posts');
      }

      post.isActive = !post.isActive;

      // If reactivating a reported post, clear the reported status
      if (post.isActive && post.isReported) {
        post.isReported = false;
      }

      await post.save();

      req.flash('success', `Post ${post.isActive ? 'activated' : 'deactivated'} successfully`);
      res.redirect('/admin/posts');

    } catch (error) {
      console.error('Toggle post status error:', error);
      req.flash('error', 'Failed to update post status');
      res.redirect('/admin/posts');
    }
  }
);

// POST /admin/posts/:id/clear-reports - Clear all reports for a post
router.post('/posts/:id/clear-reports',
  logActivity('clear post reports'),
  async (req, res) => {
    try {
      const postId = req.params.id;
      const post = await Post.findById(postId);

      if (!post) {
        req.flash('error', 'Post not found');
        return res.redirect('/admin/posts');
      }

      post.reports = [];
      post.reportCount = 0;
      post.isReported = false;
      await post.save();

      req.flash('success', 'Reports cleared successfully');
      res.redirect('/admin/posts');

    } catch (error) {
      console.error('Clear reports error:', error);
      req.flash('error', 'Failed to clear reports');
      res.redirect('/admin/posts');
    }
  }
);

// GET /admin/reports - View detailed reports
router.get('/reports', async (req, res) => {
  try {
    const reportedPosts = await Post.getReported();

    // Group reports by reason for statistics
    const reportStats = {};
    reportedPosts.forEach(post => {
      post.reports.forEach(report => {
        reportStats[report.reason] = (reportStats[report.reason] || 0) + 1;
      });
    });

    res.render('admin/reports', {
      title: 'Content Reports',
      reportedPosts,
      reportStats,
      user: req.user
    });

  } catch (error) {
    console.error('Admin reports error:', error);
    req.flash('error', 'Failed to load reports');
    res.redirect('/admin');
  }
});

// GET /admin/analytics - View analytics
router.get('/analytics', async (req, res) => {
  try {
    const timeRange = req.query.range || '7'; // days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeRange));

    // User registration analytics
    const userRegistrations = await User.aggregate([
      {
        $match: { createdAt: { $gte: startDate } }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Post creation analytics
    const postCreations = await Post.aggregate([
      {
        $match: { createdAt: { $gte: startDate }, isActive: true }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Top campuses by activity
    const topCampuses = await User.aggregate([
      {
        $match: { isVerified: true, isActive: true }
      },
      {
        $group: {
          _id: '$campus',
          userCount: { $sum: 1 },
          totalPosts: { $sum: '$stats.postsCount' },
          totalLikes: { $sum: '$stats.likesReceived' },
          totalComments: { $sum: '$stats.commentsCount' }
        }
      },
      {
        $addFields: {
          activityScore: {
            $add: [
              '$totalPosts',
              { $multiply: ['$totalLikes', 0.5] },
              { $multiply: ['$totalComments', 0.8] }
            ]
          }
        }
      },
      {
        $sort: { activityScore: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.render('admin/analytics', {
      title: 'Analytics Dashboard',
      userRegistrations,
      postCreations,
      topCampuses,
      timeRange,
      user: req.user
    });

  } catch (error) {
    console.error('Admin analytics error:', error);
    req.flash('error', 'Failed to load analytics');
    res.redirect('/admin');
  }
});

module.exports = router;