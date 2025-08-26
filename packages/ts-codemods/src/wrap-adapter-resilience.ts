import { Project, SourceFile } from 'ts-morph';
import { Codemod, result } from './types.js';

// Wrap functions calling external adapters (heuristic: http/axios/fetch) with resilience shell
export const wrapAdapterResilience: Codemod = (project: Project, targetGlobs) => {
  const sfs = project.getSourceFiles(targetGlobs || ['**/*.ts']);
  const changed: SourceFile[] = [];
  sfs.forEach(sf => {
    let modified = false;
    sf.getFunctions().forEach(fn => {
      const body = fn.getBody();
      if (!body) return;
      const text = body.getText();
      if (!/(fetch\(|axios\.|httpRequest)/.test(text)) return;
      if (/RESILIENCE_WRAPPED/.test(text)) return; // idempotent
      body.replaceWithText(
        `{\n  // RESILIENCE_WRAPPED\n  const MAX_RETRIES = 2;\n  for (let attempt=0; attempt<=MAX_RETRIES; attempt++){\n    try ${text} catch(e){ if (attempt===MAX_RETRIES) throw e; }\n  }\n}`
      );
      modified = true;
    });
    if (modified) changed.push(sf);
  });
  return result(
    changed.length > 0,
    changed,
    `Wrapped adapter calls with resilience in ${changed.length} function(s)`
  );
};
