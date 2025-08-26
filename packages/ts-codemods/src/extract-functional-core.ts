import { Project, SourceFile } from 'ts-morph';
import { Codemod, result } from './types.js';

// Heuristic: find functions with > X lines and side-effects (console/Date/fs) and split
const MAX_PURE_LINES = 40;

export const extractFunctionalCore: Codemod = (project: Project, targetGlobs) => {
  const sfs = project.getSourceFiles(targetGlobs || ['**/*.ts']);
  const changed: SourceFile[] = [];
  sfs.forEach(sf => {
    let modified = false;
    sf.getFunctions().forEach(fn => {
      const body = fn.getBody();
      if (!body) return;
      const text = body.getText();
      const lines = text.split(/\n/).length;
      if (lines < MAX_PURE_LINES) return;
      if (!/(console\.|Date\.now|fs\.)/.test(text)) return;
      if (/CORE_EXTRACTED/.test(text)) return; // idempotent marker
      const coreName = fn.getName() + 'Core';
      body.replaceWithText(`{
  // CORE_EXTRACTED
  function ${coreName}() ${text}
  // separate shell calling pure core
  return ${coreName}();
}`);
      modified = true;
    });
    if (modified) changed.push(sf);
  });
  return result(
    changed.length > 0,
    changed,
    `Extracted functional core in ${changed.length} function(s)`
  );
};
