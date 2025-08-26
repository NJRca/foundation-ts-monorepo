import { findRepoRoot, loadRules } from './util.js';

import fs from 'fs';
import path from 'path';

export async function runPlan(opts: { output?: string }) {
  const root = findRepoRoot();
  const rules = loadRules(root);
  const md = `# Refactor Mikado Plan\n\nGenerated: ${new Date().toISOString()}\n\n## Constraints\n- Max added lines: ${rules?.complexityBudget.maxAddedLines ?? 'n/a'}\n- Contracts enforced: ${rules?.contracts.enforced}\n\n## High-Level Steps\n1. Run scan to identify env access violations\n2. Apply 01-config-hardening\n3. Apply 02-dbc-pass for hotspots\n4. Extract functional cores (03-functional-core)\n5. Incrementally run strangler (04-strangler)\n\n## Tracking\nMaintain checklist in this file.\n`;
  if (opts.output) {
    fs.mkdirSync(path.dirname(opts.output), { recursive: true });
    fs.writeFileSync(opts.output, md);
    console.log(`Plan written to ${opts.output}`);
  } else {
    console.log(md);
  }
}
