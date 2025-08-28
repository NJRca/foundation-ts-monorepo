#!/usr/bin/env node

/**
 * Configuration Validation Script
 *
 * This script validates environment configuration without starting services.
 * Used in CI/CD to ensure all required environment variables are present
 * and have valid values before deployment.
 */

const path = require('path');
const fs = require('fs');

// Add the packages directory to the module path for local resolution
const packagesDir = path.join(__dirname, '..', 'packages');
const configPackageDir = path.join(packagesDir, 'config', 'src');

// Dynamically require the config package
let loadValidatedConfig;
try {
  // Try to require from the built dist first
  const distPath = path.join(packagesDir, 'config', 'dist', 'index.js');
  if (fs.existsSync(distPath)) {
    const configModule = require(distPath);
    loadValidatedConfig = configModule.loadValidatedConfig;
  } else {
    // Fallback to TypeScript compilation on-the-fly (for development)
    require('ts-node/register');
    const configModule = require(path.join(configPackageDir, 'index.ts'));
    loadValidatedConfig = configModule.loadValidatedConfig;
  }
} catch (error) {
  process.stderr.write('❌ Failed to load @foundation/config package\n');
  process.stderr.write('   Make sure to run "npm run build" first\n');
  process.stderr.write(
    '   Error: ' + (error && error.message ? error.message : String(error)) + '\n'
  );
  process.exit(1);
}

async function validateConfiguration() {
  process.stdout.write('🔍 Foundation Monorepo - Configuration Validation\n');
  process.stdout.write('=================================================\n');
  process.stdout.write('\n');

  try {
    // Load and validate configuration
    const config = loadValidatedConfig();

    process.stdout.write('📋 Validating configuration...\n');

    // Perform validation
    config.validate();

    process.stdout.write('✅ Configuration validation passed!\n');
    process.stdout.write('\n');

    // Show loaded configuration (without sensitive values)
    process.stdout.write('📊 Configuration Summary:\n');

    const configKeys = [
      'NODE_ENV',
      'PORT',
      'DB_HOST',
      'DB_PORT',
      'DB_NAME',
      'DB_USER',
      'REDIS_HOST',
      'REDIS_PORT',
      'LOG_LEVEL',
      'CORS_ORIGINS',
    ];

    for (const key of configKeys) {
      const value = config.get(key);
      if (value !== undefined) {
        process.stdout.write(`   ${key}: ${value}\n`);
      }
    }

    // Check sensitive configuration exists (without showing values)
    const sensitiveKeys = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DB_PASSWORD'];
    process.stdout.write('\n');
    process.stdout.write('🔒 Sensitive Configuration Check:\n');

    for (const key of sensitiveKeys) {
      const exists = config.has(key);
      const value = config.get(key);
      const isValid = value && value.length >= 8;

      if (exists && isValid) {
        process.stdout.write(`   ✅ ${key}: Present and valid\n`);
      } else if (exists) {
        process.stdout.write(`   ⚠️  ${key}: Present but may be too short\n`);
      } else {
        process.stdout.write(`   ❌ ${key}: Missing\n`);
      }
    }

    process.stdout.write('\n');
    process.stdout.write('🎉 All configuration validation checks passed!\n');
  } catch (error) {
    process.stderr.write('❌ Configuration validation failed:\n\n');

    if (error.name === 'ConfigValidationError') {
      console.error(error.message);

      if (error.missingKeys && error.missingKeys.length > 0) {
        process.stderr.write('\n');
        process.stderr.write('Missing required environment variables:\n');
        for (const key of error.missingKeys) {
          process.stderr.write(`   - ${key}\n`);
        }

        process.stderr.write('\n');
        process.stderr.write('💡 Quick fix:\n');
        process.stderr.write('   1. Copy .env.example to .env\n');
        process.stderr.write('   2. Fill in the required values\n');
        process.stderr.write('   3. Source the .env file or restart your shell\n');
      }
    } else {
      process.stderr.write((error && error.message ? error.message : String(error)) + '\n');
    }

    process.stderr.write('\n');
    process.stderr.write('🚫 Configuration validation failed - services will not start properly\n');
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  process.stderr.write(
    '❌ Unhandled Rejection at: ' + String(promise) + ' reason: ' + String(reason) + '\n'
  );
  process.exit(1);
});

// Run validation
validateConfiguration().catch(error => {
  process.stderr.write('❌ Configuration validation script failed: ' + String(error) + '\n');
  process.exit(1);
});
