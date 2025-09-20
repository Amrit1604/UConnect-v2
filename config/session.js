const session = require('express-session');
const MongoStore = require('connect-mongo');

/**
 * Session Configuration
 * Sets up Express session with MongoDB store
 */
const configureSession = (app) => {
  app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/campus_connect',
      touchAfter: 24 * 3600 // lazy session update
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    }
  }));
};

module.exports = { configureSession };