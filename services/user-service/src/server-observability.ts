// ALLOW_COMPLEXITY_DELTA: Observability helper for the user-service is
// intentionally comprehensive; marking as allowed for repository policy.
const express = require('express');
const { randomUUID } = require('crypto');

import { TypedConfig, loadTypedConfig } from '@foundation/config';
import { NextFunction, Request, Response } from 'express';

// Load typed configuration
const config: TypedConfig = loadTypedConfig();

// Simple observability middleware
function observabilityMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Add correlation ID
    const correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    // Log request start
    const startTime = Date.now();
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: 'Request started',
        correlationId,
        method: req.method,
        path: req.path,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      })
    );

    // Log response completion with appropriate log level
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      let logLevel = 'INFO';
      if (res.statusCode >= 400) {
        logLevel = 'ERROR';
      } else if (res.statusCode >= 300) {
        logLevel = 'WARN';
      }

      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: logLevel,
          message: 'Request completed',
          correlationId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          responseSize: res.getHeader('content-length') || 0,
        })
      );
    });

    next();
  };
}

// Create Express application
const app = express();

// Apply observability middleware first
app.use(observabilityMiddleware());

// Standard middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint with observability
app.get('/health', (req: Request, res: Response) => {
  const correlationId = req.headers['x-correlation-id'];

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'Health check requested',
      correlationId,
    })
  );

  res.status(200).json({
    status: 'healthy',
    service: 'user-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.nodeEnv,
    observability: {
      correlationId,
      metrics: true,
      structuredLogs: true,
    },
  });
});

// Metrics endpoint
app.get('/metrics', (req: Request, res: Response) => {
  const correlationId = req.headers['x-correlation-id'];

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'Metrics requested',
      correlationId,
    })
  );

  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(`# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 1

# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds gauge
process_uptime_seconds ${process.uptime()}

# HELP nodejs_memory_usage_bytes Node.js memory usage
# TYPE nodejs_memory_usage_bytes gauge
nodejs_memory_usage_bytes{type="rss"} ${process.memoryUsage().rss}
nodejs_memory_usage_bytes{type="heapTotal"} ${process.memoryUsage().heapTotal}
nodejs_memory_usage_bytes{type="heapUsed"} ${process.memoryUsage().heapUsed}
`);
});

// Basic user endpoints with observability
app.get('/api/v1/users', (req: Request, res: Response) => {
  const correlationId = req.headers['x-correlation-id'];

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'Users list requested',
      correlationId,
    })
  );

  res.status(200).json({
    users: [
      {
        id: '1',
        name: 'Admin User',
        email: 'admin@foundation.local',
        roles: ['admin'],
        isActive: true,
      },
    ],
    total: 1,
    metadata: {
      correlationId,
      timestamp: new Date().toISOString(),
    },
  });
});

app.post('/api/v1/auth/login', (req: Request, res: Response): void => {
  const { email, password } = req.body;
  const correlationId = req.headers['x-correlation-id'];

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'Login attempt',
      correlationId,
      email,
    })
  );

  if (!email || !password) {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'WARN',
        message: 'Login failed - missing credentials',
        correlationId,
        error: 'Email and password are required',
      })
    );

    res.status(400).json({
      error: 'Bad Request',
      message: 'Email and password are required',
      correlationId,
    });
    return;
  }

  // Mock authentication
  if (email === 'admin@foundation.local' && password === 'admin123') {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: 'Login successful',
        correlationId,
        email,
      })
    );

    res.status(200).json({
      user: {
        id: '1',
        name: 'Admin User',
        email: 'admin@foundation.local',
        roles: ['admin'],
      },
      token: 'mock-jwt-token',
      correlationId,
    });
  } else {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'WARN',
        message: 'Login failed - invalid credentials',
        correlationId,
        email,
      })
    );

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid credentials',
      correlationId,
    });
  }
});

// API info endpoint
app.get('/api/v1/info', (req: Request, res: Response) => {
  const correlationId = req.headers['x-correlation-id'];

  res.status(200).json({
    service: 'user-service',
    version: '1.0.0',
    environment: config.nodeEnv,
    endpoints: {
      health: '/health',
      metrics: '/metrics',
      users: '/api/v1/users',
      login: '/api/v1/auth/login',
    },
    observability: {
      correlationId,
      structuredLogs: true,
      metrics: true,
    },
  });
});

// Error handling middleware with observability
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  const correlationId = req.headers['x-correlation-id'];

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: 'Unhandled error',
      correlationId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      method: req.method,
      path: req.path,
    })
  );

  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    correlationId,
  });
});

// 404 handler with observability
app.use((req: Request, res: Response) => {
  const correlationId = req.headers['x-correlation-id'];

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message: 'Route not found',
      correlationId,
      method: req.method,
      path: req.path,
    })
  );

  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    correlationId,
  });
});

// Start server
async function startServer(): Promise<void> {
  try {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: 'Starting user service',
        config: {
          port: config.port,
          environment: config.nodeEnv,
          observabilityEnabled: true,
        },
      })
    );

    const server = app.listen(config.port, () => {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: 'User service started successfully',
          port: config.port,
          endpoints: {
            health: `http://localhost:${config.port}/health`,
            metrics: `http://localhost:${config.port}/metrics`,
            api: `http://localhost:${config.port}/api/v1/info`,
          },
          environment: config.nodeEnv,
        })
      );
    });

    // Graceful shutdown handlers
    const shutdown = () => {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: 'Shutting down gracefully',
        })
      );

      server.close(() => {
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message: 'Server closed',
          })
        );
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message: 'Failed to start user service',
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : error,
      })
    );
    process.exit(1);
  }
}

// Handle startup errors
startServer().catch(error => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: 'Startup error',
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
    })
  );
  process.exit(1);
});

export default app;
