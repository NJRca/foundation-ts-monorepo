import { Codemod, result } from './types.js';

import { Project } from 'ts-morph';

// Replaces direct process.env access with loadConfig() accessor import if outside config package
export const addConfigLoader: Codemod = (project: Project, targetGlobs) => {
  const files = project.getSourceFiles(targetGlobs || ['**/*.ts']);
  const touched: Array<import('ts-morph').SourceFile> = [];
  for (const sf of files) {
    const rel = sf.getFilePath();
    if (/packages\/config\/src/.test(rel)) continue;
    let modified = false;
    sf.forEachDescendant(node => {
      if (node.getKindName() === 'PropertyAccessExpression') {
        const text = node.getText();
        if (/process\.env\./.test(text)) {
          node.replaceWithText('loadConfig().' + text.split('process.env.')[1]);
          modified = true;
        }
      }
    });
    if (modified) {
      // ensure import
      if (!sf.getImportDeclaration(i => i.getModuleSpecifierValue().includes('config'))) {
        sf.addImportDeclaration({
          namedImports: ['loadConfig'],
          moduleSpecifier: '@foundation/config',
        });
      }
      touched.push(sf);
    }
  }
  return result(
    touched.length > 0,
    touched,
    `Replaced process.env with loadConfig() in ${touched.length} file(s)`
  );
};
