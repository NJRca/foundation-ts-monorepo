import { addConfigLoader, addDbcGuards, extractFunctionalCore } from '../src/index.js';

import { Project } from 'ts-morph';
import { sampleWithProcessEnv } from './fixtures/process-env-samples';

function testAddConfigLoader() {
  const project = new Project({ useInMemoryFileSystem: true });
  project.createSourceFile('src/a.ts', sampleWithProcessEnv);
  addConfigLoader(project);
  const out = project.getSourceFileOrThrow('src/a.ts').getFullText();
  if (!/loadConfig\(\)\.API_KEY/.test(out)) throw new Error('addConfigLoader failed');
}

function testAddDbcGuards() {
  const project = new Project({ useInMemoryFileSystem: true });
  project.createSourceFile('src/b.ts', 'export function add(a: number, b: number){ return a+b }\n');
  addDbcGuards(project);
  const out = project.getSourceFileOrThrow('src/b.ts').getFullText();
  if (!/assertNumberFinite\(a/.test(out)) throw new Error('addDbcGuards failed');
}

function testExtractFunctionalCore() {
  const project = new Project({ useInMemoryFileSystem: true });
  project.createSourceFile(
    'src/c.ts',
    'function big(){ console.log(Date.now());\n' + 'x=\n'.repeat(200) + '}\n'
  );
  extractFunctionalCore(project);
  const out = project.getSourceFileOrThrow('src/c.ts').getFullText();
  if (!/CORE_EXTRACTED/.test(out)) throw new Error('extractFunctionalCore failed');
}

try {
  testAddConfigLoader();
  testAddDbcGuards();
  testExtractFunctionalCore();
  const _ok = 'Codemod tests passed';
} catch (e) {
  const _err = e;
  process.exit(1);
}
