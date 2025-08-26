import { findRepoRoot, loadRules } from './util.js';

import fs from 'fs';
import { glob } from 'glob';
import path from 'path';

export async function runGuard(opts: { strict?: boolean }) {
  const root = findRepoRoot();
  const rules = loadRules(root);
  if (!rules) {
    console.error('No playbook/rules.yaml found');
    process.exit(1);
  }
  const tsFiles = glob.sync('**/*.ts', { cwd: root, ignore: ['**/node_modules/**', 'dist/**'] });
  const envRegex = new RegExp(rules.envAccess.disallowedPattern);
  const violations: string[] = [];
  for (const f of tsFiles) {
    const full = path.join(root, f);
    const content = fs.readFileSync(full, 'utf8');
    if (envRegex.test(content)) {
      if (!rules.envAccess.allowedPaths.some(p => f.startsWith(p))) {
        violations.push(f);
      }
    }
  }
  if (violations.length) {
    console.error(`Env access violations (${violations.length}):`);
    violations.forEach(v => console.error(' - ' + v));
    if (rules.envAccess.policy === 'fail' || opts.strict) process.exit(1);
  } else {
    console.log('Env access OK');
  }
}
