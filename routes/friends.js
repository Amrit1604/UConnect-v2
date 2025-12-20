const express = require('express');
const Friendship = require('../models/Friendship');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /friends/api/list - return friends for the logged-in user
router.get('/api/list', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const friendships = await Friendship.getUserFriendships(req.user._id, page, limit);
    const results = friendships.map(f => {
      const otherId = f.getOtherUserId(req.user._id);
      const other = f.users.find(u => u._id.toString() === otherId.toString());
      return {
        friendshipId: f._id,
        user: other ? other.toObject({ virtuals: true }) : null,
        unreadCount: f.unreadCount ? (f.unreadCount.get(req.user._id.toString()) || 0) : 0
      };
    });

    res.json({ success: true, results });
  } catch (e) {
    console.error('Friends list error', e);
    res.status(500).json({ success: false });
  }
});

// GET /friends - simple friends page
router.get('/', async (req, res) => {
  try {
    const friendships = await Friendship.getUserFriendships(req.user._id, 1, 200);
    const friends = friendships.map(f => {
      const otherId = f.getOtherUserId(req.user._id);
      const other = f.users.find(u => u._id.toString() === otherId.toString());
      return { friendshipId: f._id, user: other ? other.toObject({ virtuals: true }) : null };
    });

    res.render('layout', {
      title: 'Friends',
      bodyTemplate: 'friends/friends-body',
      additionalCSS: ['/css/chat.css'],
      friends,
      user: req.user
    });
  } catch (e) {
    console.error('Friends page error', e);
    req.flash('error', 'Failed to load friends');
    res.redirect('/posts');
  }
});

// DELETE /friends/:friendshipId - Delete friendship (soft delete)
router.delete('/:friendshipId', async (req, res) => {
  try {
    const friendship = await Friendship.findById(req.params.friendshipId);

    if (!friendship || !friendship.isActive) {
      return res.status(404).json({ success: false, message: 'Friendship not found' });
    }

    // Check if user is part of this friendship
    if (!friendship.users.some(id => id.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Soft delete the friendship
    friendship.isActive = false;
    await friendship.save();

    res.json({ success: true, message: 'Friend removed successfully' });
  } catch (error) {
    console.error('Delete friendship error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove friend' });
  }
});

// DELETE /friends/:friendshipId - Delete friendship (soft delete)
router.delete('/:friendshipId', async (req, res) => {
  try {
    const friendship = await Friendship.findById(req.params.friendshipId);

    if (!friendship || !friendship.isActive) {
      return res.status(404).json({ success: false, message: 'Friendship not found' });
    }

    // Check if user is part of this friendship
    if (!friendship.users.some(id => id.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Soft delete the friendship
    friendship.isActive = false;
    await friendship.save();

    res.json({ success: true, message: 'Friend removed successfully' });
  } catch (error) {
    console.error('Delete friendship error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove friend' });
  }
});

module.exports = router;
