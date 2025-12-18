const crypto = require('crypto');

/**
 * Generate an anonymous ID for a user based on their IP address.
 * This ID is deterministic for a given IP (and salt) but masked,
 * allowing users to manage their own posts without logging in.
 */
function generateAnonId(req) {
  // Use various headers/properties to find the client IP address
  const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  
  // Add a salt to make it harder to reverse and ensure the hash is unique to this app
  // You MUST set ANON_SALT in your environment variables for security (e.g., in a .env file)
  const salt = process.env.ANON_SALT || 'a-very-secret-default-salt-for-gossip';
  
  // Create an MD5 hash of the IP + salt and take the first 8 characters
  return crypto.createHash('md5').update(ip + salt).digest('hex').substring(0, 8);
}

module.exports = {
  generateAnonId
};