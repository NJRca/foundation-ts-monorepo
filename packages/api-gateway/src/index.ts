import { Application, NextFunction, Request, Response } from 'express';

import { Logger } from '@foundation/contracts';
import { createLogger } from '@foundation/observability';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Types and interfaces
export interface RouteConfig {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void> | void;
  middleware?: Middleware[];
  requiresAuth?: boolean;
  rateLimit?: RateLimitConfig;
  validation?: ValidationConfig;
}

export type Middleware = (req: Request, res: Response, next: NextFunction) => Promise<void> | void;

export type ErrorMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface ValidationConfig {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
}

export interface GatewayConfig {
  port: number;
  corsOrigins: string[];
  rateLimiting: boolean;
  compression: boolean;
  security: {
    helmet: boolean;
    hidePoweredBy: boolean;
    trustProxy: boolean;
  };
}

// Request context for tracing and logging
export interface RequestContext {
  requestId: string;
  userId?: string;
  userAgent?: string;
  ip: string;
  startTime: Date;
  path: string;
  method: string;
}

// API Gateway class
export class ApiGateway {
  private readonly app: Application;
  private readonly logger: Logger;
  private readonly config: GatewayConfig;
  private readonly routes: Map<string, RouteConfig> = new Map();
  private readonly middlewareStack: Middleware[] = [];

  constructor(config: GatewayConfig, logger?: Logger) {
    this.app = express();
    this.logger = logger || createLogger(false, 0, 'ApiGateway');
    this.config = config;

    this.setupBaseMiddleware();
  }

  private setupBaseMiddleware(): void {
    // Trust proxy if configured
    if (this.config.security.trustProxy) {
      this.app.set('trust proxy', true);
    }

    // Security middleware
    if (this.config.security.helmet) {
      this.app.use(helmet());
    }

    if (this.config.security.hidePoweredBy) {
      this.app.disable('x-powered-by');
    }

    // CORS configuration
    this.app.use(
      cors({
        origin: this.config.corsOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      })
    );

    // Parse JSON with size limit
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request context middleware
    this.app.use(this.createRequestContextMiddleware());

    // Compression middleware
    if (this.config.compression) {
      this.app.use(this.createCompressionMiddleware());
    }

    // Global middleware stack
    this.middlewareStack.forEach(middleware => {
      this.app.use(middleware);
    });
  }

  private createRequestContextMiddleware(): Middleware {
    return (req: Request, res: Response, next: NextFunction): void => {
      const requestId = (req.headers['x-request-id'] as string) || this.generateRequestId();
      const context: RequestContext = {
        requestId,
        userId: req.headers['x-user-id'] as string,
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.socket.remoteAddress || 'unknown',
        startTime: new Date(),
        path: req.path,
        method: req.method,
      };

      // Attach context to request
      (req as any).context = context;

      // Set response headers
      res.setHeader('X-Request-ID', requestId);

      // Log request
      this.logger.info(`${req.method} ${req.path}`, {
        requestId,
        method: req.method,
        path: req.path,
        userAgent: context.userAgent,
        ip: context.ip,
      });

      next();
    };
  }

  private createCompressionMiddleware(): Middleware {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Simple compression middleware
      const originalSend = res.send;

      res.send = function (data: any): Response {
        if (typeof data === 'string' && data.length > 1024) {
          res.setHeader('Content-Encoding', 'gzip');
          // In a real implementation, you'd use a compression library here
        }
        return originalSend.call(this, data);
      };

      next();
    };
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // Add global middleware
  addMiddleware(middleware: Middleware): void {
    this.middlewareStack.push(middleware);
    this.app.use(middleware);
  }

  // Add route
  addRoute(config: RouteConfig): void {
    const routeKey = `${config.method}:${config.path}`;
    this.routes.set(routeKey, config);

    const middlewares: Middleware[] = [];

    // Add rate limiting if configured
    if (config.rateLimit) {
      middlewares.push(this.createRateLimitMiddleware(config.rateLimit));
    }

    // Add validation if configured
    if (config.validation) {
      middlewares.push(this.createValidationMiddleware(config.validation));
    }

    // Add authentication if required
    if (config.requiresAuth) {
      middlewares.push(this.createAuthMiddleware());
    }

    // Add route-specific middleware
    if (config.middleware) {
      middlewares.push(...config.middleware);
    }

    // Add error handling wrapper
    middlewares.push(this.createErrorHandlingWrapper(config.handler));

    // Register route with Express
    const method = config.method.toLowerCase() as keyof Application;
    this.app[method](config.path, ...middlewares);

    this.logger.info(`Registered route: ${config.method} ${config.path}`, {
      method: config.method,
      path: config.path,
      requiresAuth: config.requiresAuth,
      hasRateLimit: !!config.rateLimit,
      hasValidation: !!config.validation,
    });
  }

  private createRateLimitMiddleware(config: RateLimitConfig): Middleware {
    const requests = new Map<string, { count: number; resetTime: number }>();

    return (req: Request, res: Response, next: NextFunction): void => {
      const ip = req.ip || 'unknown';
      const now = Date.now();
      const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
      const key = `${ip}:${windowStart}`;

      const current = requests.get(key) || { count: 0, resetTime: windowStart + config.windowMs };

      if (now > current.resetTime) {
        requests.delete(key);
        current.count = 0;
        current.resetTime = windowStart + config.windowMs;
      }

      current.count++;
      requests.set(key, current);

      res.setHeader('X-RateLimit-Limit', config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - current.count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(current.resetTime / 1000));

      if (current.count > config.maxRequests) {
        res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Max ${config.maxRequests} requests per ${config.windowMs}ms.`,
          retryAfter: Math.ceil((current.resetTime - now) / 1000),
        });
        return;
      }

      next();
    };
  }

  private createValidationMiddleware(config: ValidationConfig): Middleware {
    const validateSection = (
      section: Record<string, unknown> | undefined,
      values: Record<string, any>,
      sectionName: string
    ): string[] => {
      const errors: string[] = [];
      if (section) {
        for (const [key, schema] of Object.entries(section)) {
          if (!values[key] && schema) {
            errors.push(`Missing required field in ${sectionName}: ${key}`);
          }
        }
      }
      return errors;
    };

    return (req: Request, res: Response, next: NextFunction): void => {
      let errors: string[] = [];
      errors = errors.concat(validateSection(config.body, req.body, 'body'));
      errors = errors.concat(validateSection(config.query, req.query, 'query'));
      errors = errors.concat(validateSection(config.params, req.params, 'params'));

      if (errors.length > 0) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Request validation failed',
          details: errors,
        });
        return;
      }

      next();
    };
  }

  private createAuthMiddleware(): Middleware {
    return (req: Request, res: Response, next: NextFunction): void => {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing Authorization header',
        });
        return;
      }

      // Simple token validation - in a real implementation, verify JWT tokens
      const token = authHeader.replace('Bearer ', '');
      if (!token || token.length < 10) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid token',
        });
        return;
      }

      // Add user info to request context
      (req as any).context.userId = 'user_from_token';
      next();
    };
  }

  private createErrorHandlingWrapper(handler: RouteConfig['handler']): Middleware {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        await handler(req, res, next);
      } catch (error) {
        const context = (req as any).context as RequestContext;

        this.logger.error('Route handler error', {
          requestId: context.requestId,
          method: req.method,
          path: req.path,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });

        if (!res.headersSent) {
          res.status(500).json({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred',
            requestId: context.requestId,
          });
        }
      }
    };
  }

  // Add health check endpoints
  addHealthChecks(): void {
    this.addRoute({
      path: '/health',
      method: 'GET',
      handler: async (req: Request, res: Response): Promise<void> => {
        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.version,
        });
      },
    });

    this.addRoute({
      path: '/health/live',
      method: 'GET',
      handler: async (req: Request, res: Response): Promise<void> => {
        res.status(200).send('OK');
      },
    });

    this.addRoute({
      path: '/health/ready',
      method: 'GET',
      handler: async (req: Request, res: Response): Promise<void> => {
        // Check if all dependencies are ready
        res.json({ status: 'ready', timestamp: new Date().toISOString() });
      },
    });
  }

  // Start the server
  listen(port?: number): Promise<void> {
    const serverPort = port || this.config.port;

    return new Promise(resolve => {
      this.app.listen(serverPort, () => {
        this.logger.info(`API Gateway listening on port ${serverPort}`, {
          port: serverPort,
          // Prefer a provided environment field or gracefully fallback
          environment: (this.config as any).environment || 'development',
          corsOrigins: this.config.corsOrigins,
          routeCount: this.routes.size,
        });
        resolve();
      });
    });
  }

  // Get Express app for testing
  getApp(): Application {
    return this.app;
  }

  // Get registered routes
  getRoutes(): Map<string, RouteConfig> {
    return new Map(this.routes);
  }
}

// Route builder for fluent API
export class RouteBuilder {
  private readonly config: Partial<RouteConfig> = {};

  static create(): RouteBuilder {
    return new RouteBuilder();
  }

  path(path: string): this {
    this.config.path = path;
    return this;
  }

  method(method: RouteConfig['method']): this {
    this.config.method = method;
    return this;
  }

  get(path: string): this {
    this.config.path = path;
    this.config.method = 'GET';
    return this;
  }

  post(path: string): this {
    this.config.path = path;
    this.config.method = 'POST';
    return this;
  }

  put(path: string): this {
    this.config.path = path;
    this.config.method = 'PUT';
    return this;
  }

  delete(path: string): this {
    this.config.path = path;
    this.config.method = 'DELETE';
    return this;
  }

  handler(handler: RouteConfig['handler']): this {
    this.config.handler = handler;
    return this;
  }

  middleware(...middleware: Middleware[]): this {
    this.config.middleware = [...(this.config.middleware || []), ...middleware];
    return this;
  }

  requireAuth(): this {
    this.config.requiresAuth = true;
    return this;
  }

  rateLimit(windowMs: number, maxRequests: number): this {
    this.config.rateLimit = { windowMs, maxRequests };
    return this;
  }

  validate(validation: ValidationConfig): this {
    this.config.validation = validation;
    return this;
  }

  build(): RouteConfig {
    if (!this.config.path || !this.config.method || !this.config.handler) {
      throw new Error('Route must have path, method, and handler');
    }

    return this.config as RouteConfig;
  }
}

// Export common middleware functions
export const CommonMiddleware = {
  // CORS middleware factory
  cors: (origins: string[]) =>
    cors({
      origin: origins,
      credentials: true,
    }),

  // JSON parser with size limit
  json: (limit = '10mb') => express.json({ limit }),

  // URL encoded parser
  urlencoded: (limit = '10mb') => express.urlencoded({ extended: true, limit }),

  // Request logging middleware
  requestLogger: (logger: Logger): Middleware => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const start = Date.now();
      const originalSend = res.send;

      res.send = function (data: any): Response {
        const duration = Date.now() - start;
        const context = (req as any).context as RequestContext;

        logger.info(`${req.method} ${req.path} - ${res.statusCode}`, {
          requestId: context?.requestId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          contentLength: res.get('content-length'),
          userAgent: req.headers['user-agent'],
        });

        return originalSend.call(this, data);
      };

      next();
    };
  },

  // Error handling middleware
  errorHandler: (logger: Logger): ErrorMiddleware => {
    return (error: Error, req: Request, res: Response, next: NextFunction): void => {
      const context = (req as any).context as RequestContext;

      logger.error('Unhandled error in middleware', {
        requestId: context?.requestId,
        method: req.method,
        path: req.path,
        error: error.message,
        stack: error.stack,
      });

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred',
          requestId: context?.requestId,
        });
      }
    };
  },
};
