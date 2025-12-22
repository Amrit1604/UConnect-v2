const session = require('express-session');
const MongoStore = require('connect-mongo');

/**
 * Session Configuration
 * Uses MongoDB for session storage
 */
const configureSession = (app) => {
  console.log('🔧 Configuring session store...');

  const sessionOptions = {
    secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // For cross-site cookies in production
    }
  };

  // Trust proxy for Render/cloud deployments (needed for secure cookies behind proxy)
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // MongoDB session store (reliable on all platforms)
  sessionOptions.store = createMongoStore();
  console.log('✅ Session store: MongoDB');

  app.use(session(sessionOptions));
};

/**
 * Create MongoDB session store
 */
function createMongoStore() {
  return MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/campus_connect',
    touchAfter: 24 * 3600, // Lazy session update (1 day)
    // NOTE: Removed crypto to avoid "Unable to parse ciphertext" errors with old sessions
    autoRemove: 'native', // Auto-remove expired sessions
    ttl: 60 * 60 * 24 * 7 // 7 days
  });
}

module.exports = { configureSession };



// const session = require("express-session");
// const MongoStore = require("connect-mongo");
// const RedisStore = require("connect-redis").default;   // ✔ FIXED
// const redisClient = require("../services/redisClient"); // ✔ single client

// const configureSession = (app) => {
//   const useRedis = !!process.env.REDIS_URL;

//   const sessionOptions = {
//     secret: process.env.SESSION_SECRET || "fallback-secret",
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//       secure: process.env.NODE_ENV === "production", // Render uses proxy SSL, still fine
//       httpOnly: true,
//       maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
//     },
//   };

//   if (useRedis) {
//     console.log("🔌 Using Redis for session storage");
//     sessionOptions.store = new RedisStore({
//       client: redisClient,
//       prefix: "sess:",
//     });
//   } else {
//     console.log("🗄 Using MongoDB for session storage");
//     sessionOptions.store = MongoStore.create({
//       mongoUrl: process.env.MONGODB_URI,
//       touchAfter: 24 * 3600,
//     });
//   }

//   app.use(session(sessionOptions));
// };

// module.exports = { configureSession };
