#!/usr/bin/env node

/**
 * Admin test runner for /admin/api/run-jest and /admin/api/run-jest-stream.
 *
 * It runs Jest with JSON output written to disk, then prints that JSON between
 * markers so the API endpoints can parse it reliably.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const START_MARKER = '__JEST_JSON_REPORT_START__';
const END_MARKER = '__JEST_JSON_REPORT_END__';

const projectRoot = path.resolve(__dirname, '..');
const reportPath = path.join(projectRoot, 'jest-report.admin.json');
const jestBin = path.join(projectRoot, 'node_modules', 'jest', 'bin', 'jest.js');

function printMarkedReport(reportObject) {
  console.log(START_MARKER);
  console.log(JSON.stringify(reportObject));
  console.log(END_MARKER);
}

function printFailureReport(code, message, extra) {
  printMarkedReport({
    success: false,
    code,
    message,
    ...(extra || {})
  });
}

function safeCleanupReportFile() {
  try {
    if (fs.existsSync(reportPath)) {
      fs.unlinkSync(reportPath);
    }
  } catch (_) {
    // Ignore cleanup failures.
  }
}

if (!fs.existsSync(jestBin)) {
  console.error('Jest binary not found at:', jestBin);
  printFailureReport('JEST_NOT_FOUND', 'Jest is not installed or node_modules is missing.');
  process.exit(1);
}

safeCleanupReportFile();

const runnerEnv = {
  ...process.env,
  NODE_ENV: 'test'
};

// Prefer a dedicated test database when configured.
if (process.env.MONGODB_URI_TEST) {
  runnerEnv.MONGODB_URI = process.env.MONGODB_URI_TEST;
}

const child = spawn(process.execPath, [jestBin, '--json', '--outputFile', reportPath], {
  cwd: projectRoot,
  windowsHide: true,
  shell: false,
  env: runnerEnv
});

let settled = false;

child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
});

child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
});

child.on('error', (err) => {
  if (settled) return;
  settled = true;

  console.error('Failed to start Jest runner:', err && err.message ? err.message : String(err));
  printFailureReport('SPAWN_ERROR', 'Failed to start Jest process.', {
    details: err && err.message ? err.message : String(err)
  });
  safeCleanupReportFile();
  process.exit(1);
});

child.on('close', (code) => {
  if (settled) return;
  settled = true;

  let exitCode = typeof code === 'number' ? code : 1;

  try {
    if (!fs.existsSync(reportPath)) {
      printFailureReport('REPORT_NOT_FOUND', 'Jest finished but did not produce a JSON report file.', {
        exitCode: code
      });
      exitCode = exitCode || 1;
    } else {
      const raw = fs.readFileSync(reportPath, 'utf8');
      const report = JSON.parse(raw);
      printMarkedReport(report);
      exitCode = typeof code === 'number' ? code : (report.success ? 0 : 1);
    }
  } catch (err) {
    console.error('Could not parse Jest report:', err && err.message ? err.message : String(err));
    printFailureReport('REPORT_PARSE_ERROR', 'Could not parse Jest JSON report.', {
      details: err && err.message ? err.message : String(err),
      exitCode: code
    });
    exitCode = exitCode || 1;
  } finally {
    safeCleanupReportFile();
    process.exit(exitCode);
  }
});
