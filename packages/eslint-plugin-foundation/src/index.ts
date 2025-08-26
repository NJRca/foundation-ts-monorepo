import { Linter } from 'eslint';

const noProcessEnvOutsideConfig = require('./rules/no-process-env-outside-config');
const requireDbcOnExported = require('./rules/require-dbc-on-exported');
const complexityDeltaJustified = require('./rules/complexity-delta-justified');

export const rules = {
  'no-process-env-outside-config': noProcessEnvOutsideConfig,
  'require-dbc-on-exported': requireDbcOnExported,
  'complexity-delta-justified': complexityDeltaJustified,
};

export const configs: Record<string, Linter.Config> = {
  recommended: {
    plugins: ['foundation'],
    rules: {
      'foundation/no-process-env-outside-config': 'error',
      'foundation/require-dbc-on-exported': 'warn',
      'foundation/complexity-delta-justified': 'warn',
    },
  },
};

module.exports = {
  rules,
  configs,
};
