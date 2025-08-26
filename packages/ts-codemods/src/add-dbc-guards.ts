import { FunctionDeclaration, Project, SourceFile } from 'ts-morph';
import { Codemod, result } from './types.js';

const ASSERT_IMPORT = '@foundation/contracts';

function ensureImport(sf: SourceFile) {
  if (!sf.getImportDeclaration(d => d.getModuleSpecifierValue() === ASSERT_IMPORT)) {
    sf.addImportDeclaration({
      moduleSpecifier: ASSERT_IMPORT,
      namedImports: ['assertNonNull', 'assertNumberFinite', 'assertIndexInRange', 'fail'],
    });
  }
}

function addGuards(fn: FunctionDeclaration) {
  const body = fn.getBody();
  if (!body) return false;
  const firstStmts = (body as any)
    .getStatements()
    .slice(0, 3)
    .map((s: any) => s.getText());
  if (firstStmts.some((t: string) => /assert(NON|Number|IndexInRange|fail)/i.test(t))) return false; // already have
  const params = fn.getParameters();
  const lines: string[] = [];
  params.forEach(p => {
    const name = p.getName();
    const typeNode = p.getTypeNode();
    if (!typeNode) return;
    const tText = typeNode.getText();
    if (/number/.test(tText)) lines.push(`assertNumberFinite(${name}, '${name}');`);
    else if (/(string|boolean|any|unknown|object)/.test(tText))
      lines.push(`assertNonNull(${name}, '${name}');`);
  });
  if (!lines.length) return false;
  (body as any).insertStatements(0, lines.join('\n'));
  return true;
}

export const addDbcGuards: Codemod = (project: Project, targetGlobs) => {
  const sfs = project.getSourceFiles(targetGlobs || ['**/*.ts']);
  const changed: SourceFile[] = [];
  sfs.forEach(sf => {
    const fns = sf.getFunctions();
    let modified = false;
    fns.forEach(fn => {
      if (fn.isExported()) {
        ensureImport(sf);
        if (addGuards(fn)) modified = true;
      }
    });
    if (modified) changed.push(sf);
  });
  return result(
    changed.length > 0,
    changed,
    `Added DbC guards to ${changed.length} exported function(s)`
  );
};
