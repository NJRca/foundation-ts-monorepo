import fs from 'fs';
import path from 'path';
import { findRepoRoot } from './util.js';

export async function runInit(opts: { playbook?: string; branch?: string }) {
  const root = findRepoRoot();
  const branch = opts.branch || 'main';
  // Drop PR template, CODEOWNERS, workflow stub
  const prTemplateDir = path.join(root, '.github', 'pull_request_template.md');
  fs.mkdirSync(path.dirname(prTemplateDir), { recursive: true });
  if (!fs.existsSync(prTemplateDir)) {
    fs.writeFileSync(
      prTemplateDir,
      '## Summary\n\nDescribe purpose.\n\n## Changes\n- Item 1\n\n## Validation\n- [ ] Tests pass\n'
    );
  }
  const codeowners = path.join(root, '.github', 'CODEOWNERS');
  if (!fs.existsSync(codeowners)) {
    fs.writeFileSync(codeowners, '* @your-org/maintainers');
  }
  const workflowDir = path.join(root, '.github', 'workflows');
  fs.mkdirSync(workflowDir, { recursive: true });
  const workflowFile = path.join(workflowDir, 'refactor-pipeline.yml');
  if (!fs.existsSync(workflowFile)) {
    fs.writeFileSync(
      workflowFile,
      'name: Refactor Pipeline\non: [pull_request]\njobs:\n  reuse:\n    uses: ./.github/workflows/playbook-pipeline.yml'
    );
  }
  console.log('Initialization complete (placeholder).');
}
