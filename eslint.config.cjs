// Flat config built from legacy .eslintrc.js
const legacy = require('./.eslintrc.js');

// Load the TypeScript ESLint plugin and parser
let tsEslintPlugin;
let tsEslintParser;
try {
  tsEslintPlugin = require('@typescript-eslint/eslint-plugin');
  tsEslintParser = require('@typescript-eslint/parser');
} catch {
  // Leave plugin/parser undefined if not installed; ESLint will report missing plugin when running.
}

const baseConfig = {
  // Use parser if available
  languageOptions: {
    ...(legacy.parserOptions || {}),
    ...(tsEslintParser ? { parser: tsEslintParser } : {}),
  },
  settings: legacy.settings || {},
  plugins: tsEslintPlugin ? { '@typescript-eslint': tsEslintPlugin } : {},
  rules: legacy.rules || {},
  ignores: legacy.ignorePatterns || [],
};

// Convert legacy overrides into flat-config style entries
const overrideEntries = (legacy.overrides || []).map(o => {
  const entry = {
    files: o.files || ['**/*'],
  };
  if (o.env) entry.env = o.env;
  if (o.rules) entry.rules = o.rules;
  if (o.settings) entry.settings = o.settings;
  if (o.parserOptions) entry.languageOptions = { ...(o.parserOptions || {}) };
  return entry;
});

module.exports = [baseConfig, ...overrideEntries];
