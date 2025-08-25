#!/usr/bin/env ts-node

/**
 * API Gateway Demo
 *
 * This example demonstrates how to use the @foundation/api-gateway package
 * to create a simple API gateway with routing, authentication, and middleware.
 */

import { ApiGateway, GatewayConfig, RouteBuilder } from '@foundation/api-gateway';

import { createLogger } from '@foundation/observability';

// Gateway configuration
const config: GatewayConfig = {
  port: 8080,
  corsOrigins: ['http://localhost:3000', 'http://localhost:3001'],
  rateLimiting: true,
  compression: true,
  security: {
    helmet: true,
    hidePoweredBy: true,
    trustProxy: false,
  },
};

// Create logger
const logger = createLogger(true, 1, 'ApiGatewayDemo');

// Initialize gateway
const gateway = new ApiGateway(config, logger);

// Add health checks
gateway.addHealthChecks();

// Add a simple public route
gateway.addRoute(
  RouteBuilder.create()
    .get('/api/v1/public/info')
    .handler(async (req, res) => {
      res.json({
        message: 'This is a public endpoint',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      });
    })
    .build()
);

// Add a protected route with rate limiting
gateway.addRoute(
  RouteBuilder.create()
    .post('/api/v1/protected/data')
    .requireAuth()
    .rateLimit(60000, 10) // 10 requests per minute
    .validate({
      body: {
        name: 'string',
        email: 'string',
      },
    })
    .handler(async (req, res) => {
      res.json({
        message: 'Data received successfully',
        data: req.body,
        user: (req as any).context.userId,
        timestamp: new Date().toISOString(),
      });
    })
    .build()
);

// Add a route that proxies to user service
gateway.addRoute(
  RouteBuilder.create()
    .get('/api/v1/users/:id')
    .requireAuth()
    .rateLimit(60000, 50) // 50 requests per minute
    .handler(async (req, res) => {
      // In a real implementation, this would proxy to the user service
      const userId = req.params.id;

      // Mock response - in reality, you'd make an HTTP request to user service
      res.json({
        id: userId,
        name: 'Mock User',
        email: 'mock@foundation.local',
        source: 'proxied-from-user-service',
      });
    })
    .build()
);

// Error handling for unmatched routes
gateway.addRoute(
  RouteBuilder.create()
    .get('*')
    .handler(async (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
        availableEndpoints: [
          'GET /health',
          'GET /health/live',
          'GET /health/ready',
          'GET /api/v1/public/info',
          'POST /api/v1/protected/data',
          'GET /api/v1/users/:id',
        ],
      });
    })
    .build()
);

// Start the gateway
async function startGateway() {
  try {
    await gateway.listen();

    console.log('🚀 API Gateway Demo started successfully!');
    console.log('\nAvailable endpoints:');
    console.log('  Health Check:    GET  http://localhost:8080/health');
    console.log('  Public API:      GET  http://localhost:8080/api/v1/public/info');
    console.log('  Protected API:   POST http://localhost:8080/api/v1/protected/data');
    console.log('  User Proxy:      GET  http://localhost:8080/api/v1/users/123');
    console.log('\nTry these commands:');
    console.log('  curl http://localhost:8080/health');
    console.log('  curl http://localhost:8080/api/v1/public/info');
    console.log(
      '  curl -H "Authorization: Bearer demo-token" http://localhost:8080/api/v1/users/123'
    );
  } catch (error) {
    logger.error('Failed to start API Gateway', { error });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down API Gateway Demo...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down API Gateway Demo...');
  process.exit(0);
});

// Start the demo
if (require.main === module) {
  startGateway();
}

export { config, gateway };
