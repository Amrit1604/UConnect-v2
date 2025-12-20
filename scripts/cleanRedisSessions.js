/**
 * Clean Redis Sessions Script
 * Removes unnecessary sessions from Redis that are not associated with active users or pending registrations.
 * Keeps only sessions with 'user' or 'pendingRegistration' data.
 */

const { client, connectRedis } = require('../services/redisClient');

async function cleanRedisSessions() {
  try {
    console.log('🔧 Connecting to Redis...');
    await connectRedis();

    if (!client) {
      console.error('❌ Redis client not available');
      return;
    }

    console.log('🔍 Scanning for session keys...');
    const keys = await client.keys('sess:*');

    if (keys.length === 0) {
      console.log('✅ No session keys found');
      return;
    }

    console.log(`📊 Found ${keys.length} session keys`);

    let cleaned = 0;
    let kept = 0;

    for (const key of keys) {
      try {
        const data = await client.get(key);
        if (!data) {
          // Key exists but no data, clean it
          await client.del(key);
          cleaned++;
          continue;
        }

        const session = JSON.parse(data);

        // Keep sessions that have user data or pending registration
        if (session.user || session.pendingRegistration) {
          kept++;
        } else {
          // Clean sessions without user or pending registration
          await client.del(key);
          cleaned++;
        }
      } catch (error) {
        console.warn(`⚠️ Error processing key ${key}:`, error.message);
        // If we can't parse it, it's probably corrupted, so clean it
        await client.del(key);
        cleaned++;
      }
    }

    console.log(`✅ Cleanup complete:`);
    console.log(`   - Kept: ${kept} sessions`);
    console.log(`   - Cleaned: ${cleaned} sessions`);
    console.log(`   - Total processed: ${keys.length} sessions`);

  } catch (error) {
    console.error('❌ Error during Redis cleanup:', error.message);
  } finally {
    // Close the client if it's open
    if (client && client.isOpen) {
      await client.quit();
    }
  }
}

// Run the cleanup
if (require.main === module) {
  cleanRedisSessions();
}

module.exports = { cleanRedisSessions };
