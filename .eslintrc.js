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
    // Use the TypeScript-aware rule and keep it permissive for staged migration
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { args: 'none', varsIgnorePattern: '^_', argsIgnorePattern: '^_' },
    ],

    // core "no-undef" can be noisy for TS projects (TypeScript handles undefined identifiers)
    'no-undef': 'off',

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
      files: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.js', '**/*.spec.js'],
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
        'packages/api-gateway/src/**/*.{ts,js}',
        'packages/database/src/**/*.{ts,js}',
        'packages/observability/src/**/*.{ts,js}',
        'packages/performance/src/**/*.{ts,js}',
        'packages/security/src/**/*.{ts,js}',
        'packages/selfheal-*/src/**/*.{ts,js}',
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
    {
      files: ['scripts/**/*.js', 'scripts/**/*.ts', 'packages/refactor-cli/src/**/*.ts'],
      rules: {
        'no-console': 'off',
        'no-process-env': 'off',
      },
    },
    {
      files: ['services/user-service/src/**/*.js', 'services/user-service/src/**/*.ts'],
      rules: {
        'no-console': 'off',
        'no-process-env': 'off',
      },
    },
  ],
};
