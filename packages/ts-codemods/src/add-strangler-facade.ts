import { Project, SourceFile } from 'ts-morph';
import { Codemod, result } from './types.js';

// Adds a facade wrapper for legacy modules tagged with LEGACY_MODULE comment
export const addStranglerFacade: Codemod = (project: Project, targetGlobs) => {
  const sfs = project.getSourceFiles(targetGlobs || ['**/*.ts']);
  const changed: SourceFile[] = [];
  sfs.forEach(sf => {
    const text = sf.getFullText();
    if (!/LEGACY_MODULE/.test(text)) return;
    if (/STRANGLER_FACADE/.test(text)) return; // idempotent
    sf.insertText(
      0,
      `// STRANGLER_FACADE\nexport * from './${sf.getBaseNameWithoutExtension()}.legacy';\n// TODO: Implement new replacement and switch exports.\n`
    );
    changed.push(sf);
  });
  return result(
    changed.length > 0,
    changed,
    `Added strangler facade to ${changed.length} module(s)`
  );
};
