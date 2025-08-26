import * as vscode from 'vscode';

import { assertNonNull } from '@foundation/contracts';
import { registerRefactorChatParticipant } from './participant/refactor.chat';
import { runRefactorCommand } from './commands/runRefactor';

export function activate(context: vscode.ExtensionContext) {
  assertNonNull(context, 'context');
  context.subscriptions.push(
    vscode.commands.registerCommand('foundation.runRefactorRecipe', async () => {
      await runRefactorCommand();
    })
  );
  registerRefactorChatParticipant(context);
}

export function deactivate() {}
