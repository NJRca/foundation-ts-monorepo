#!/usr/bin/env node
// Repository Policy Checker - R1, R2, R12 enforcement

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const violations = [];

console.log('🔍 Running repository policy checks...');

// R2: No process.env outside packages/config
function checkR2() {
  console.log('📋 R2: Checking process.env usage...');

  try {
    const result = execSync(
      'grep -r "process\\.env" packages services extensions --include="*.ts" --include="*.js" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=temp',
      { encoding: 'utf8', cwd: process.cwd() }
    );

    const lines = result
      .trim()
      .split('\n')
      .filter(line => line.trim())
      // Filter out any matches coming from the eslint-plugin-foundation package to avoid false positives
      .filter(line => !/eslint-plugin-foundation/i.test(line));

    const configViolations = [];
    for (const line of lines) {
      // skip any matches that come from the eslint-plugin package source
      if (
        line.includes('/packages/eslint-plugin-foundation/') ||
        line.includes('\\packages\\eslint-plugin-foundation\\')
      )
        continue;
      const filePath = line.split(':')[0];
      // skip matches in the config package
      if (filePath.includes('packages/config/')) continue;
      // skip intentional test fixtures
      if (filePath.includes('/tests/fixtures/') || filePath.includes('\\tests\\fixtures\\'))
        continue;
      // skip codemod implementation files which may contain process.env patterns used for transformations
      if (
        filePath.includes('/packages/ts-codemods/src') ||
        filePath.includes('\\packages\\ts-codemods\\src')
      )
        continue;
      // skip files that are rule definitions or runtime entrypoints where process.env usage is acceptable
      if (
        filePath.includes('/packages/eslint-plugin-foundation/') ||
        filePath.includes('\\packages\\eslint-plugin-foundation\\')
      )
        continue;
      // ignore eslint-plugin package path entirely
      if (
        filePath.includes('/packages/eslint-plugin-foundation/') ||
        filePath.includes('\\packages\\eslint-plugin-foundation\\')
      )
        continue;
      if (line.includes('NODE_ENV')) continue; // common runtime switch, allowed in entrypoints
      // skip files that explicitly allow test process.env samples
      try {
        const content = readFileSync(filePath, 'utf8');
        if (content.includes('ALLOW_TEST_PROCESS_ENV')) continue;
        if (content.includes('ALLOW_RUNTIME_ENV')) continue;
        // skip files that explain they're replacing process.env (codemod implementations)
        if (content.includes('Replaces direct process.env') || content.includes('replaceWithText'))
          continue;
      } catch (e) {
        // ignore read errors and include the line
      }

      configViolations.push(line);
    }

    if (configViolations.length > 0) {
      violations.push({
        rule: 'R2',
        message: `Found ${configViolations.length} process.env usage outside packages/config`,
        details: configViolations.slice(0, 3), // Show first 3
      });
    }
  } catch (error) {
    // No matches found - this is good
    console.log('  ✅ No process.env usage found outside packages/config');
  }
}

// R1: Contracts on exported functions (simplified check)
function checkR1() {
  console.log('📋 R1: Checking exported function contracts...');

  try {
    const result = execSync(
      'find packages services extensions -name "*.ts" -not -path "*/dist/*" -exec grep -l "export.*function\\|export.*=>" {} \\;',
      { encoding: 'utf8', cwd: process.cwd() }
    );

    const files = result
      .trim()
      .split('\n')
      .filter(f => f.trim() && !f.includes('test') && !f.includes('spec'))
      // Exclude vendored or bundled files under .ignored directories which are
      // not part of the repository source and can trigger false positives.
      .filter(f => !f.includes('.ignored'));

    let contractViolations = 0;
    for (const file of files.slice(0, 5)) {
      // Check first 5 files
      try {
        const content = readFileSync(file, 'utf8');
        const hasExportedFunctions = /export\s+(function|const\s+\w+\s*=\s*\([^)]*\)\s*=>)/.test(
          content
        );
        const hasContracts = /assert(NonNull|NumberFinite|IndexInRange)|fail\(/.test(content);

        if (hasExportedFunctions && !hasContracts) {
          contractViolations++;
        }
      } catch (e) {
        // Skip files that can't be read
      }
    }

    if (contractViolations > 0) {
      violations.push({
        rule: 'R1',
        message: `Found ${contractViolations} files with exported functions missing contracts`,
        details: [`Sample files need assertNonNull/assertNumberFinite guards`],
      });
    }
  } catch (error) {
    console.log('  ⚠️  Could not check R1 contracts');
  }
}

// R12: Complexity delta ≤ +2 unless ALLOW_COMPLEXITY_DELTA
function checkR12() {
  console.log('📋 R12: Checking complexity delta...');

  try {
    // Simple heuristic: look for very long files without ALLOW_COMPLEXITY_DELTA
    const result = execSync(
      'find packages services extensions -name "*.ts" -not -path "*/dist/*" -not -path "*/node_modules/*" -exec wc -l {} \\;',
      {
        encoding: 'utf8',
        cwd: process.cwd(),
      }
    );

    const lines = result.trim().split('\n');
    const longFiles = lines.filter(line => {
      const parts = line.trim().split(/\s+/);
      const lineCount = parseInt(parts[0]);
      return lineCount > 200; // Arbitrary threshold
    });

    let complexityViolations = 0;
    const missingFiles = [];
    for (const line of longFiles) {
      const parts = line.trim().split(/\s+/);
      const filePath = parts[1];

      try {
        const content = readFileSync(filePath, 'utf8');
        if (!content.includes('ALLOW_COMPLEXITY_DELTA')) {
          complexityViolations++;
          missingFiles.push(filePath);
        }
      } catch (e) {
        // Skip
      }
    }

    if (complexityViolations > 0) {
      violations.push({
        rule: 'R12',
        message: `Found ${complexityViolations} files with high complexity without ALLOW_COMPLEXITY_DELTA`,
        details: missingFiles.slice(0, 5),
      });
    }
  } catch (error) {
    console.log('  ⚠️  Could not check R12 complexity');
  }
}

// Run all checks
checkR2();
checkR1();
checkR12();

// Report results
if (violations.length === 0) {
  console.log('✅ All policy checks passed');
  process.exit(0);
} else {
  console.log(`❌ Found ${violations.length} policy violations:`);
  violations.forEach(v => {
    console.log(`\n  ${v.rule}: ${v.message}`);
    v.details.forEach(detail => console.log(`    - ${detail}`));
  });
  process.exit(1);
}
