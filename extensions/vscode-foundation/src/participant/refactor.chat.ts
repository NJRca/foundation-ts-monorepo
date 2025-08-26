import * as vscode from 'vscode';

import { spawn } from 'child_process';
import path from 'path';

// Register a chat participant @foundation with an action: refactor <recipe>
import { assertNonNull } from '@foundation/contracts';

export function registerRefactorChatParticipant(context: vscode.ExtensionContext) {
  assertNonNull(context, 'context');
  // Guard if chat participant API not present
  const anyVscode: any = vscode as any;
  if (!anyVscode.chat || !anyVscode.chat.createChatParticipant) {
    return;
  }
  const participant = anyVscode.chat.createChatParticipant(
    'foundation',
    async (request: any, context2: any, response: any) => {
      const text: string = request.prompt || '';
      const match = text.match(/refactor\s+(\S+)/i);
      if (!match) {
        response.markdown('Usage: @foundation refactor <recipe-id>');
        return;
      }
      const recipeId = match[1];
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceFolder) {
        response.markdown('No workspace open');
        return;
      }
      const cliBin = path.join(workspaceFolder, 'node_modules', '.bin', 'refactor-kit');
      const args = ['apply', recipeId, '--dry'];
      response.progress(`Running recipe ${recipeId}...`);
      try {
        const json = await runCli(cliBin, args, workspaceFolder);
        const plan = JSON.parse(json);
        response.markdown(formatPlan(plan));
      } catch (e: any) {
        response.markdown(`Error: ${e.message || e}`);
      }
    }
  );
  context.subscriptions.push(participant);
}

function runCli(bin: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { cwd });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => (stdout += d.toString()));
    proc.stderr.on('data', d => (stderr += d.toString()));
    proc.on('error', reject);
    proc.on('close', code => {
      if (code !== 0) return reject(new Error(stderr || stdout));
      resolve(stdout);
    });
  });
}

function formatPlan(plan: any): string {
  if (plan.codemods?.length) {
    const lines = plan.codemods.map(
      (m: any) =>
        `- ${m.name || 'codemod'}: ${m.modified ? 'modified' : m.error ? 'error' : 'noop'}`
    );
    return `### ${plan.recipeId}\n${lines.join('\n')}\nStatus: ${plan.status}`;
  }
  if (plan.steps?.length) {
    const lines = plan.steps
      .slice(0, 10)
      .map((s: any, i: number) => `- Step ${i + 1}: ${s.description || s}`);
    return `### ${plan.recipeId}\n${lines.join('\n')}\nStatus: ${plan.status}`;
  }
  return `### ${plan.recipeId}\nStatus: ${plan.status}`;
}
