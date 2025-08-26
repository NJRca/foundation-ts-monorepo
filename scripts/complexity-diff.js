#!/usr/bin/env node
// Compute line-count complexity delta vs playbook/.complexity-baseline.json
// Usage: node scripts/complexity-diff.js --summary complexity-diff.md

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const root = process.cwd();
const baselinePath = path.join(root, 'playbook', '.complexity-baseline.json');

function loadBaseline() {
  try {
    return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  } catch {
    return {};
  }
}

function currentSnapshot() {
  const files = glob.sync('**/*.ts', { ignore: ['**/node_modules/**', 'dist/**', '**/*.d.ts'] });
  const snap = {};
  for (const f of files) {
    const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/).length;
    snap[f] = lines;
  }
  return snap;
}

const args = process.argv.slice(2);
let summaryFile;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--summary') summaryFile = args[i + 1];
}

const baseline = loadBaseline();
const snap = currentSnapshot();

// Initialize baseline if missing
if (!fs.existsSync(baselinePath)) {
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, JSON.stringify(snap, null, 2));
  console.log('Created initial complexity baseline.');
}

const deltas = Object.keys(snap).map(f => ({
  file: f,
  base: baseline[f],
  current: snap[f],
  delta: snap[f] - (baseline[f] ?? snap[f]),
}));
const changed = deltas.filter(d => d.base !== undefined && d.delta !== 0);
changed.sort((a, b) => b.delta - a.delta);

function fmtRow(d) {
  const sign = d.delta > 0 ? '+' : '';
  return `| ${d.file} | ${d.base ?? '-'} | ${d.current} | ${sign}${d.delta} |`;
}

const header = '| File | Baseline | Current | Δ |\n|------|----------|---------|----|';
const top = changed.slice(0, 20).map(fmtRow).join('\n');

const increases = changed.filter(d => d.delta > 0).length;
const decreases = changed.filter(d => d.delta < 0).length;
const totalDelta = changed.reduce((a, d) => a + d.delta, 0);

const md = `# Complexity Diff\n\nBaseline file: playbook/.complexity-baseline.json\n\nSummary: **${increases} increases**, **${decreases} decreases**, **Net Δ ${totalDelta >= 0 ? '+' : ''}${totalDelta} lines**\n\n${changed.length ? header + '\n' + top : 'No changes vs baseline.'}\n\n> Add \`ALLOW_COMPLEXITY_DELTA\` comment in changed files to justify intentional increases.`;

if (summaryFile) {
  fs.writeFileSync(summaryFile, md);
} else {
  console.log(md);
}
