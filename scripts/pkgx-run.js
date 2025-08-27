#!/usr/bin/env node
const { spawnSync } = require('child_process');
const args = process.argv.slice(2);

function runCmd(cmd, cmdArgs) {
  const res = spawnSync(cmd, cmdArgs, { stdio: 'inherit' });
  if (res.error) {
    console.error(`Failed to run ${cmd}:`, res.error.message || res.error);
    process.exit(res.status || 1);
  }
  process.exit(res.status || 0);
}

// Try local pkgx first (node_modules/.bin/pkgx), then global, then corepack/pnpm
const localPkgx = './node_modules/.bin/pkgx';
const which = require('which');
let runner = null;

try {
  if (require('fs').existsSync(localPkgx)) {
    runner = localPkgx;
  } else {
    runner = which.sync('pkgx');
  }
} catch (e) {
  // not found
}

if (runner) {
  // If runner is pkgx, invoke pkgx pnpm <args> so pkgx executes pnpm reliably
  const path = require('path');
  const binName = path.basename(runner).toLowerCase();
  if (binName === 'pkgx') {
    let pkgxArgs;
    if (args.length === 0 || (args.length === 1 && args[0] === 'install')) {
      pkgxArgs = ['pnpm', 'install'];
    } else if (args.length === 1 && args[0] === 'test') {
      pkgxArgs = ['pnpm', '-r', 'test'];
    } else {
      pkgxArgs = ['pnpm', ...args];
    }
    runCmd(runner, pkgxArgs);
  } else {
    // Call other runner binary directly
    runCmd(runner, args.length ? args : ['install']);
  }
} else {
  // Fallback: try global pnpm directly (do not call corepack.enable to avoid permission issues)
  const which = require('which');
  try {
    const path = require('path');
    const fs = require('fs');
    const repoRoot = path.resolve(__dirname, '..');
    const localPnpm = path.join(repoRoot, 'node_modules', '.bin', 'pnpm');
    const pnpmArgs = args.length ? args : ['install'];
    if (fs.existsSync(localPnpm)) {
      runCmd(localPnpm, pnpmArgs);
    } else {
      const pnpmPath = which.sync('pnpm');
      runCmd(pnpmPath, pnpmArgs);
    }
  } catch (e) {
    console.error(
      'Neither pkgx nor pnpm were found in PATH and no local pnpm was detected. Please install pnpm or pkgx, or add a local pkgx binary to node_modules/.bin.'
    );
    process.exit(1);
  }
}
