const redis = require('redis');
require('dotenv').config();

// If REDIS_URL isn't provided, don't create a client to avoid implicit attempts to connect
// to a local Redis instance on PaaS providers (which causes confusing ECONNREFUSED logs).
const REDIS_URL = process.env.REDIS_URL || null;

let client = null;
if (REDIS_URL) {
  client = redis.createClient({ url: REDIS_URL, socket: { tls: { rejectUnauthorized: false } } });

  client.on('error', (err) => {
    console.error('Redis Client Error', err);
  });
}

// Connect immediately (async) - no-op if client is not configured
async function connectRedis() {
  if (!client) {
    console.warn('connectRedis called but REDIS_URL is not configured; skipping Redis connection');
    return;
  }
  if (!client.isOpen) await client.connect();
}

// Expose simple helper functions for GET/SET and a connect method
module.exports = {
  connectRedis,
  client,
  async get(key) {
    try {
      if (!client) return null;
      const val = await client.get(key);
      return val;
    } catch (err) {
      console.error('Redis GET error', err);
      return null;
    }
  },
  async set(key, value, ttlSeconds) {
    try {
      if (!client) return;
      if (ttlSeconds) {
        await client.set(key, value, { EX: ttlSeconds });
      } else {
        await client.set(key, value);
      }
    } catch (err) {
      console.error('Redis SET error', err);
    }
  },
  async del(key) {
    try { if (!client) return; await client.del(key); } catch (err) { console.error('Redis DEL error', err); }
  }
};


// const redis = require("redis");

// const REDIS_URL = process.env.REDIS_URL;

// const client = redis.createClient({ url: REDIS_URL });

// client.on("error", (err) => {
//   console.error("❌ Redis Client Error:", err);
// });

// (async () => {
//   try {
//     await client.connect();
//     console.log("✅ Redis connected successfully");
//   } catch (err) {
//     console.error("❌ Redis connection failed:", err);
//   }
// })();

// module.exports = client;

