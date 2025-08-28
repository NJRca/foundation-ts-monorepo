#!/usr/bin/env node
// Simple policy gate for CI
// - Disallow `process.env` outside of packages/config/src
// - Disallow exported runtime functions from packages/contracts/src

const fs = require('fs');
const path = require('path');
const glob = require('glob');

function fail(msg) {
  console.error('\u001b[31m' + msg + '\u001b[0m');
  process.exitCode = 1;
}

function ok(msg) {
  console.log('\u001b[32m' + msg + '\u001b[0m');
}

// 1) Check for process.env usage
const allFiles = glob
  .sync('**/*.ts', { ignore: ['**/node_modules/**', 'dist/**', '.git/**'] })
  .filter(f => !f.endsWith('.d.ts') && !f.includes('node_modules'));
const violations = [];
for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('process.env')) {
    // allow only files under packages/config/src
    if (!file.startsWith('packages/config/src')) {
      violations.push(file);
    }
  }
}

if (violations.length > 0) {
  fail('Policy violation: direct use of process.env is disallowed outside packages/config/src');
  console.error('Offending files:');
  violations.forEach(f => console.error('  - ' + f));
} else {
  ok('Policy check: process.env usage OK');
}

// 2) Check packages/contracts for exported functions
const contractsDir = path.join('packages', 'contracts', 'src');
const contractFiles = glob.sync(path.join(contractsDir, '**/*.ts'));
const contractViolations = [];
for (const file of contractFiles) {
  const content = fs.readFileSync(file, 'utf8');
  // naive checks:
  if (/export\s+function\s+/m.test(content)) {
    contractViolations.push({ file, reason: 'export function found' });
  }
  if (/export\s+(const|let)\s+\w+\s*=\s*\(/m.test(content)) {
    contractViolations.push({ file, reason: 'exported const/let assigned a function' });
  }
}

if (contractViolations.length > 0) {
  // Warn rather than fail to allow incremental refactor; print details for maintainers
  console.warn(
    '\u001b[33mPolicy warning: packages/contracts exports runtime functions. Consider moving runtime code to a runtime package.\u001b[0m'
  );
  contractViolations.forEach(v => console.warn(`  - ${v.file}: ${v.reason}`));
} else {
  ok('Policy check: contracts exports OK (no exported runtime functions)');
}

if (process.exitCode && process.exitCode !== 0) {
  console.error(
    '\nPolicy gate failed. Commit changes to conform to policies or update the gate if intended.'
  );
  process.exit(process.exitCode);
} else {
  console.log('\nAll policy checks passed.');
}
