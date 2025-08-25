#!/usr/bin/env node

// Simple test to verify config functionality
const { loadConfig, getTypedConfig } = require('./packages/config/dist/index.js');

console.log('🧪 Testing config functionality...');

try {
  // Test basic config loading
  const configManager = loadConfig({
    PORT: '3001',
    NODE_ENV: 'development',
    DB_HOST: 'localhost',
    DB_NAME: 'test_db',
    DB_USER: 'test_user',
    DB_PASSWORD: 'test-password-123456',
    REDIS_HOST: 'localhost',
    JWT_SECRET: 'test-jwt-secret-at-least-32-chars-long',
    JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-chars',
  });

  console.log('✅ Config manager created successfully');

  // Test configuration retrieval
  const port = configManager.get('PORT', 3000);
  console.log(`✅ Port configuration: ${port}`);

  // Test required configuration
  const dbHost = configManager.getRequired('DB_HOST');
  console.log(`✅ Database host: ${dbHost}`);

  // Test typed configuration
  const config = getTypedConfig(configManager);
  console.log(`✅ Typed config port: ${config.port}`);
  console.log(`✅ Typed config environment: ${config.nodeEnv}`);

  console.log('🎉 All config tests passed!');
  process.exit(0);
} catch (error) {
  console.error('❌ Config test failed:', error.message);
  process.exit(1);
}
