#!/usr/bin/env node
/**
 * Simple developer "agent mode" CLI for common repo tasks.
 * Usage:
 *   node scripts/agent.js help
 *   node scripts/agent.js fixCampus
 *   node scripts/agent.js start
 *   node scripts/agent.js dev
 *   node scripts/agent.js smoke
 */

const { spawnSync } = require('child_process');
const path = require('path');

function runCmd(cmd, args = []) {
  const proc = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: true,
    cwd: path.resolve(__dirname, '..')
  });
  if (proc.error) {
    console.error('Failed to run', cmd, args, proc.error);
    process.exit(1);
  }
  return proc.status;
}

const cmd = (process.argv[2] || 'help').toLowerCase();

switch (cmd) {
  case 'help':
  case '--help':
  case '-h':
    console.log('Agent helper - available commands:\n');
    console.log('  help            Show this help');
    console.log('  fixCampus       Run scripts/fixCampusBug.js (DB migration)');
    console.log('  start           Start production server (npm start)');
    console.log('  dev             Start dev server (npm run dev)');
    console.log('  smoke           Run smoke tests (npm run smoke:test)');
    console.log('  seed            Seed database (npm run seed)');
    process.exit(0);
    break;

  case 'fixcampus':
  case 'fixcampusbug':
    console.log('Running fixCampusBug.js (updates users/posts campus)');
    process.exit(runCmd('node', ['scripts/fixCampusBug.js']));
    break;

  case 'start':
    console.log('Starting production server: npm start');
    process.exit(runCmd('npm', ['start']));
    break;

  case 'dev':
    console.log('Starting dev server: npm run dev');
    process.exit(runCmd('npm', ['run', 'dev']));
    break;

  case 'smoke':
    console.log('Running smoke tests: npm run smoke:test');
    process.exit(runCmd('npm', ['run', 'smoke:test']));
    break;

  case 'seed':
    console.log('Seeding database: npm run seed');
    process.exit(runCmd('npm', ['run', 'seed']));
    break;

  default:
    console.error('Unknown agent command:', cmd);
    console.log('Run `node scripts/agent.js help` for available commands.');
    process.exit(2);
}
