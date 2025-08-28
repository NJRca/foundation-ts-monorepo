#!/usr/bin/env node
/*
  scan-function-sizes.js

  Scans TypeScript source files in the repository, computes start/end line numbers
  for functions, methods and classes, and emits:
    - reports/function-sizes.json  (full detail)
    - reports/function-sizes.csv   (all functions)
    - reports/function-sizes-gt100.csv (only functions/classes > 100 lines)

  Uses TypeScript compiler API (require('typescript')). Run from repo root:
    node ./scripts/scan-function-sizes.js

*/

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = process.argv[2] || process.cwd();
const OUT_DIR = path.join(ROOT, 'reports');
const INCLUDE_DIRS = ['packages', 'services', 'extensions'];
const EXCLUDE = ['node_modules', 'dist', 'out', '.git'];

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

function walkDir(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (EXCLUDE.includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      files = walkDir(full, files);
    } else if (e.isFile() && full.endsWith('.ts') && !full.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

function gatherFiles() {
  const roots = INCLUDE_DIRS.map(d => path.join(ROOT, d)).filter(p => fs.existsSync(p));
  let files = [];
  for (const r of roots) files = files.concat(walkDir(r, []));
  // Also include services root TS files if any at workspace root
  const additional = walkDir(ROOT, []).filter(f => f.includes(path.sep + 'services' + path.sep));
  files = Array.from(new Set([...files, ...additional]));
  return files.sort();
}

function getLine(node, sourceFile) {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile, false));
  return line + 1;
}

function getEndLine(node, sourceFile) {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  return line + 1;
}

function scanFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, src, ts.ScriptTarget.Latest, true);
  const results = [];

  function record(name, kind, node) {
    const startLine = getLine(node, sourceFile);
    const endLine = getEndLine(node, sourceFile);
    const length = Math.max(1, endLine - startLine + 1);
    results.push({ file: path.relative(ROOT, filePath), name, kind, startLine, endLine, length });
  }

  function getNameForNode(node) {
    if (node.name && node.name.getText) return node.name.getText();
    return '<anonymous>';
  }

  function visit(node) {
    switch (node.kind) {
      case ts.SyntaxKind.FunctionDeclaration: {
        const name = getNameForNode(node);
        record(name, 'FunctionDeclaration', node);
        break;
      }
      case ts.SyntaxKind.ClassDeclaration: {
        const className = getNameForNode(node);
        record(className, 'ClassDeclaration', node);
        // record methods inside
        ts.forEachChild(node, child => {
          if (child.kind === ts.SyntaxKind.MethodDeclaration) {
            const methodName = child.name ? child.name.getText() : '<anonymous-method>';
            record(`${className}.${methodName}`, 'MethodDeclaration', child);
          }
          if (child.kind === ts.SyntaxKind.Constructor) {
            record(`${className}.constructor`, 'Constructor', child);
          }
          if (
            child.kind === ts.SyntaxKind.GetAccessor ||
            child.kind === ts.SyntaxKind.SetAccessor
          ) {
            const accName = child.name ? child.name.getText() : '<accessor>';
            record(`${className}.${accName}`, 'Accessor', child);
          }
        });
        break;
      }
      case ts.SyntaxKind.MethodDeclaration: {
        // handled as part of class
        break;
      }
      case ts.SyntaxKind.VariableStatement: {
        // Look for const foo = () => { ... } or const foo = function() { }
        node.declarationList.declarations.forEach(decl => {
          if (!decl.initializer) return;
          if (
            decl.initializer.kind === ts.SyntaxKind.ArrowFunction ||
            decl.initializer.kind === ts.SyntaxKind.FunctionExpression
          ) {
            const varName = decl.name.getText();
            record(
              varName,
              decl.initializer.kind === ts.SyntaxKind.ArrowFunction
                ? 'ArrowFunction'
                : 'FunctionExpression',
              decl.initializer
            );
          }
        });
        break;
      }
      case ts.SyntaxKind.FunctionExpression:
      case ts.SyntaxKind.ArrowFunction: {
        // these are often inline; try to find a parent variable/property name
        const parent = node.parent;
        if (parent) {
          if (
            parent.kind === ts.SyntaxKind.PropertyAssignment ||
            parent.kind === ts.SyntaxKind.PropertyDeclaration
          ) {
            const pname = parent.name ? parent.name.getText() : '<prop>';
            record(
              pname,
              node.kind === ts.SyntaxKind.ArrowFunction ? 'ArrowFunction' : 'FunctionExpression',
              node
            );
          } else if (parent.kind === ts.SyntaxKind.VariableDeclaration) {
            const vname = parent.name ? parent.name.getText() : '<var>';
            record(
              vname,
              node.kind === ts.SyntaxKind.ArrowFunction ? 'ArrowFunction' : 'FunctionExpression',
              node
            );
          } else {
            // anonymous inline function
            record(
              '<inline>',
              node.kind === ts.SyntaxKind.ArrowFunction ? 'ArrowFunction' : 'FunctionExpression',
              node
            );
          }
        }
        break;
      }
      default:
        break;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return results;
}

function run() {
  ensureOutDir();
  const files = gatherFiles();
  console.log(`Scanning ${files.length} TypeScript files...`);
  const all = [];
  for (const f of files) {
    try {
      const res = scanFile(f);
      if (res && res.length) all.push(...res);
    } catch (err) {
      console.error(`Failed to scan ${f}: ${err && err.message}`);
    }
  }

  const outJson = path.join(OUT_DIR, 'function-sizes.json');
  const outCsv = path.join(OUT_DIR, 'function-sizes.csv');
  const outBigCsv = path.join(OUT_DIR, 'function-sizes-gt100.csv');

  fs.writeFileSync(outJson, JSON.stringify(all, null, 2));

  const csvHeader = ['file', 'name', 'kind', 'startLine', 'endLine', 'length'].join(',') + '\n';
  const csvAll = all
    .map(r =>
      [
        r.file,
        JSON.stringify(r.name).replace(/"/g, '"'),
        r.kind,
        r.startLine,
        r.endLine,
        r.length,
      ].join(',')
    )
    .join('\n');
  fs.writeFileSync(outCsv, csvHeader + csvAll + '\n');

  const big = all.filter(r => r.length > 100);
  const csvBig = big
    .map(r =>
      [
        r.file,
        JSON.stringify(r.name).replace(/"/g, '"'),
        r.kind,
        r.startLine,
        r.endLine,
        r.length,
      ].join(',')
    )
    .join('\n');
  fs.writeFileSync(outBigCsv, csvHeader + csvBig + '\n');

  console.log(`Found ${all.length} functions/classes. ${big.length} exceed 100 lines.`);
  console.log(`Reports written to ${OUT_DIR}`);
}

run();
