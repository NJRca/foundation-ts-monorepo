import fs from 'fs';
import { load } from 'js-yaml';
import path from 'path';
import { assertNonNull } from '@foundation/contracts';

export interface PlaybookRules {
  version: string;
  contracts: { enforced: boolean; allowedAssertions: string[]; patchScope: string };
  envAccess: { allowedPaths: string[]; disallowedPattern: string; policy: 'fail' | 'warn' };
  complexityBudget: { maxAddedLines: number; maxFunctionLength?: number; maxCyclomatic?: number };
  analyzer: { severityGate: string; failOnNew: boolean };
  testing?: { requireNewTest?: boolean; acceptancePattern?: string };
}

export function findRepoRoot(start = process.cwd()): string {
  assertNonNull(start, 'start');
  let curr = start;
  while (curr !== path.parse(curr).root) {
    if (fs.existsSync(path.join(curr, 'package.json'))) return curr;
    curr = path.dirname(curr);
  }
  return start;
}

export function loadRules(root = findRepoRoot()): PlaybookRules | null {
  assertNonNull(root, 'root');
  const p = path.join(root, 'playbook', 'rules.yaml');
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, 'utf8');
  return load(raw) as PlaybookRules;
}

export function relativeToRoot(file: string, root = findRepoRoot()): string {
  assertNonNull(file, 'file');
  assertNonNull(root, 'root');
  return path.relative(root, file) || '.';
}
