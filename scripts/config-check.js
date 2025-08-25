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
  console.error('❌ Failed to load @foundation/config package');
  console.error('   Make sure to run "npm run build" first');
  console.error('   Error:', error.message);
  process.exit(1);
}

async function validateConfiguration() {
  console.log('🔍 Foundation Monorepo - Configuration Validation');
  console.log('=================================================');
  console.log('');

  try {
    // Load and validate configuration
    const config = loadValidatedConfig();

    console.log('📋 Validating configuration...');

    // Perform validation
    config.validate();

    console.log('✅ Configuration validation passed!');
    console.log('');

    // Show loaded configuration (without sensitive values)
    console.log('📊 Configuration Summary:');

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
        console.log(`   ${key}: ${value}`);
      }
    }

    // Check sensitive configuration exists (without showing values)
    const sensitiveKeys = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DB_PASSWORD'];
    console.log('');
    console.log('🔒 Sensitive Configuration Check:');

    for (const key of sensitiveKeys) {
      const exists = config.has(key);
      const value = config.get(key);
      const isValid = value && value.length >= 8;

      if (exists && isValid) {
        console.log(`   ✅ ${key}: Present and valid`);
      } else if (exists) {
        console.log(`   ⚠️  ${key}: Present but may be too short`);
      } else {
        console.log(`   ❌ ${key}: Missing`);
      }
    }

    console.log('');
    console.log('🎉 All configuration validation checks passed!');
  } catch (error) {
    console.error('❌ Configuration validation failed:');
    console.error('');

    if (error.name === 'ConfigValidationError') {
      console.error(error.message);

      if (error.missingKeys && error.missingKeys.length > 0) {
        console.error('');
        console.error('Missing required environment variables:');
        for (const key of error.missingKeys) {
          console.error(`   - ${key}`);
        }

        console.error('');
        console.error('💡 Quick fix:');
        console.error('   1. Copy .env.example to .env');
        console.error('   2. Fill in the required values');
        console.error('   3. Source the .env file or restart your shell');
      }
    } else {
      console.error(error.message);
    }

    console.error('');
    console.error('🚫 Configuration validation failed - services will not start properly');
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run validation
validateConfiguration().catch(error => {
  console.error('❌ Configuration validation script failed:', error);
  process.exit(1);
});
