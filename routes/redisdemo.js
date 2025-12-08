const express = require('express');
const router = express.Router();
const { connectRedis, client, set, get } = require('../services/redisClient');
const redisCache = require('../middleware/redisCache');

// NOTE: Redis will be connected at server start; the route handlers assume the client is available

// Simple route to store a key in Redis
router.post('/set', async (req, res) => {
  const { key, value, ttl } = req.body || {};
  if (!key || typeof value === 'undefined') return res.status(400).json({ error: 'key & value required' });
  try {
    await set(key, typeof value === 'object' ? JSON.stringify(value) : String(value), ttl || 3600);
    res.json({ success: true, key });
  } catch (err) {
    res.status(500).json({ error: 'failed to set key' });
  }
});

// Simple route to read a key from Redis
router.get('/get', async (req, res) => {
  const key = req.query.key;
  if (!key) return res.status(400).json({ error: 'key required' });
  try {
    const value = await get(key);
    try { return res.json({ key, value: JSON.parse(value) }); } catch (e) { return res.json({ key, value }); }
  } catch (err) {
    res.status(500).json({ error: 'failed to get key' });
  }
});

// Demonstration route that caches a response from an expensive operation
router.get('/expensive', redisCache((req) => `expensive:${req.query.id || 'default'}`, 30), async (req, res) => {
  // Simulate expensive op using random data
  const payload = {
    id: req.query.id || 'default',
    time: new Date().toISOString(),
    random: Math.random()
  };
  // Return the payload (middleware will cache JSON response for 30s)
  res.json(payload);
});

// Session demo: create a fake session value to test that sessions are stored in Redis
router.get('/session-set', (req, res) => {
  req.session.user = { id: 'demo-user', name: 'Redis Demo User' };
  req.session.save((err) => {
    if (err) {
      console.error('Session save error:', err);
      return res.status(500).json({ error: 'failed to save session', details: err.message });
    }
    return res.json({ success: true, sessionId: req.sessionID });
  });
});

router.get('/session-get', (req, res) => {
  if (!req.session.user) return res.json({ user: null });
  return res.json({ user: req.session.user, sessionId: req.sessionID });
});

// Health check for Redis connectivity
router.get('/health', async (req, res) => {
  try {
    if (!client) {
      return res.json({ ok: false, configured: false, message: 'REDIS_URL not configured' });
    }
    // Use ping to check server connectivity
    const pong = await client.ping();
    return res.json({ ok: pong === 'PONG', configured: true, pong });
  } catch (err) {
    console.error('Redis health check failed:', err);
    return res.status(500).json({ ok: false, configured: true, error: err.message });
  }
});

module.exports = router;
