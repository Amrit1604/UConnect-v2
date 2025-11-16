const express = require('express');
const Notification = require('../models/Notification');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// API routes MUST come before the main route to avoid being caught by '/'
// GET /notifications/api/count - return unread count
router.get('/api/count', async (req, res) => {
  try {
    const count = await Notification.getUnreadCount(req.user._id);
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// GET /notifications/api/list - return recent unread notifications (JSON)
router.get('/api/list', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const notifications = await Notification.getUserNotifications(req.user._id, 1, limit, true);
    res.json({ success: true, notifications: notifications.map(n => n.toObject({ virtuals: true })) });
  } catch (err) {
    console.error('Notifications list error', err);
    res.status(500).json({ success: false });
  }
});

// POST /notifications/api/mark-read - mark a notification as read
router.post('/api/mark-read', async (req, res) => {
  try {
    const ids = req.body.ids || [];
    if (!Array.isArray(ids)) return res.status(400).json({ success: false });
    await Notification.markAsRead(ids, req.user._id);
    res.json({ success: true });
  } catch (err) {
    console.error('Mark notifications read error', err);
    res.status(500).json({ success: false });
  }
});

// GET /notifications - render user's notifications (must be AFTER API routes)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const notifications = await Notification.getUserNotifications(req.user._id, page, 50);
    res.render('layout', {
      title: 'Notifications',
      bodyTemplate: 'notifications/notifications-body',
      additionalJS: ['/js/notifications.js'],
      notifications,
      user: req.user
    });
  } catch (err) {
    console.error('Notifications error', err);
    req.flash('error', 'Failed to load notifications');
    res.redirect('/');
  }
});

module.exports = router;
