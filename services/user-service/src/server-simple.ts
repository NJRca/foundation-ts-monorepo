import express, { Request, Response } from 'express';

import { createLogger } from '@foundation/observability';

// Configuration with proper typing
interface ServiceConfig {
  port: number;
  corsOrigins: string[];
  database: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
  jwt: {
    secret: string;
    refreshSecret: string;
  };
}

const config: ServiceConfig = {
  port: parseInt(process.env.PORT || '3001'),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'foundation_db',
    username: process.env.DB_USER || 'foundation_user',
    password: process.env.DB_PASSWORD || 'foundation_password'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret'
  }
};

// Initialize logger
const logger = createLogger('user-service');

// Create Express application
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'user-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Basic user endpoints (simplified for now)
app.get('/api/v1/users', (req: Request, res: Response) => {
  res.status(200).json({
    users: [],
    message: 'User service is running'
  });
});

app.post('/api/v1/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Email and password are required'
    });
  }

  // Simplified response for now
  res.status(200).json({
    token: 'dummy-token',
    refreshToken: 'dummy-refresh-token',
    user: {
      email,
      name: 'Test User'
    }
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something went wrong'
  });
});

// Start server
async function startServer(): Promise<void> {
  try {
    logger.info('Starting user service...', { config: { port: config.port } });

    const server = app.listen(config.port, () => {
      logger.info('User service started successfully', {
        port: config.port,
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start user service', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  logger.error('Startup error', { error: error instanceof Error ? error.message : 'Unknown error' });
  process.exit(1);
});
