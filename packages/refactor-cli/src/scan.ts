import { findRepoRoot, loadRules } from './util.js';

import fs from 'fs';
import { glob } from 'glob';
import path from 'path';

interface ScanReport {
  root: string;
  rulesVersion?: string;
  filesAnalyzed: number;
  envAccessViolations: string[];
  complexity: { file: string; lines: number }[];
}

export async function runScan(opts: { output?: string }) {
  const root = findRepoRoot();
  const rules = loadRules(root);
  const tsFiles = glob.sync('**/*.ts', { cwd: root, ignore: ['**/node_modules/**', 'dist/**'] });

  const envPattern = /process\.env/;
  const allowedEnvPaths = new Set(rules?.envAccess.allowedPaths || []);
  const envAccessViolations: string[] = [];
  for (const f of tsFiles) {
    const full = path.join(root, f);
    const content = fs.readFileSync(full, 'utf8');
    if (envPattern.test(content)) {
      if (![...allowedEnvPaths].some(p => f.startsWith(p))) {
        envAccessViolations.push(f);
      }
    }
  }
  const complexity: { file: string; lines: number }[] = tsFiles.map(f => {
    const full = path.join(root, f);
    const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/).length;
    return { file: f, lines };
  });

  const report: ScanReport = {
    root,
    rulesVersion: rules?.version,
    filesAnalyzed: tsFiles.length,
    envAccessViolations,
    complexity: complexity.sort((a, b) => b.lines - a.lines).slice(0, 25),
  };

  if (opts.output) {
    fs.writeFileSync(opts.output, JSON.stringify(report, null, 2));
    console.log(`Scan report written to ${opts.output}`);
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}
