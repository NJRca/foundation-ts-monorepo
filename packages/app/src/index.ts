// ALLOW_COMPLEXITY_DELTA: App package combines bootstrapping logic; large for now.

import * as http from 'http';
import * as url from 'url';

import { Config, HealthCheck, HealthResult, Logger } from '@foundation/contracts';

import { createLogger } from '@foundation/observability';
import { loadConfig } from '@foundation/config';

interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  checks: Array<{
    name: string;
    status: 'healthy' | 'unhealthy' | 'degraded';
    message?: string;
    details?: Record<string, unknown>;
  }>;
  uptime: number;
}

class AppHealthCheck implements HealthCheck {
  name = 'app';

  async check(): Promise<HealthResult> {
    return {
      status: 'healthy',
      message: 'Application is running',
      timestamp: new Date(),
    };
  }
}

class HttpServer {
  private server: http.Server;
  private logger: Logger;
  private config: Config;
  private healthChecks: HealthCheck[] = [];
  private startTime: Date = new Date();

  constructor(logger: Logger, config: Config) {
    this.logger = logger;
    this.config = config;
    this.server = http.createServer(this.handleRequest.bind(this));
    this.healthChecks.push(new AppHealthCheck());
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const parsedUrl = url.parse(req.url || '', true);
    const pathname = parsedUrl.pathname;

    this.logger.info(`${req.method} ${pathname}`, {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
    });

    try {
      if (pathname === '/health' && req.method === 'GET') {
        await this.handleHealth(res);
      } else if (pathname === '/' && req.method === 'GET') {
        this.handleRoot(res);
      } else {
        this.handleNotFound(res);
      }
    } catch (error) {
      this.logger.error('Request handling error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.handleServerError(res);
    }
  }

  private async handleHealth(res: http.ServerResponse): Promise<void> {
    const checks = await Promise.all(
      this.healthChecks.map(async check => {
        try {
          const result = await check.check();
          return {
            name: check.name,
            status: result.status,
            ...(result.message ? { message: result.message } : {}),
            ...(result.details ? { details: result.details } : {}),
          };
        } catch (error) {
          return {
            name: check.name,
            status: 'unhealthy' as const,
            message: error instanceof Error ? error.message : 'Health check failed',
          };
        }
      })
    );

    const overallStatus = checks.every(check => check.status === 'healthy')
      ? 'healthy'
      : checks.some(check => check.status === 'unhealthy')
        ? 'unhealthy'
        : 'degraded';

    const response: HealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      uptime: Date.now() - this.startTime.getTime(),
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 503;

    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    });
    res.end(JSON.stringify(response, null, 2));
  }

  private handleRoot(res: http.ServerResponse): void {
    const response = {
      name: 'Foundation TypeScript App',
      version: '1.0.0',
      description: 'A minimal HTTP server with health check',
      timestamp: new Date().toISOString(),
    };

    res.writeHead(200, {
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify(response, null, 2));
  }

  private handleNotFound(res: http.ServerResponse): void {
    const response = {
      error: 'Not Found',
      message: 'The requested resource was not found',
      timestamp: new Date().toISOString(),
    };

    res.writeHead(404, {
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify(response, null, 2));
  }

  private handleServerError(res: http.ServerResponse): void {
    const response = {
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    };

    res.writeHead(500, {
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify(response, null, 2));
  }

  start(): Promise<void> {
    return new Promise(resolve => {
      const port = this.config.get<number>('PORT', 3000);
      const host = this.config.get<string>('HOST', '0.0.0.0');

      this.server.listen(port, host, () => {
        this.logger.info('Server started', {
          port,
          host,
          pid: process.pid,
        });
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise(resolve => {
      this.server.close(() => {
        this.logger.info('Server stopped');
        resolve();
      });
    });
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(
    config.get<boolean>('LOG_STRUCTURED', false),
    config.get<number>('LOG_LEVEL', 1), // INFO level
    'app'
  );

  const server = new HttpServer(logger, config);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully');
    await server.stop();
    process.exit(0);
  });

  try {
    await server.start();
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  void main();
}

export { HttpServer, main };
