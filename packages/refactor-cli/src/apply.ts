import {
  addConfigLoader,
  addDbcGuards,
  addStranglerFacade,
  extractFunctionalCore,
  wrapAdapterResilience,
} from '@foundation/ts-codemods';

import fs from 'fs';
import { load } from 'js-yaml';
import path from 'path';
import { Project } from 'ts-morph';
import { findRepoRoot } from './util.js';

export async function runApply(recipeId: string, opts: { dryRun?: boolean }) {
  const root = findRepoRoot();
  const recipePath = path.join(root, 'playbook', 'recipes');
  const target = fs
    .readdirSync(recipePath)
    .filter(f => f.startsWith(recipeId))
    .map(f => path.join(recipePath, f))[0];
  if (!target) {
    console.error(`Recipe ${recipeId} not found`);
    process.exit(1);
  }
  const yaml = fs.readFileSync(target, 'utf8');
  const recipe = load(yaml) as any;
  // Attempt codemod first (deterministic) based on recipe mapping
  const mapping: Record<string, { name: string; fn: Function }[]> = {
    '01-config-hardening': [{ name: 'addConfigLoader', fn: addConfigLoader }],
    '02-dbc-pass': [{ name: 'addDbcGuards', fn: addDbcGuards }],
    '03-functional-core': [{ name: 'extractFunctionalCore', fn: extractFunctionalCore }],
    '04-strangler': [{ name: 'addStranglerFacade', fn: addStranglerFacade }],
    '05-acceptance-tests': [],
    '06-analyzer-integration': [],
    resilience: [{ name: 'wrapAdapterResilience', fn: wrapAdapterResilience }],
  };

  const codemods = mapping[recipeId] || [];
  if (codemods.length) {
    const project = new Project({ tsConfigFilePath: path.join(root, 'tsconfig.json') });
    const results = [] as any[];
    for (const mod of codemods) {
      try {
        const r: any = await mod.fn(project as any);
        results.push({ name: mod.name, ...r });
      } catch (e) {
        results.push({ name: mod.name, error: String(e) });
      }
    }
    if (results.some(r => r?.modified)) {
      await project.save();
      const plan = { recipeId, codemods: results, status: 'modified' };
      console.log(JSON.stringify(plan, null, 2));
      return;
    }
  }
  const plan = { recipeId, steps: recipe.steps || [], status: 'noop' };
  console.log(JSON.stringify(plan, null, 2));
}
