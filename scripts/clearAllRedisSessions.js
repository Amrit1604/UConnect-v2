/**
 * Clear All Redis Sessions Script
 * Removes all session keys from Redis.
 */

const { client, connectRedis } = require('../services/redisClient');

async function clearAllRedisSessions() {
  try {
    console.log('🔧 Connecting to Redis...');
    await connectRedis();

    if (!client) {
      console.error('❌ Redis client not available');
      return;
    }

    console.log('🔍 Scanning for all session keys...');
    const keys = await client.keys('sess:*');

    if (keys.length === 0) {
      console.log('✅ No session keys found');
      return;
    }

    console.log(`📊 Found ${keys.length} session keys`);

    // Delete all session keys
    const deletedCount = await client.del(keys);

    console.log(`✅ All sessions cleared:`);
    console.log(`   - Deleted: ${deletedCount} sessions`);
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
  clearAllRedisSessions();
}

module.exports = { clearAllRedisSessions };
