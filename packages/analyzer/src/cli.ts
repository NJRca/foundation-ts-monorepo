#!/usr/bin/env node

import * as fs from 'fs';

import { SarifResult, generateSarifReport } from './index.js';

interface CliOptions {
  directory: string;
  output?: string;
  format: 'sarif' | 'json' | 'console';
  quiet: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    directory: '',
    format: 'sarif',
    quiet: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
      case '-h': {
        printHelp();
        process.exit(0);
      }
      case '--output':
      case '-o': {
        options.output = args[++i];
        break;
      }
      case '--format':
      case '-f': {
        const format = args[++i];
        if (format && ['sarif', 'json', 'console'].includes(format)) {
          options.format = format as 'sarif' | 'json' | 'console';
        } else {
          console.error(`Error: Invalid format '${format}'. Use: sarif, json, or console`);
          process.exit(1);
        }
        break;
      }
      case '--quiet':
      case '-q':
        options.quiet = true;
        break;
      default:
        if (!options.directory && !arg.startsWith('-')) {
          options.directory = arg;
        } else {
          console.error(`Error: Unknown argument '${arg}'`);
          process.exit(1);
        }
        break;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Foundation Static Analyzer - SARIF-compliant security and quality analyzer

Usage: analyzer [options] <directory>

Arguments:
  directory                 Directory to analyze

Options:
  -o, --output <file>       Output file path (default: analysis-results.sarif)
  -f, --format <format>     Output format: sarif, json, console (default: sarif)
  -q, --quiet              Suppress console output
  -h, --help               Show this help message

Examples:
  analyzer src/                           # Analyze src directory, output SARIF
  analyzer . --format console            # Analyze current dir, show in console
  analyzer . -o results.sarif            # Custom output file
  analyzer examples --format json -q     # JSON output, quiet mode

The analyzer detects:
  - TODO comments (note)
  - Direct database access outside repositories (warning)
  - Missing error handling in async operations (warning)
  - Hardcoded secrets (error)
  - Console.log usage (warning)
`);
}

function getOutputPath(options: CliOptions): string {
  if (options.output) {
    return options.output;
  }

  if (options.format === 'sarif') {
    return 'analysis-results.sarif';
  }

  if (options.format === 'json') {
    return 'analysis-results.json';
  }

  return '';
}

function getLevelIcon(level: string): string {
  if (level === 'error') return '❌';
  if (level === 'warning') return '⚠️';
  return '📝';
}

function main(): void {
  const options = parseArgs();

  if (!options.directory) {
    console.error('Error: No directory specified');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  if (!fs.existsSync(options.directory)) {
    console.error(`Error: Directory '${options.directory}' does not exist`);
    process.exit(1);
  }

  if (!fs.statSync(options.directory).isDirectory()) {
    console.error(`Error: '${options.directory}' is not a directory`);
    process.exit(1);
  }

  if (!options.quiet) {
    console.log(`🔍 Analyzing directory: ${options.directory}`);
  }

  try {
    const report = generateSarifReport(options.directory);
    const results = report.runs[0]?.results || [];

    const outputPath = getOutputPath(options);

    // Handle different output formats
    switch (options.format) {
      case 'sarif': {
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
        if (!options.quiet) {
          console.log(`✅ SARIF analysis complete. Results written to: ${outputPath}`);
        }
        break;
      }
      case 'json': {
        const jsonOutput = {
          summary: {
            total: results.length,
            errors: results.filter(r => r.level === 'error').length,
            warnings: results.filter(r => r.level === 'warning').length,
            notes: results.filter(r => r.level === 'note').length,
          },
          issues: results,
        };
        fs.writeFileSync(outputPath, JSON.stringify(jsonOutput, null, 2));
        if (!options.quiet) {
          console.log(`✅ JSON analysis complete. Results written to: ${outputPath}`);
        }
        break;
      }
      case 'console':
        printConsoleResults(results, options.quiet);
        break;
    }

    if (!options.quiet && options.format !== 'console') {
      printSummary(results);
    }

    // Exit with non-zero if errors found
    const errorCount = results.filter(r => r.level === 'error').length;
    if (errorCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error during analysis:', error);
    process.exit(1);
  }
}

function printSummary(results: SarifResult[]): void {
  console.log(`📊 Found ${results.length} issues`);

  if (results.length > 0) {
    const summary = results.reduce<Record<string, number>>((acc, result) => {
      acc[result.level] = (acc[result.level] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📋 Summary:');
    for (const [level, count] of Object.entries(summary)) {
      const icon = getLevelIcon(level);
      console.log(`  ${icon} ${level}: ${count}`);
    }
  }
}

function printConsoleResults(results: SarifResult[], quiet: boolean): void {
  if (!quiet) {
    console.log(`\n🔍 Static Analysis Results`);
    console.log('==========================');
  }

  if (results.length === 0) {
    console.log('✅ No issues found!');
    return;
  }

  const groupedResults = results.reduce<Record<string, SarifResult[]>>((acc, result) => {
    if (!acc[result.level]) acc[result.level] = [];
    acc[result.level].push(result);
    return acc;
  }, {});

  // Show errors first, then warnings, then notes
  const levels = ['error', 'warning', 'note'];

  for (const level of levels) {
    const levelResults = groupedResults[level] || [];
    if (levelResults.length === 0) continue;

    const icon = getLevelIcon(level);
    console.log(`\n${icon} ${level.toUpperCase()} (${levelResults.length}):`);

    levelResults.forEach((result, index) => {
      const location = result.locations[0]?.physicalLocation;
      const file = location?.artifactLocation?.uri || 'unknown';
      const line = location?.region?.startLine || 0;

      console.log(`  ${index + 1}. ${file}:${line}`);
      console.log(`     ${result.message.text}`);
      console.log(`     Rule: ${result.ruleId}`);
    });
  }

  if (!quiet) {
    console.log(`\n📊 Total: ${results.length} issues`);
  }
}

main();
