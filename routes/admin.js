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
const chatHandlers = require('../sockets/chatHandlers');

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

      // After successful admin password entry, open the terminal as the primary entrypoint
      res.redirect('/admin/terminal');
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

// GET /admin/terminal - Terminal-style admin UI
router.get('/terminal', async (req, res) => {
  try {
    res.render('admin/terminal', {
      title: 'Admin Terminal',
      user: req.user
    });
  } catch (err) {
    console.error('Admin terminal render error:', err);
    req.flash('error', 'Failed to open admin terminal');
    res.redirect('/admin');
  }
});

// GET /admin/api/list/users - return JSON list of users for admin terminal
router.get('/api/list/users', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const users = await User.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('username displayName email isActive createdAt campus')
      .lean();
    return res.json({ success: true, users });
  } catch (err) {
    console.error('Admin API users error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /admin/api/list/posts - return JSON list of posts for admin terminal
router.get('/api/list/posts', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const posts = await Post.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('author', 'username displayName')
      .select('author content createdAt isActive reportCount')
      .lean();
    return res.json({ success: true, posts });
  } catch (err) {
    console.error('Admin API posts error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /admin/api/list/audit - return recent admin logs
router.get('/api/list/audit', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
    const logs = await AdminLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return res.json({ success: true, logs });
  } catch (err) {
    console.error('Admin API audit error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /admin/api/users/:id/toggle - toggle user active status (JSON)
router.post('/api/users/:id/toggle', async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    // prevent self-deactivation
    if (req.user && req.user._id && userId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot toggle yourself' });
    }
    user.isActive = !user.isActive;
    await user.save();
    return res.json({ success: true, user: { _id: user._id, isActive: user.isActive } });
  } catch (err) {
    console.error('Admin API toggle user error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /admin/api/users/:id - delete user (JSON)
router.delete('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (req.user && req.user._id && userId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    }
    await Post.deleteMany({ author: userId });
    await User.findByIdAndDelete(userId);
    return res.json({ success: true });
  } catch (err) {
    console.error('Admin API delete user error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /admin/api/posts/:id - delete post (JSON)
router.delete('/api/posts/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    await Post.findByIdAndDelete(postId);
    return res.json({ success: true });
  } catch (err) {
    console.error('Admin API delete post error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /admin/api/find/user?q= - find users by query
router.get('/api/find/user', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: true, users: [] });
    const regex = { $regex: q, $options: 'i' };
    const users = await User.find({ $or: [{ username: regex }, { displayName: regex }, { email: regex }] })
      .limit(200)
      .select('username displayName email isActive createdAt campus')
      .lean();
    return res.json({ success: true, users });
  } catch (err) {
    console.error('Admin API find user error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
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

// GET /admin/api/recent-signups - recent user signups
router.get('/api/recent-signups', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const users = await User.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('username displayName email createdAt campus')
      .lean();
    return res.json({ success: true, users });
  } catch (err) {
    console.error('Recent signups API error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /admin/api/login-history - recent lastLogin times (from users)
router.get('/api/login-history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const users = await User.find({ lastLogin: { $exists: true } })
      .sort({ lastLogin: -1 })
      .limit(limit)
      .select('username displayName email lastLogin')
      .lean();
    return res.json({ success: true, users });
  } catch (err) {
    console.error('Login history API error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /admin/api/online - who is online (basic)
router.get('/api/online', async (req, res) => {
  try {
    const io = req.app.get('io');
    // Use chatHandlers to get count if available
    let onlineCount = 0;
    try { onlineCount = chatHandlers.getOnlineUsersCount(); } catch (e) { onlineCount = 0; }

    // also derive list of unique userIds from connected sockets (best-effort)
    const sockets = io && io.sockets && io.sockets.sockets ? Array.from(io.sockets.sockets.values()) : [];
    const userIds = new Set();
    sockets.forEach(s => { if (s && s.userId) userIds.add(String(s.userId)); });

    // resolve users for the ids (limit to 200)
    const ids = Array.from(userIds).slice(0, 200);
    const users = ids.length ? await User.find({ _id: { $in: ids } }).select('username displayName campus').lean() : [];

    return res.json({ success: true, onlineCount, users, socketCount: sockets.length });
  } catch (err) {
    console.error('Online API error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /admin/api/traffic - lightweight traffic & system snapshot
router.get('/api/traffic', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activePosts = await Post.countDocuments({ isActive: true });
    const io = req.app.get('io');
    const socketCount = io && io.engine ? (io.engine.clientsCount || 0) : 0;
    return res.json({ success: true, totalUsers, activePosts, socketCount });
  } catch (err) {
    console.error('Traffic API error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /admin/api/broadcast - send admin message to users (body: { message, targetType, target })
router.post('/api/broadcast', async (req, res) => {
  try {
    const { message, targetType, target } = req.body || {};
    if (!message || !message.trim()) return res.status(400).json({ success: false, message: 'Message is required' });

    const io = req.app.get('io');
    const payload = { from: (req.user && req.user.username) || 'admin', message: String(message), createdAt: new Date() };

    if (targetType === 'user' && target) {
      // target can be userId or username; attempt to resolve username
      let user = null;
      if (/^[0-9a-fA-F]{24}$/.test(target)) user = await User.findById(target).select('_id');
      else user = await User.findOne({ username: target }).select('_id');
      if (user) {
        io.to(`user:${user._id}`).emit('admin:message', payload);
      } else return res.status(404).json({ success: false, message: 'User not found' });
    } else if (targetType === 'campus' && target) {
      io.to(target).emit('admin:message', payload);
    } else {
      // broadcast to everyone
      io.emit('admin:message', payload);
    }

    // Log the broadcast
    try {
      AdminLog.create({ actor: req.user ? req.user._id : 'session-admin', actorType: req.user ? 'user' : 'session', action: 'admin.broadcast', details: { message: payload.message, targetType, target }, ip: req.ip }).catch(() => {});
    } catch (e) { /* ignore */ }

    return res.json({ success: true });
  } catch (err) {
    console.error('Broadcast API error:', err);
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
    const { spawn } = require('child_process');
    const path = require('path');
    const scriptPath = path.resolve(__dirname, '..', 'scripts', 'runAllTests.js');

    const child = spawn(process.execPath, [scriptPath], { cwd: process.cwd(), windowsHide: true });
    let outBuf = '';
    let closed = false;

    child.stdout.on('data', chunk => { const s = chunk.toString(); process.stdout.write(s); outBuf += s; });
    child.stderr.on('data', chunk => { const s = chunk.toString(); process.stderr.write(s); outBuf += s; });

    child.on('error', err => {
      console.error('Failed to start test runner:', err);
      if (!closed) {
        closed = true;
        return res.status(500).json({ success: false, error: 'Failed to start test runner', details: err && err.message });
      }
    });

    child.on('close', (code) => {
      if (closed) return;
      closed = true;
      const out = (outBuf && outBuf.trim()) ? outBuf : '';
      if (!out) {
        return res.status(500).json({ success: false, error: 'No output from test runner', code });
      }

      // Look for JSON markers printed by the runner
      const startMarker = '__JEST_JSON_REPORT_START__';
      const endMarker = '__JEST_JSON_REPORT_END__';
      let jsonText = null;
      const startIdx = out.indexOf(startMarker);
      const endIdx = out.indexOf(endMarker);
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        jsonText = out.slice(startIdx + startMarker.length, endIdx).trim();
      } else {
        // fallback: find first JSON object in output
        const firstBrace = out.indexOf('{');
        if (firstBrace !== -1) {
          // Attempt to extract a balanced JSON substring from first brace
          let depth = 0;
          for (let i = firstBrace; i < out.length; i++) {
            const ch = out[i];
            if (ch === '{') depth++;
            else if (ch === '}') depth--;
            if (depth === 0) {
              jsonText = out.slice(firstBrace, i + 1).trim();
              break;
            }
          }
          // as a final fallback, take the rest starting at first brace
          if (!jsonText) jsonText = out.slice(firstBrace).trim();
        }
      }

      if (!jsonText) {
        // Return raw output for debugging instead of a server error
        return res.json({ success: false, error: 'Could not locate jest JSON in runner output', raw: out.slice(0, 10000), code });
      }

      try {
        const report = JSON.parse(jsonText);
        return res.json({ success: true, report, raw: out.slice(0, 2000), code });
      } catch (parseErr) {
        console.error('Failed to parse jest JSON output:', parseErr, '\nSnippet:', jsonText.slice(0, 2000));
        return res.json({ success: false, error: 'Failed to parse jest JSON', parseError: parseErr.message, rawSnippet: jsonText.slice(0, 2000), code });
      }
    });

  } catch (err) {
    console.error('Run-jest endpoint error:', err);
    return res.status(500).json({ success: false, error: 'Server error', details: err && err.message });
  }
});

// GET /admin/api/run-jest-stream - stream test runner output via SSE
router.get('/api/run-jest-stream', async (req, res) => {
  try {
    const { spawn } = require('child_process');
    const path = require('path');
    const scriptPath = path.resolve(__dirname, '..', 'scripts', 'runAllTests.js');

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    res.write(':ok\n\n');

    const child = spawn(process.execPath, [scriptPath], { cwd: process.cwd(), windowsHide: true });
    let outBuf = '';

    function sendEvent(obj) {
      try {
        res.write('data: ' + JSON.stringify(obj) + '\n\n');
      } catch (e) {
        // ignore write errors
      }
    }

    child.stdout.on('data', chunk => {
      const s = chunk.toString();
      process.stdout.write(s);
      outBuf += s;
      sendEvent({ type: 'stdout', text: s });
    });

    child.stderr.on('data', chunk => {
      const s = chunk.toString();
      process.stderr.write(s);
      outBuf += s;
      sendEvent({ type: 'stderr', text: s });
    });

    child.on('error', err => {
      sendEvent({ type: 'error', message: err && err.message ? err.message : String(err) });
      try { res.end(); } catch (e) {}
    });

    child.on('close', (code) => {
      // try to extract JSON report as in POST handler
      const out = (outBuf && outBuf.trim()) ? outBuf : '';
      const startMarker = '__JEST_JSON_REPORT_START__';
      const endMarker = '__JEST_JSON_REPORT_END__';
      let jsonText = null;
      const startIdx = out.indexOf(startMarker);
      const endIdx = out.indexOf(endMarker);
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        jsonText = out.slice(startIdx + startMarker.length, endIdx).trim();
      } else {
        const firstBrace = out.indexOf('{');
        if (firstBrace !== -1) {
          let depth = 0;
          for (let i = firstBrace; i < out.length; i++) {
            const ch = out[i];
            if (ch === '{') depth++;
            else if (ch === '}') depth--;
            if (depth === 0) { jsonText = out.slice(firstBrace, i + 1).trim(); break; }
          }
          if (!jsonText) jsonText = out.slice(firstBrace).trim();
        }
      }

      if (jsonText) {
        try {
          const report = JSON.parse(jsonText);
          sendEvent({ type: 'report', report, code });
        } catch (e) {
          sendEvent({ type: 'report_error', message: 'Failed to parse report', snippet: jsonText.slice(0, 2000), code });
        }
      } else {
        sendEvent({ type: 'no_report', raw: out.slice(0, 2000), code });
      }

      sendEvent({ type: 'end', code });
      try { res.end(); } catch (e) {}
    });

    // client disconnect handling
    req.on('close', () => {
      try { if (!child.killed) child.kill('SIGTERM'); } catch (e) {}
    });

  } catch (err) {
    console.error('Run-jest-stream endpoint error:', err);
    return res.status(500).json({ success: false, error: 'Server error', details: err && err.message });
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