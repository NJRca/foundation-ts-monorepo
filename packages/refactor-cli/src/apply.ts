// Note: '@foundation/ts-codemods' is an ECMAScript module. Import it dynamically
// at runtime to avoid TypeScript emitting a CommonJS `require()` for ESM.

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
  const recipe = load(yaml) as { steps?: unknown[] };
  // Attempt codemod first (deterministic) based on recipe mapping.
  // Load the codemods module dynamically because it's published as an ESM package
  // and a static import here can cause TypeScript to emit `require()` which
  // fails when consuming an ESM package from a CommonJS-compiled file.
  const codemodsModuleRaw = await import('@foundation/ts-codemods');
  type CodemodsModule = {
    addConfigLoader?: (project: Project) => Promise<Record<string, unknown> | undefined>;
    addDbcGuards?: (project: Project) => Promise<Record<string, unknown> | undefined>;
    extractFunctionalCore?: (project: Project) => Promise<Record<string, unknown> | undefined>;
    addStranglerFacade?: (project: Project) => Promise<Record<string, unknown> | undefined>;
    wrapAdapterResilience?: (project: Project) => Promise<Record<string, unknown> | undefined>;
  };
  const codemodsModule = codemodsModuleRaw as unknown as CodemodsModule;
  const mapping: Record<string, { name: string; fn: Function }[]> = {
    '01-config-hardening': [{ name: 'addConfigLoader', fn: codemodsModule.addConfigLoader! }],
    '02-dbc-pass': [{ name: 'addDbcGuards', fn: codemodsModule.addDbcGuards! }],
    '03-functional-core': [
      { name: 'extractFunctionalCore', fn: codemodsModule.extractFunctionalCore! },
    ],
    '04-strangler': [{ name: 'addStranglerFacade', fn: codemodsModule.addStranglerFacade! }],
    '05-acceptance-tests': [],
    '06-analyzer-integration': [],
    resilience: [{ name: 'wrapAdapterResilience', fn: codemodsModule.wrapAdapterResilience! }],
  };

  const codemods = mapping[recipeId] || [];
  if (codemods.length) {
    const project = new Project({ tsConfigFilePath: path.join(root, 'tsconfig.json') });
    const results: Array<Record<string, unknown>> = [];
    for (const mod of codemods) {
      try {
        const r = (await (mod.fn as Function)(project as unknown as Project)) as
          | Record<string, unknown>
          | undefined;
        results.push({ name: mod.name, ...(r || {}) });
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
