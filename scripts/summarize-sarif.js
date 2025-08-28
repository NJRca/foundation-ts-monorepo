const fs = require('fs');
const path = require('path');
const p = path.resolve('.reports', 'report.sarif');
if (!fs.existsSync(p)) {
  console.error('SARIF not found at', p);
  process.exit(2);
}

const sarif = JSON.parse(fs.readFileSync(p, 'utf8'));
const runs = sarif.runs || [];
const findings = [];

for (const run of runs) {
  const results = run.results || [];
  for (const res of results) {
    const ruleId = res.ruleId || (res.ruleIndex != null ? `ruleIndex:${res.ruleIndex}` : 'unknown');
    const locations = res.locations || [];
    for (const loc of locations) {
      const phys = loc.physicalLocation || {};
      const art = phys.artifactLocation || {};
      let uri = art.uri || art.uriBaseId || '<unknown>';
      // Normalize file:// and leading slashes
      uri = uri.replace(/^file:\/\//, '').replace(/^\/+/, '');
      findings.push({ path: uri, ruleId, level: res.level || res.kind || 'unspecified' });
    }
  }
}

const countsByFile = {};
const countsByRule = {};
const countsByFileRule = {};
for (const f of findings) {
  countsByFile[f.path] = (countsByFile[f.path] || 0) + 1;
  countsByRule[f.ruleId] = (countsByRule[f.ruleId] || 0) + 1;
  const key = `${f.path}::${f.ruleId}`;
  countsByFileRule[key] = (countsByFileRule[key] || 0) + 1;
}

function topEntries(obj, limit = 30) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

console.log('TOP FILES:');
const topFiles = topEntries(countsByFile, 30);
for (const [file, cnt] of topFiles) {
  console.log(`${String(cnt).padStart(4)}  ${file}`);
}

console.log('\nTOP RULES:');
const topRules = topEntries(countsByRule, 30);
for (const [rule, cnt] of topRules) {
  console.log(`${String(cnt).padStart(4)}  ${rule}`);
}

console.log('\nTOP RULES PER TOP FILE:');
for (const [file] of topFiles) {
  console.log(`\nFile: ${file}`);
  const entries = Object.entries(countsByFileRule)
    .filter(([k]) => k.startsWith(`${file}::`))
    .map(([k, v]) => [k.split('::')[1], v])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [rule, cnt] of entries) console.log(`  ${String(cnt).padStart(4)}  ${rule}`);
}

process.exit(0);
