const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Generate SSL certificates for deployment
 * This script runs during the build process on Render.com
 * It generates self-signed certificates if SSL_CERT and SSL_KEY env vars are not provided
 */

const certsDir = path.join(__dirname, '..', 'certs');
const keyPath = path.join(certsDir, 'server.key');
const crtPath = path.join(certsDir, 'server.crt');

// Check if certificates are already provided via environment variables
if (process.env.SSL_CERT && process.env.SSL_KEY) {
  console.log('✅ SSL certificates provided via environment variables');
  process.exit(0);
}

// Check if certificate files already exist
if (fs.existsSync(keyPath) && fs.existsSync(crtPath)) {
  console.log('✅ SSL certificate files already exist');
  process.exit(0);
}

// Create certs directory if it doesn't exist
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

// Generate self-signed certificate using OpenSSL
try {
  console.log('🔐 Generating self-signed SSL certificate for deployment...');

  const opensslCommand = [
    'openssl req -x509 -newkey rsa:2048 -sha256 -days 365 -nodes',
    `-keyout "${keyPath}" -out "${crtPath}"`,
    '-subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"'
  ].join(' ');

  execSync(opensslCommand, { stdio: 'inherit' });

  console.log('✅ SSL certificate generated successfully');
  console.log(`   Private key: ${keyPath}`);
  console.log(`   Certificate: ${crtPath}`);

} catch (error) {
  console.error('❌ Failed to generate SSL certificate:', error.message);
  process.exit(1);
}
