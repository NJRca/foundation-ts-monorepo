#!/usr/bin/env node
/* eslint-disable no-console */
/* Programmatic ESLint autofix runner for workspace source files. */
const { ESLint } = require('eslint');

(async function main() {
  try {
    const eslint = new ESLint({
      fix: true,
      overrideConfigFile: '.eslintrc.js',
      useEslintrc: false,
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      ignore: true,
    });

    // original patterns replaced by guarded sourcePatterns below

    // Use guarded glob patterns focusing on source files only. Rely on ESLint's ignore rules
    // to skip dist and node_modules. If no files match, handle gracefully.
    const sourcePatterns = [
      'packages/**/src/**/*.{js,ts,jsx,tsx}',
      'services/**/src/**/*.{js,ts,jsx,tsx}',
      'scripts/**/*.js',
    ];

    let results;
    try {
      console.log('Running ESLint autofix on patterns:', sourcePatterns.join(', '));
      results = await eslint.lintFiles(sourcePatterns);
    } catch (err) {
      // If no files matched, ESLint throws NoFilesFoundError; treat as no-op.
      if (err && err.message && err.message.includes('No files matching')) {
        console.log('No matching files found for lint patterns.');
        process.exit(0);
      }
      throw err;
    }

    await ESLint.outputFixes(results);

    const formatter = await eslint.loadFormatter('stylish');
    const resultText = formatter.format(results);

    // Summarize
    let errorCount = 0;
    let warningCount = 0;
    for (const r of results) {
      errorCount += r.errorCount || 0;
      warningCount += r.warningCount || 0;
    }

    console.log('\nESLint autofix complete.');
    console.log(`Errors: ${errorCount}, Warnings: ${warningCount}`);
    if (resultText) console.log('\nFull report:\n', resultText);
    process.exit(errorCount > 0 ? 1 : 0);
  } catch (err) {
    console.error('ESLint run failed:', err);
    process.exit(2);
  }
})();
