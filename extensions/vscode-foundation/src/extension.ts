import * as vscode from 'vscode';

import { runRefactorCommand } from './commands/runRefactor';
import { registerRefactorChatParticipant } from './participant/refactor.chat';

import { assertNonNull } from '@foundation/contracts';

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
