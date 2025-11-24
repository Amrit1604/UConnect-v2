const { get, set } = require('../services/redisClient');

// Basic caching middleware: caches HTTP GET responses
// Usage: add middleware to a route and provide a key provider and ttl
// e.g. router.get('/posts', redisCache((req) => `posts:${req.query.page||1}`, 30), handler)
module.exports = function redisCache(keyProvider, ttlSeconds = 60) {
  return async function (req, res, next) {
    if (req.method !== 'GET') return next();
    try {
      const key = typeof keyProvider === 'function' ? keyProvider(req) : keyProvider;
      if (!key) return next();
      const cached = await get(key);
      if (cached) {
        // Return cached JSON if present
        res.setHeader('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }

      // Wrap res.json to cache the response body
      const originalJson = res.json.bind(res);
      res.json = async (body) => {
        try {
          await set(key, JSON.stringify(body), ttlSeconds);
        } catch (err) {
          console.error('Failed to set cache', err);
        }
        res.setHeader('X-Cache', 'MISS');
        originalJson(body);
      };
      next();
    } catch (err) {
      console.error('redisCache error', err);
      next();
    }
  };
};
