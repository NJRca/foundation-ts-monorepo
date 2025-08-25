module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // Basic TypeScript rules
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': 'error',

    // No direct process.env access (except in config package)
    'no-process-env': 'error',

    // General code quality
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'no-duplicate-imports': 'error',

    // Code style
    quotes: ['error', 'single'],
    semi: ['error', 'always'],
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
    {
      files: [
        'packages/api-gateway/src/**/*.ts',
        'packages/database/src/**/*.ts',
        'packages/observability/src/**/*.ts',
        'packages/performance/src/**/*.ts',
        'packages/security/src/**/*.ts',
        'packages/selfheal-*/src/**/*.ts',
      ],
      rules: {
        // Temporarily downgrade explicit any to warn during staged typing migration
        '@typescript-eslint/no-explicit-any': 'warn',
      },
    },
    {
      files: ['services/user-service/src/server*.ts'],
      rules: {
        // Allow console in example/demo startup scripts
        'no-console': 'off',
      },
    },
    {
      files: ['packages/config/src/index.ts'],
      rules: {
        'no-process-env': 'off',
      },
    },
    {
      files: ['packages/analyzer/src/cli.ts'],
      rules: {
        'no-console': 'off',
        'no-fallthrough': 'off',
      },
    },
  ],
};
