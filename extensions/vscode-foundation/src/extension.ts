import * as vscode from 'vscode';

import { runRefactorCommand } from './commands/runRefactor';
import { registerRefactorChatParticipant } from './participant/refactor.chat';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('foundation.runRefactorRecipe', async () => {
      await runRefactorCommand();
    })
  );
  registerRefactorChatParticipant(context);
}

export function deactivate() {}
