import { ConfigManager, loadValidatedConfig } from '@foundation/config';
import { LogLevel, createLogger } from '@foundation/observability';
import express, { Request, Response } from 'express';

// Load and validate configuration at startup
const configManager: ConfigManager = loadValidatedConfig();

// Validate configuration immediately - fail fast if misconfigured
try {
  configManager.validate();
} catch (error) {
  console.error('❌ Configuration validation failed:');
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error('Unknown configuration error');
  }
  console.error('');
  console.error('💡 Please check your environment variables and .env file');
  process.exit(1);
}

// Configuration with proper typing and validation
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
  port: configManager.get('PORT') ? parseInt(configManager.get('PORT')!) : 3001,
  corsOrigins: ((configManager.get('CORS_ORIGINS') as string) || 'http://localhost:3000').split(
    ','
  ),
  database: {
    host: configManager.getRequired<string>('DB_HOST'),
    port: configManager.get('DB_PORT') ? parseInt(configManager.get('DB_PORT')!) : 5432,
    database: (configManager.get('DB_NAME') as string) || 'foundation_db',
    username: (configManager.get('DB_USER') as string) || 'foundation_user',
    password: configManager.getRequired<string>('DB_PASSWORD'),
  },
  jwt: {
    secret: configManager.getRequired<string>('JWT_SECRET'),
    refreshSecret: configManager.getRequired<string>('JWT_REFRESH_SECRET'),
  },
};

// Initialize logger
const logger = createLogger(false, LogLevel.INFO, 'user-service');

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
    version: '1.0.0',
  });
});

// Basic user endpoints (simplified for now)
app.get('/api/v1/users', (req: Request, res: Response) => {
  res.status(200).json({
    users: [],
    message: 'User service is running',
  });
});

app.post('/api/v1/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Email and password are required',
    });
  }

  // Simplified response for now
  return res.status(200).json({
    token: 'dummy-token',
    refreshToken: 'dummy-refresh-token',
    user: {
      email,
      name: 'Test User',
    },
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something went wrong',
  });
});

// Start server
async function startServer(): Promise<void> {
  try {
    logger.info('Starting user service...', { config: { port: config.port } });

    const server = app.listen(config.port, () => {
      logger.info('User service started successfully', {
        port: config.port,
        environment: process.env.NODE_ENV || 'development',
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
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// Start the server
startServer().catch(error => {
  logger.error('Startup error', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exit(1);
});
