#!/usr/bin/env node

import { generateSarifReport } from './index.js';
import * as fs from 'fs';
import * as path from 'path';

function main(): void {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: analyzer <directory>');
    process.exit(1);
  }
  
  const targetDir = args[0];
  
  if (!targetDir) {
    console.error('Error: No directory specified');
    process.exit(1);
  }
  
  if (!fs.existsSync(targetDir)) {
    console.error(`Error: Directory '${targetDir}' does not exist`);
    process.exit(1);
  }
  
  if (!fs.statSync(targetDir).isDirectory()) {
    console.error(`Error: '${targetDir}' is not a directory`);
    process.exit(1);
  }
  
  console.log(`Analyzing directory: ${targetDir}`);
  
  try {
    const report = generateSarifReport(targetDir);
    const outputPath = path.join(process.cwd(), 'analysis-results.sarif');
    
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    
    console.log(`Analysis complete. Results written to: ${outputPath}`);
    console.log(`Found ${report.runs[0]?.results.length || 0} issues`);
    
    // Print summary
    const results = report.runs[0]?.results || [];
    const summary = results.reduce((acc, result) => {
      acc[result.level] = (acc[result.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    if (Object.keys(summary).length > 0) {
      console.log('\nSummary:');
      for (const [level, count] of Object.entries(summary)) {
        console.log(`  ${level}: ${count}`);
      }
    }
    
  } catch (error) {
    console.error('Error during analysis:', error);
    process.exit(1);
  }
}

main();