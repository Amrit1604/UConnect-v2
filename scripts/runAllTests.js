#!/usr/bin/env node
/**
 * Run all Jest tests and output JSON report to stdout.
 * This script is safe to call from the admin UI (server side) or CLI.
 */
const { spawn } = require('child_process');
const path = require('path');

// Ensure dotenv loads from project root when invoked from scripts/
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['jest', '--json', '--runInBand'];

// Try to run the local jest binary directly (more reliable than npx)
let child;
try {
  const jestBin = require.resolve('jest/bin/jest.js');
  child = spawn(process.execPath, [jestBin, '--json', '--runInBand'], { cwd: process.cwd(), windowsHide: true });
} catch (e) {
  // Fallback to npx if jest binary is not resolvable
  if (process.platform === 'win32') {
    // Run through cmd.exe on Windows to ensure .cmd shims work
    child = spawn('cmd.exe', ['/c', `npx ${args.join(' ')}`], { cwd: process.cwd(), windowsHide: true });
  } else {
    child = spawn(cmd, args, { cwd: process.cwd(), windowsHide: true });
  }
}

let outBuf = '';

child.stdout.on('data', chunk => {
  const s = chunk.toString();
  process.stdout.write(s);
  outBuf += s;
});

child.stderr.on('data', chunk => {
  const s = chunk.toString();
  process.stderr.write(s);
  outBuf += s;
});

child.on('error', err => {
  console.error('Failed to start jest process:', err && err.message ? err.message : err);
  process.exitCode = 1;
});

child.on('close', code => {
  // Try to extract JSON from buffer (jest --json should output a JSON blob)
  const trimmed = outBuf.trim();
  if (!trimmed) {
    console.error('No output from jest.');
    process.exitCode = code || 1;
    return;
  }

  // Attempt to find the first JSON object in the output
  let jsonText = trimmed;
  try {
    // If there is other text before JSON, find the first '{' that starts the JSON
    const firstBrace = trimmed.indexOf('{');
    if (firstBrace > 0) jsonText = trimmed.slice(firstBrace);
    const report = JSON.parse(jsonText);
    // Also print a compact JSON line for any callers reading stdout
    console.log('\n__JEST_JSON_REPORT_START__');
    console.log(JSON.stringify(report));
    console.log('__JEST_JSON_REPORT_END__');
    process.exitCode = report.numFailedTests > 0 || report.numRuntimeErrorTestSuites > 0 ? 2 : 0;
  } catch (parseErr) {
    console.error('\nFailed to parse Jest JSON output:', parseErr.message);
    // keep the original exit code from jest
    process.exitCode = code || 1;
  }
});
