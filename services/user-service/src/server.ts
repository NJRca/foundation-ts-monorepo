import { ApiGateway, RouteBuilder } from '@foundation/api-gateway';
import { AuthenticationService, AuthorizationService } from '@foundation/security';
import { PostgresConnection, UserRepository } from '@foundation/database';

import { InMemoryEventStore } from '@foundation/events';
import { UserService } from './user-service';
import { createLogger } from '@foundation/observability';

// Load configuration
const config = {
  port: parseInt(process.env.PORT || '3001'),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'users',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
  },
  jwt: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret'
  }
};

async function startServer() {
  const logger = createLogger(false, 0, 'UserService');
  
  try {
    // Initialize dependencies
    const database = new PostgresConnection(config.database, logger);
    const eventStore = new InMemoryEventStore(logger);
    const userRepository = new UserRepository(database, undefined, logger);
    
    // Initialize services
    const authService = new AuthenticationService(config.jwt, logger);
    const authzService = new AuthorizationService(logger);
    const userService = new UserService(userRepository, eventStore, logger);

    // Setup authorization roles
    authzService.addRole({
      name: 'admin',
      permissions: [
        { resource: 'users', action: '*' },
        { resource: 'users/*', action: '*' }
      ]
    });

    authzService.addRole({
      name: 'user',
      permissions: [
        { resource: 'users', action: 'read' },
        { resource: 'users/*', action: 'read', conditions: { userId: '{userId}' } },
        { resource: 'users/*', action: 'update', conditions: { userId: '{userId}' } }
      ]
    });

    // Initialize API Gateway
    const gateway = new ApiGateway({
      port: config.port,
      corsOrigins: config.corsOrigins,
      rateLimiting: true,
      compression: true,
      security: {
        helmet: true,
        hidePoweredBy: true,
        trustProxy: false
      }
    }, logger);

    // Add health checks
    gateway.addHealthChecks();

    // User management routes
    gateway.addRoute(
      RouteBuilder.create()
        .post('/api/v1/users')
        .handler(async (req, res) => {
          const { name, email, password } = req.body;
          
          if (!name || !email || !password) {
            res.status(400).json({
              error: 'Bad Request',
              message: 'Name, email, and password are required'
            });
            return;
          }

          try {
            const user = await userService.createUser(name, email, password);
            res.status(201).json({
              id: user.id,
              name: user.name,
              email: user.email,
              createdAt: user.createdAt
            });
          } catch (error) {
            res.status(400).json({
              error: 'Bad Request',
              message: error instanceof Error ? error.message : 'Failed to create user'
            });
          }
        })
        .validate({
          body: {
            name: 'required',
            email: 'required',
            password: 'required'
          }
        })
        .rateLimit(60000, 5) // 5 requests per minute
        .build()
    );

    gateway.addRoute(
      RouteBuilder.create()
        .get('/api/v1/users/:id')
        .handler(async (req, res) => {
          const { id } = req.params;
          
          try {
            const user = await userService.getUserById(id);
            if (!user) {
              res.status(404).json({
                error: 'Not Found',
                message: 'User not found'
              });
              return;
            }

            res.json({
              id: user.id,
              name: user.name,
              email: user.email,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt
            });
          } catch (error) {
            logger.error('Failed to fetch user', {
              error: error instanceof Error ? error.message : error
            });
            res.status(500).json({
              error: 'Internal Server Error',
              message: 'Failed to fetch user'
            });
          }
        })
        .requireAuth()
        .build()
    );

    gateway.addRoute(
      RouteBuilder.create()
        .get('/api/v1/users')
        .handler(async (req, res) => {
          try {
            const users = await userService.getAllUsers();
            res.json({
              users: users.map(user => ({
                id: user.id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
              }))
            });
          } catch (error) {
            logger.error('Failed to fetch users', {
              error: error instanceof Error ? error.message : error
            });
            res.status(500).json({
              error: 'Internal Server Error',
              message: 'Failed to fetch users'
            });
          }
        })
        .requireAuth()
        .rateLimit(60000, 100) // 100 requests per minute
        .build()
    );

    gateway.addRoute(
      RouteBuilder.create()
        .put('/api/v1/users/:id')
        .handler(async (req, res) => {
          const { id } = req.params;
          const { name, email } = req.body;

          try {
            const updatedUser = await userService.updateUser(id, { name, email });
            if (!updatedUser) {
              res.status(404).json({
                error: 'Not Found',
                message: 'User not found'
              });
              return;
            }

            res.json({
              id: updatedUser.id,
              name: updatedUser.name,
              email: updatedUser.email,
              createdAt: updatedUser.createdAt,
              updatedAt: updatedUser.updatedAt
            });
          } catch (error) {
            res.status(400).json({
              error: 'Bad Request',
              message: error instanceof Error ? error.message : 'Failed to update user'
            });
          }
        })
        .requireAuth()
        .validate({
          body: {
            name: 'optional',
            email: 'optional'
          }
        })
        .build()
    );

    gateway.addRoute(
      RouteBuilder.create()
        .delete('/api/v1/users/:id')
        .handler(async (req, res) => {
          const { id } = req.params;

          try {
            await userService.deleteUser(id);
            res.status(204).send();
          } catch (error) {
            logger.error('Failed to delete user', {
              error: error instanceof Error ? error.message : error
            });
            res.status(500).json({
              error: 'Internal Server Error',
              message: 'Failed to delete user'
            });
          }
        })
        .requireAuth()
        .build()
    );

    // Authentication routes
    gateway.addRoute(
      RouteBuilder.create()
        .post('/api/v1/auth/login')
        .handler(async (req, res) => {
          const { email, password } = req.body;

          try {
            const user = await userService.authenticateUser(email, password);
            if (!user) {
              res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid credentials'
              });
              return;
            }

            const tokens = await authService.generateTokens(user);
            res.json(tokens);
          } catch (error) {
            logger.error('Authentication failed', {
              error: error instanceof Error ? error.message : error
            });
            res.status(500).json({
              error: 'Internal Server Error',
              message: 'Authentication failed'
            });
          }
        })
        .validate({
          body: {
            email: 'required',
            password: 'required'
          }
        })
        .rateLimit(60000, 5) // 5 login attempts per minute
        .build()
    );

    gateway.addRoute(
      RouteBuilder.create()
        .post('/api/v1/auth/refresh')
        .handler(async (req, res) => {
          const { refreshToken } = req.body;

          try {
            const tokens = await authService.refreshAccessToken(refreshToken);
            if (!tokens) {
              res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid refresh token'
              });
              return;
            }

            res.json(tokens);
          } catch (error) {
            logger.error('Token refresh failed', {
              error: error instanceof Error ? error.message : error
            });
            res.status(500).json({
              error: 'Internal Server Error',
              message: 'Token refresh failed'
            });
          }
        })
        .validate({
          body: {
            refreshToken: 'required'
          }
        })
        .build()
    );

    gateway.addRoute(
      RouteBuilder.create()
        .post('/api/v1/auth/logout')
        .handler(async (req, res) => {
          const authHeader = req.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            await authService.revokeToken(token);
          }

          res.status(204).send();
        })
        .requireAuth()
        .build()
    );

    // Start server
    await gateway.listen();
    
    logger.info('User service started successfully', {
      port: config.port,
      environment: process.env.NODE_ENV || 'development'
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully');
      await database.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully');
      await database.close();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start user service', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    process.exit(1);
  }
}

startServer();
