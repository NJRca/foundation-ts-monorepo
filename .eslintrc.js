module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  env: {
    node: true,
    es2022: true
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
    'quotes': ['error', 'single'],
    'semi': ['error', 'always']
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      env: {
        jest: true
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off'
      }
    },
    {
      files: ['packages/config/src/index.ts'],
      rules: {
        'no-process-env': 'off'
      }
    },
    {
      files: ['packages/analyzer/src/cli.ts'],
      rules: {
        'no-console': 'off'
      }
    }
  ]
};