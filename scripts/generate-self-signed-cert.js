const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const certsDir = path.join(__dirname, '..', 'certs');
const keyPath = path.join(certsDir, 'server.key');
const crtPath = path.join(certsDir, 'server.crt');

// CLI/ENV settings
const args = process.argv.slice(2);
const force = args.includes('--force') || args.includes('-f');
const useMkcertFlag = args.includes('--mkcert');
const installMkcertFlag = args.includes('--install-mkcert');
const help = args.includes('--help') || args.includes('-h');

let days = 365; // default validity
const daysArg = args.find((a) => a.startsWith('--days='));
if (daysArg) {
  const val = daysArg.split('=')[1];
  const n = Number(val);
  if (Number.isFinite(n) && n > 0) {
    days = n;
  }
}

if (help) {
  console.log('\nUsage: node scripts/generate-self-signed-cert.js [options]\n');
  console.log('Options:');
  console.log('  --force, -f            Overwrite existing certs');
  console.log('  --mkcert               Force mkcert usage (fail if not installed)');
  console.log('  --install-mkcert       Attempt to install mkcert via brew (macOS)');
  console.log('  --days=<n>             Set certificate validity in days (default: 365)');
  console.log('  --help, -h             Show this help');
  process.exit(0);
}

if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir);
}

if (!force && fs.existsSync(keyPath) && fs.existsSync(crtPath)) {
  console.log(`Certificate and key already exist in ${certsDir}.`);
  console.log('If you want to overwrite them, run with --force');
  console.log('Or run `npm run cert:mkcert` to generate a trusted certificate via mkcert.');
  process.exit(0);
}

function runCommand(cmd, cb) {
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      cb(error, stdout, stderr);
      return;
    }
    cb(null, stdout, stderr);
  });
}

function tryMkcert(cb) {
  // Use mkcert if available — generates a trusted local cert
  runCommand('command -v mkcert || which mkcert', (err) => {
    if (err) {
      return cb(new Error('mkcert not found'));
    }
    const mkcmd = `mkcert -cert-file "${crtPath}" -key-file "${keyPath}" localhost 127.0.0.1 ::1`;
    console.log('mkcert detected — generating a locally trusted certificate...');
    runCommand(mkcmd, (mkerr, out, serr) => {
      if (mkerr) {
        return cb(mkerr, out, serr);
      }
      console.log('mkcert finished. Certificate and key generated:');
      console.log(` - ${crtPath}`);
      console.log(` - ${keyPath}`);
      console.log('This certificate should be trusted by your system and your browser (no further action needed).');
      cb(null);
    });
  });
}

function generateUsingOpenSSL() {
  const san = 'DNS:localhost,IP:127.0.0.1,IP:::1';
  const command = [
    `openssl req -x509 -newkey rsa:4096 -sha256 -days ${days} -nodes`,
    `-keyout "${keyPath}" -out "${crtPath}"`,
    '-subj "/CN=localhost"',
    `-addext "subjectAltName=${san}"`
  ].join(' ');

  console.log(`Generating self-signed SSL certificate and key using OpenSSL (days=${days})...`);
  runCommand(command, (error, stdout, stderr) => {
    if (error) {
      console.error('Error generating certificate:', error.message || error);
      return;
    }
    if (stderr) {
      console.log('OpenSSL:', stderr);
    }
    console.log('Certificate and key generated successfully in the certs/ directory.');
  });
}

// If mkcert is requested explicitly, honor it; else default to mkcert when available
if (useMkcertFlag || !installMkcertFlag) {
  tryMkcert((err) => {
    if (!err) return;
    // If mkcert is missing and user asked for it, optionally try to install
    if (installMkcertFlag) {
      console.log('Attempting to install mkcert via brew (macOS)...');
      runCommand('brew install mkcert', (brewErr) => {
        if (brewErr) {
          console.error('Failed to install mkcert automatically. Please install it manually or run the script without --mkcert.');
          generateUsingOpenSSL();
          return;
        }
        // Try again
        tryMkcert((errRetry) => {
          if (!errRetry) return;
          generateUsingOpenSSL();
        });
      });
      return;
    }
    // fallback to Openssl
    generateUsingOpenSSL();
  });
} else {
  // if action requires pure OpenSSL generation
  generateUsingOpenSSL();
}
