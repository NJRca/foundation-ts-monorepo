/**
 * Test setup for acceptance tests
 * This file runs before all tests to ensure the environment is ready
 */

import { jest } from '@jest/globals';

// Global test configuration
jest.setTimeout(30000); // 30 seconds timeout for acceptance tests

// Test environment configuration
const TEST_CONFIG = {
  USER_SERVICE_URL: 'http://localhost:3001',
  TIMEOUT_MS: 10000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
};

// Make config available globally
(global as any).TEST_CONFIG = TEST_CONFIG;

// Health check utility function
async function waitForService(url: string, maxAttempts = 10, delayMs = 1000): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        console.log(`✅ Service at ${url} is ready`);
        return true;
      }
    } catch (error) {
      console.log(`⏳ Attempt ${attempt}/${maxAttempts}: Service at ${url} not ready...`);
    }

    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.error(`❌ Service at ${url} failed to become ready after ${maxAttempts} attempts`);
  return false;
}

// Global setup - wait for services to be ready
beforeAll(async () => {
  console.log('🚀 Setting up acceptance test environment...');

  // Wait for user service to be ready
  const userServiceReady = await waitForService(TEST_CONFIG.USER_SERVICE_URL, 10, 2000);

  if (!userServiceReady) {
    throw new Error(
      `User service not ready at ${TEST_CONFIG.USER_SERVICE_URL}. Please ensure containers are running.`
    );
  }

  console.log('✅ All services are ready for testing');
}, 60000); // 60 second timeout for setup

// Global teardown
afterAll(async () => {
  console.log('🧹 Cleaning up acceptance test environment...');
});

// Export utilities for use in tests
export { TEST_CONFIG, waitForService };
