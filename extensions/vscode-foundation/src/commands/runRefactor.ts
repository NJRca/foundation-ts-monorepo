import * as vscode from 'vscode';

import { spawn } from 'child_process';
import path from 'path';

interface RecipeResultPlan {
  recipeId: string;
  codemods?: Array<{ name?: string; modified?: boolean; error?: string }>;
  steps?: any[];
  status: string;
}

const RECIPE_IDS = [
  '01-config-hardening',
  '02-dbc-pass',
  '03-functional-core',
  '04-strangler',
  '05-acceptance-tests',
  '06-analyzer-integration',
  'resilience',
];

export async function runRefactorCommand() {
  const recipeId = await vscode.window.showQuickPick(RECIPE_IDS, {
    placeHolder: 'Select a recipe to apply',
  });
  if (!recipeId) return;

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const cliBin = path.join(workspaceFolder, 'node_modules', '.bin', 'refactor-kit');
  const args = ['apply', recipeId, '--dry'];
  const proc = spawn(cliBin, args, { cwd: workspaceFolder, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  proc.stdout.on('data', d => (stdout += d.toString()));
  proc.stderr.on('data', d => (stderr += d.toString()));
  proc.on('close', code => {
    if (code !== 0) {
      vscode.window.showErrorMessage(
        `Refactor failed (${code}): ${stderr || stdout}`.slice(0, 500)
      );
      return;
    }
    try {
      const plan: RecipeResultPlan = JSON.parse(stdout);
      const summary = summarizePlan(plan);
      const doc = new vscode.MarkdownString();
      doc.appendMarkdown(`### Recipe ${plan.recipeId}\n`);
      doc.appendMarkdown(summary);
      vscode.window.showInformationMessage(`Refactor ${plan.recipeId}: ${plan.status}`);
      vscode.commands.executeCommand('workbench.action.openSettingsJson'); // placeholder: open something to anchor chat
      vscode.window.activeTextEditor?.insertSnippet(
        new vscode.SnippetString(`\n/* Refactor plan: ${summary.replace(/`/g, '')} */\n`)
      );
    } catch (e) {
      vscode.window.showErrorMessage('Failed to parse refactor output');
    }
  });
}

function summarizePlan(plan: RecipeResultPlan): string {
  if (plan.codemods?.length) {
    const mods = plan.codemods
      .map(m => `${m.name || 'codemod'}:${m.modified ? 'modified' : m.error ? 'error' : 'noop'}`)
      .join(', ');
    return `Codemods => ${mods}`;
  }
  if (plan.steps?.length) {
    return plan.steps
      .slice(0, 5)
      .map((s: any, i: number) => `Step ${i + 1}: ${s.description || s}`)
      .join('\n');
  }
  return plan.status;
}
