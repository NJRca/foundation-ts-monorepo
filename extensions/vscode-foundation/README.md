# Foundation VS Code Bridge

Lightweight helper extension to trigger `@foundation/refactor-kit` recipes from the command palette or (optionally) chat.

Features:

- Command Palette: "Foundation: Run Refactor Recipe" selects and runs a recipe in dry mode, summarizing results.
- Configuration: `foundation.refactor.cliPath` to override binary path.

Planned (optional / behind feature flags):

- Chat participant invocation `@foundation refactor <recipe>` (requires VS Code chat API availability).

Dev Build:

1. `npm install` at repo root.
2. `cd extensions/vscode-foundation && npm run build` (or `watch`).
3. Use "Run Extension" in VS Code or load the folder via "Install from VSIX" after packaging.

Security / Trust:
The extension only shells out to the local workspace's `refactor-kit` binary (dry mode) and parses JSON stdout.
