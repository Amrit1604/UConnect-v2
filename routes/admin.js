/**
 * Admin Routes - UConnect
 * Handles administrative functions and moderation
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Post = require('../models/Post');
const AdminLog = require('../models/AdminLog');
const { logActivity, requireAdmin, requireAdminOrSession } = require('../middleware/auth');

const { exec } = require('child_process');
const router = express.Router();

// GET /admin/login - Show admin login page (for fallback if JS disabled)
router.get('/login', (req, res) => {
  res.render('admin/login', {
    title: 'Admin Login'
  });
});

// POST /admin/login - Authenticate admin session using environment password
router.post('/login',
  body('password').notEmpty().withMessage('Password is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const adminPassword = process.env.ADMIN_PASSWORD || '';
      const provided = req.body.password || '';

      // Use a safe timingCompare if both passwords are available
      const crypto = require('crypto');
      const providedBuffer = Buffer.from(provided);
      const adminBuffer = Buffer.from(adminPassword);

      let isValid = false;
      if (providedBuffer.length === adminBuffer.length && adminBuffer.length > 0) {
        isValid = crypto.timingSafeEqual(providedBuffer, adminBuffer);
      } else {
        // lengths differ or admin password not set
        isValid = false;
      }

      if (!isValid) {
        return res.status(401).json({ success: false, message: 'Invalid admin password' });
      }

      // Enable admin session flag
      req.session.isAdmin = true;
      req.session.adminSince = new Date();
      req.session.save(() => {});
      // Log the admin login activity (best-effort)
      try { logActivity('admin login')(req, res, () => {}); } catch (e) { /* ignore */ }
      try {
        AdminLog.create({
          actor: req.user ? req.user._id : 'session-admin',
          actorType: req.user ? 'user' : 'session',
          action: 'admin.login',
          details: { method: 'password' },
          ip: req.ip
        }).catch(() => {});
      } catch (e) { /* ignore */ }

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.json({ success: true });
      }

      res.redirect('/admin');
    } catch (err) {
      console.error('Admin login error:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// POST /admin/logout - Logout admin session
router.post('/logout', async (req, res) => {
  try {
    if (req.session) {
      req.session.isAdmin = false;
      delete req.session.adminSince;
      req.session.save(() => {});
      try { logActivity('admin logout')(req, res, () => {}); } catch (e) { /* ignore */ }
      try {
        AdminLog.create({
          actor: req.user ? req.user._id : 'session-admin',
          actorType: req.user ? 'user' : 'session',
          action: 'admin.logout',
          details: {},
          ip: req.ip
        }).catch(() => {});
      } catch (e) { /* ignore */ }
    }
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true });
    }
    res.redirect('/');
  } catch (err) {
    console.error('Admin logout error:', err);
    res.redirect('/');
  }
});

// Protect all routes under /admin with requireAdminOrSession middleware
router.use(requireAdminOrSession);

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

// GET /admin/api/status - provide basic system status for admin panel widgets
router.get('/api/status', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const activePosts = await Post.countDocuments({ isActive: true });
    const reportedPosts = await Post.countDocuments({ isReported: true });

    return res.json({
      success: true,
      totalUsers,
      verifiedUsers,
      activePosts,
      reportedPosts
    });
  } catch (err) {
    console.error('Admin status API error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /admin/api/run - Run limited predefined server scripts (dangerous: admin-only)
router.post('/api/run', async (req, res) => {
  try {
    const { script } = req.body;
    const allowed = {
      fixCampus: 'node scripts/fixCampusBug.js',
      testGridFS: 'node scripts/testGridFS.js'
    };
    if (!allowed[script]) {
      return res.status(400).json({ success: false, message: 'Script not allowed' });
    }
    // Run the script and capture output
    exec(allowed[script], { cwd: process.cwd(), timeout: 60 * 1000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('Script execution error:', err);
        return res.status(500).json({ success: false, message: 'Script execution failed', stderr: stderr || err.message });
      }
      return res.json({ success: true, stdout: stdout || '', stderr: stderr || '' });
    });
  } catch (err) {
    console.error('Admin run script error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /admin/api/run-jest - Run Jest test suite and return JSON report
router.post('/api/run-jest', async (req, res) => {
  try {
    // Run the helper script that executes jest and emits JSON
    const { exec } = require('child_process');
    const scriptPath = require('path').resolve(__dirname, '..', 'scripts', 'runAllTests.js');

    exec(`node "${scriptPath}"`, { cwd: process.cwd(), maxBuffer: 60 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && !stdout) {
        console.error('Jest run error:', err);
        return res.status(500).json({ success: false, error: (stderr || err.message) });
      }

      const out = (stdout && stdout.trim() ? stdout : stderr && stderr.trim() ? stderr : '') || '';
      // Our runner prints logs then a JSON blob between markers __JEST_JSON_REPORT_START__ and __JEST_JSON_REPORT_END__
      const startMarker = '__JEST_JSON_REPORT_START__';
      const endMarker = '__JEST_JSON_REPORT_END__';
      let jsonText = null;
      const startIdx = out.indexOf(startMarker);
      const endIdx = out.indexOf(endMarker);
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        jsonText = out.slice(startIdx + startMarker.length, endIdx).trim();
      } else {
        // Fallback: attempt to find first JSON object in output
        const firstBrace = out.indexOf('{');
        if (firstBrace !== -1) jsonText = out.slice(firstBrace).trim();
      }

      if (!jsonText) {
        console.error('Could not locate jest JSON in runner output. Raw length:', out.length);
        return res.status(500).json({ success: false, error: 'Could not locate jest JSON in runner output', raw: out.slice(0, 4000) });
      }

      try {
        const report = JSON.parse(jsonText);
        return res.json({ success: true, report });
      } catch (parseErr) {
        console.error('Failed to parse jest JSON output:', parseErr, '\nRaw snippet:', jsonText.slice(0, 4000));
        return res.status(500).json({ success: false, error: 'Failed to parse jest output', raw: jsonText.slice(0, 4000) });
      }
    });
  } catch (err) {
    console.error('Run-jest endpoint error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
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

      // Prevent admin from deactivating themselves (only for full admin users with an id)
      if (req.user && req.user._id && userId === req.user._id.toString()) {
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

// POST /admin/users/:id/delete - Delete user and their posts
router.post('/users/:id/delete',
  logActivity('delete user'),
  async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await User.findById(userId);

      if (!user) {
        req.flash('error', 'User not found');
        return res.redirect('/admin/users');
      }

      // Prevent admin from deleting themselves
      if (req.user && req.user._id && userId === req.user._id.toString()) {
        req.flash('error', 'You cannot delete your own account');
        return res.redirect('/admin/users');
      }

      // Delete all posts by this user
      await Post.deleteMany({ author: userId });

      // Delete the user
      await User.findByIdAndDelete(userId);

      // Log the delete action
      try {
        AdminLog.create({
          actor: req.user ? req.user._id : 'session-admin',
          actorType: req.user ? 'user' : 'session',
          action: 'user.delete',
          details: { deletedUserId: userId, username: user.username },
          ip: req.ip
        }).catch(() => {});
      } catch (e) { /* ignore */ }

      req.flash('success', 'User and their posts deleted successfully');
      res.redirect('/admin/users');

    } catch (error) {
      console.error('Delete user error:', error);
      req.flash('error', 'Failed to delete user');
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

// POST /admin/posts/:id/delete - Delete post
router.post('/posts/:id/delete',
  logActivity('delete post'),
  async (req, res) => {
    try {
      const postId = req.params.id;
      const post = await Post.findById(postId);

      if (!post) {
        req.flash('error', 'Post not found');
        return res.redirect('/admin/posts');
      }

      // Delete the post
      await Post.findByIdAndDelete(postId);

      // Log the delete action
      try {
        AdminLog.create({
          actor: req.user ? req.user._id : 'session-admin',
          actorType: req.user ? 'user' : 'session',
          action: 'post.delete',
          details: { deletedPostId: postId, authorId: post.author },
          ip: req.ip
        }).catch(() => {});
      } catch (e) { /* ignore */ }

      req.flash('success', 'Post deleted successfully');
      res.redirect('/admin/posts');

    } catch (error) {
      console.error('Delete post error:', error);
      req.flash('error', 'Failed to delete post');
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

// GET /admin/audit - View admin logs
router.get('/audit', async (req, res) => {
  try {
    const logs = await AdminLog.find({}).sort({ createdAt: -1 }).limit(200).lean();
    res.render('admin/audit', { title: 'Audit Log', logs, user: req.user });
  } catch (err) {
    console.error('Admin audit error:', err);
    req.flash('error', 'Failed to load audit logs');
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