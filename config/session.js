const session = require('express-session');
const MongoStore = require('connect-mongo');
// Optionally use Redis for session storage
const RedisStoreCreator = require('connect-redis');
const { client: redisClient } = require('../services/redisClient');

/**
 * Session Configuration
 * Sets up Express session with MongoDB store
 */
const configureSession = (app) => {
  // Choose a session store: Redis if REDIS_URL is set or SESSION_STORE=redis, else MongoDB
  const useRedis = process.env.SESSION_STORE === 'redis' || !!process.env.REDIS_URL;
  const sessionOptions = {
    secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    }
  };

  if (useRedis && redisClient) {
    // connect-redis export shape may vary across versions — support both
    let RedisStoreFactory = null;
    try {
      if (typeof RedisStoreCreator === 'function') RedisStoreFactory = RedisStoreCreator;
      else if (RedisStoreCreator && typeof RedisStoreCreator.default === 'function') RedisStoreFactory = RedisStoreCreator.default;
    } catch (e) {
      RedisStoreFactory = null;
    }
    if (!RedisStoreFactory) {
      console.warn('connect-redis: unexpected export type; falling back to MongoStore for sessions');
      sessionOptions.store = MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/campus_connect',
        touchAfter: 24 * 3600
      });
    } else {
      // RedisStoreFactory may be a factory function requiring session, or a class constructor
      let RedisStoreClass;
      try {
        // If it's a function that expects session, calling returns a class
        RedisStoreClass = RedisStoreFactory(session);
      } catch (e) {
        // Not callable — treat as a class
        RedisStoreClass = RedisStoreFactory;
      }
      // Create separate client for session store to reduce interference with general use
      const { createClient } = require('redis');
      const SESSION_REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
      const sessionRedisClient = createClient({ url: SESSION_REDIS_URL });
      sessionRedisClient.on('error', (err) => console.warn('Session Redis Client Error', err));
      sessionRedisClient.connect().catch((err) => console.warn('Failed to connect session redis client', err));
      sessionOptions.store = new RedisStoreClass({ client: sessionRedisClient, prefix: 'sess:' });
    }
  } else {
    sessionOptions.store = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/campus_connect',
      touchAfter: 24 * 3600 // lazy session update
    });
  }

  app.use(session(sessionOptions));
  
};

module.exports = { configureSession };