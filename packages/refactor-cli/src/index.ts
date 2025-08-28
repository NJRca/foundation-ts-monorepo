#!/usr/bin/env node

import { Command } from 'commander';
import { runApply } from './apply.js';
import { runGuard } from './guard.js';
import { runInit } from './init.js';
import { runPlan } from './plan.js';
import { runPr } from './pr.js';
import { runScan } from './scan.js';

/**
 * @intent: refactor-cli
 * Purpose: Small CLI entrypoint that wires refactor commands (init, scan, plan, apply).
 * Constraints: Keep logic thin; delegate to subcommands. Avoid network calls in core actions
 *             unless explicitly required by the subcommand. This file must remain side-effect
 *             free except for CLI argument parsing and command registration.
 */

const program = new Command();
program
  .name('refactor-kit')
  .description('Foundation refactor & automation toolkit')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize target repo with playbook assets and open a Refactor Plan PR')
  .option('--playbook <urlOrPath>', 'Playbook repo URL or local path')
  .option('--branch <branch>', 'Target branch', 'main')
  .action(runInit);

program
  .command('scan')
  .description('Run static scan: complexity, env access, contracts coverage')
  .option('--output <file>', 'Write JSON report to file')
  .action(runScan);

program
  .command('apply <recipeId>')
  .description('Apply codemod / recipe by ID (e.g., 01-config-hardening)')
  .option('--dry-run', 'Print planned edits without writing', false)
  .action(runApply);

program
  .command('plan')
  .description('Emit Mikado refactor plan and PR steps')
  .option('--output <file>', 'Markdown output path')
  .action(runPlan);

program
  .command('guard')
  .description('Validate working tree against playbook rules')
  .option('--strict', 'Exit non-zero on warnings', false)
  .action(runGuard);

program
  .command('pr')
  .description('Open draft PR for a given recipe or plan')
  .option('--recipe <id>', 'Recipe ID to reference')
  .option('--title <title>', 'Override PR title')
  .option('--base <branch>', 'Base branch', 'main')
  .option('--draft', 'Create a draft PR', true)
  .action(runPr);

program.parseAsync(process.argv);
