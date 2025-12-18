const redis = require('redis');
require('dotenv').config();

// Default to local Redis
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Create redis client
const client = redis.createClient({ url: REDIS_URL });

client.on('error', (err) => {
  console.error('Redis Client Error', err);
});

// Connect immediately (async)
async function connectRedis() {
  if (!client.isOpen) await client.connect();
}

// Expose simple helper functions for GET/SET and a connect method
module.exports = {
  connectRedis,
  client,
  async get(key) {
    try {
      const val = await client.get(key);
      return val;
    } catch (err) {
      console.error('Redis GET error', err);
      return null;
    }
  },
  async set(key, value, ttlSeconds) {
    try {
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
    try { await client.del(key); } catch (err) { console.error('Redis DEL error', err); }
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

