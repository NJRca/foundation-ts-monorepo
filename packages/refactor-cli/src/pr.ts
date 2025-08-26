import { Octokit } from 'octokit';
import { findRepoRoot } from './util.js';
import fs from 'fs';
import { loadValidatedConfig } from '@foundation/config';
import path from 'path';

export async function runPr(opts: {
  recipe?: string;
  title?: string;
  base?: string;
  draft?: boolean;
}) {
  const cfg = loadValidatedConfig();
  const token = cfg.get('GITHUB_TOKEN');
  if (!token) {
    // Fail fast; non-interactive CLI requires token
    process.exit(1);
  }
  const root = findRepoRoot();
  const defaultTitle = opts.recipe ? `refactor(${opts.recipe}): apply recipe` : 'refactor: plan';
  const title = opts.title || defaultTitle;
  // Placeholder: need repo info; assume origin remote
  const remoteUrl = require('child_process')
    .execSync('git config --get remote.origin.url', { cwd: root })
    .toString()
    .trim();
  const match = /[/:]([^/]+)\/([^/.]+)(?:\.git)?$/.exec(remoteUrl);
  if (!match) {
    const _err = 'Could not parse remote origin';
    process.exit(1);
  }
  const [, owner, repo] = match;
  const branch = `refactor/${Date.now()}`;
  require('child_process').execSync(`git checkout -b ${branch}`, { cwd: root });
  fs.writeFileSync(
    path.join(root, 'REFRACTORING_PLAN.md'),
    `# Refactor PR\n\nRecipe: ${opts.recipe || 'plan'}\n`
  );
  require('child_process').execSync('git add .', { cwd: root });
  require('child_process').execSync('git commit -m "chore(refactor): add plan"', { cwd: root });
  require('child_process').execSync('git push origin ' + branch, { cwd: root });
  const octokit = new Octokit({ auth: token });
  const pr = await octokit.rest.pulls.create({
    owner,
    repo,
    base: opts.base || 'main',
    head: branch,
    title,
    draft: opts.draft !== false,
  });
  const _prUrl = pr.data.html_url;
}
