import { Config, Logger, assertNonNull } from '@foundation/contracts';
import {
  LogLevel,
  MetricsCollector,
  PrometheusMetricsCollector,
  Span,
  Tracer,
  createLogger,
} from './index';

import { createTracingService } from './tracing';
// ALLOW_COMPLEXITY_DELTA: Observability middleware contains plumbing and
// cross-cutting concerns. Marking as allowed for complexity policy.
import { randomUUID } from 'crypto';

/**
 * Configuration interface for observability middleware
 */
export interface ObservabilityConfig {
  serviceName: string;
  logLevel: LogLevel;
  enableMetrics: boolean;
  enableTracing: boolean;
  enableStructuredLogs: boolean;
  enableCorrelationId: boolean;
  correlationHeader: string;
  skipHealthChecks: boolean;
  skipPaths: string[];
  metricsPath: string;
  healthPath: string;
}

/**
 * Express middleware context enhanced with observability
 */
export interface ObservableRequest {
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  span?: Span;
  logger?: Logger;
  startTime?: number;
  method?: string;
  path?: string;
  headers?: Record<string, string | undefined>;
  ip?: string;
  connection?: { remoteAddress?: string };
  route?: { path?: string };
}

/**
 * Enhanced observability middleware that integrates with centralized config
 */
export class ObservabilityMiddleware {
  private readonly config: ObservabilityConfig;
  private readonly logger: Logger;
  private readonly metrics?: MetricsCollector;
  private readonly tracer?: Tracer;

  constructor(configManager: Config) {
    this.config = this.buildConfig(configManager);
    this.logger = createLogger(
      this.config.enableStructuredLogs,
      this.config.logLevel,
      this.config.serviceName
    );

    if (this.config.enableMetrics) {
      this.metrics = new PrometheusMetricsCollector();
    }

    if (this.config.enableTracing) {
      const tracingService = createTracingService(this.config.enableTracing, this.logger);
      this.tracer = tracingService.getTracer();
    }

    this.logger.info('Observability middleware initialized', {
      serviceName: this.config.serviceName,
      enableMetrics: this.config.enableMetrics,
      enableTracing: this.config.enableTracing,
      enableStructuredLogs: this.config.enableStructuredLogs,
    });
  }

  private buildConfig(configManager: Config): ObservabilityConfig {
    return {
      serviceName: configManager.get('SERVICE_NAME', 'unknown-service'),
      logLevel: this.parseLogLevel(configManager.get('LOG_LEVEL', 'info')),
      enableMetrics: configManager.get('ENABLE_METRICS', true),
      enableTracing: configManager.get('ENABLE_TRACING', false),
      enableStructuredLogs: configManager.get('ENABLE_STRUCTURED_LOGS', true),
      enableCorrelationId: configManager.get('ENABLE_CORRELATION_ID', true),
      correlationHeader: configManager.get('CORRELATION_HEADER', 'x-correlation-id'),
      skipHealthChecks: configManager.get('SKIP_HEALTH_CHECK_LOGS', true),
      skipPaths: configManager.get('SKIP_LOG_PATHS', '/health,/metrics').split(','),
      metricsPath: configManager.get('METRICS_PATH', '/metrics'),
      healthPath: configManager.get('HEALTH_PATH', '/health'),
    };
  }

  private parseLogLevel(level: string): LogLevel {
    const levelMap: Record<string, LogLevel> = {
      debug: LogLevel.DEBUG,
      info: LogLevel.INFO,
      warn: LogLevel.WARN,
      error: LogLevel.ERROR,
    };
    return levelMap[level.toLowerCase()] ?? LogLevel.INFO;
  }

  /**
   * Main observability middleware
   */
  middleware() {
    type Req = ObservableRequest & {
      method?: string;
      path?: string;
      headers?: Record<string, string | undefined>;
      ip?: string;
      connection?: { remoteAddress?: string };
      route?: { path?: string };
    };

    type Res = {
      setHeader(name: string, value: string): void;
      on(event: 'finish' | 'error', cb: (...args: unknown[]) => void): void;
      status(code: number): { send(body: unknown): void; json(body: unknown): void };
      send(body: unknown): void;
      getHeader(name: string): unknown;
    };

    type Next = (...args: unknown[]) => void;

    return (req: Req, res: Res, next: Next) => {
      assertNonNull(req, 'req');
      assertNonNull(res, 'res');
      const observableReq = req as ObservableRequest;
      const startTime = Date.now();
      observableReq.startTime = startTime;

      // Skip certain paths
      if (this.shouldSkipPath(req.path ?? '')) {
        return next();
      }

      // Add correlation ID
      if (this.config.enableCorrelationId) {
        this.addCorrelationId(req, res);
      }

      // Start tracing span
      if (this.config.enableTracing && this.tracer) {
        this.startTracing(observableReq);
      }

      // Create request-scoped logger
      observableReq.logger = this.createRequestLogger(observableReq);

      // Log request start
      observableReq.logger.info('Request started', {
        method: req.method ?? 'unknown',
        path: req.path ?? 'unknown',
        userAgent: req.headers?.['user-agent'],
        ip: req.ip || req.connection?.remoteAddress,
      });

      // Track active connections
      if (this.metrics) {
        this.metrics.setGauge('active_connections', 1);
      }

      // Handle response completion
      res.on('finish', () => {
        this.handleRequestCompletion(observableReq, req, res, startTime);
      });

      // Handle errors
      res.on('error', (error?: unknown) => {
        this.handleRequestError(
          observableReq,
          error instanceof Error ? error : new Error(String(error))
        );
      });

      next();
    };
  }

  /**
   * Error handling middleware
   */
  errorMiddleware() {
    type Req = ObservableRequest & { method?: string; path?: string };
    type Res = { status(code: number): { send(body: unknown): void } };
    type Next = (...args: unknown[]) => void;

    return (error: Error, req: Req, res: Res, next: Next) => {
      const observableReq = req as ObservableRequest;

      // Log error with context
      if (observableReq.logger) {
        observableReq.logger.error('Request error', {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
          method: req.method ?? 'unknown',
          path: req.path ?? 'unknown',
        });
      }

      // Update span with error
      if (observableReq.span) {
        observableReq.span.status = 'error';
        observableReq.span.tags.error = true;
        observableReq.span.tags.errorMessage = error.message;
        observableReq.span.logs.push({
          timestamp: Date.now(),
          message: error.message,
          level: 'error',
        });
      }

      // Record error metrics
      if (this.metrics) {
        this.metrics.incrementCounter('http_errors_total', {
          method: req.method ?? 'unknown',
          error_type: error.name,
        });
      }

      next(error);
    };
  }

  /**
   * Metrics endpoint middleware
   */
  metricsEndpoint() {
    return (
      req: { path?: string },
      res: {
        setHeader(name: string, value: string): void;
        send(body: unknown): void;
        status(code: number): { send(body: unknown): void };
      }
    ) => {
      if (req.path === this.config.metricsPath && this.metrics) {
        res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.send(this.metrics.getMetrics());
      } else {
        res.status(404).send('Not Found');
      }
    };
  }

  /**
   * Health check endpoint with observability
   */
  healthEndpoint() {
    return (
      req: { path?: string },
      res: {
        status(code: number): { json(body: unknown): void; send(body: unknown): void };
        send(body: unknown): void;
      }
    ) => {
      if (req.path === this.config.healthPath) {
        const health = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          service: this.config.serviceName,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          observability: {
            metrics: this.config.enableMetrics,
            tracing: this.config.enableTracing,
            structuredLogs: this.config.enableStructuredLogs,
          },
        };

        res.status(200).json(health);
      } else {
        res.status(404).send('Not Found');
      }
    };
  }

  private shouldSkipPath(path: string): boolean {
    if (this.config.skipHealthChecks && path === this.config.healthPath) {
      return true;
    }
    return this.config.skipPaths.some(skipPath => path.startsWith(skipPath));
  }

  private addCorrelationId(
    req: { headers?: Record<string, string | undefined>; correlationId?: string },
    res: { setHeader(name: string, value: string): void }
  ): void {
    const correlationId =
      (req.headers && req.headers[this.config.correlationHeader]) || randomUUID();
    req.correlationId = correlationId as string;
    res.setHeader(this.config.correlationHeader, correlationId as string);
  }

  private startTracing(req: ObservableRequest): void {
    if (!this.tracer) return;

    const operationName = `${req.method || 'unknown'} ${req.path || 'unknown'}`;
    const span = this.tracer.startSpan(operationName);

    req.span = span;
    req.traceId = span.traceId;
    req.spanId = span.spanId;

    // Add request tags
    span.tags = {
      'http.method': req.method,
      'http.path': req.path,
      'service.name': this.config.serviceName,
      ...(req.correlationId && { correlationId: req.correlationId }),
    };
  }

  private createRequestLogger(req: ObservableRequest): Logger {
    // Use the base logger for request context
    const contextLogger = this.logger;

    // Add request context to all logs
    const originalInfo = contextLogger.info.bind(contextLogger);
    const originalError = contextLogger.error.bind(contextLogger);
    const originalWarn = contextLogger.warn.bind(contextLogger);
    const originalDebug = contextLogger.debug.bind(contextLogger);

    contextLogger.info = (message: string, meta?: Record<string, unknown>) => {
      originalInfo(message, { ...meta, ...this.getRequestContext(req) });
    };

    contextLogger.error = (message: string, meta?: Record<string, unknown>) => {
      originalError(message, { ...meta, ...this.getRequestContext(req) });
    };

    contextLogger.warn = (message: string, meta?: Record<string, unknown>) => {
      originalWarn(message, { ...meta, ...this.getRequestContext(req) });
    };

    contextLogger.debug = (message: string, meta?: Record<string, unknown>) => {
      originalDebug(message, { ...meta, ...this.getRequestContext(req) });
    };

    return contextLogger;
  }

  private getRequestContext(req: ObservableRequest): Record<string, unknown> {
    const context: Record<string, unknown> = {};

    if (req.correlationId) context.correlationId = req.correlationId;
    if (req.traceId) context.traceId = req.traceId;
    if (req.spanId) context.spanId = req.spanId;

    return context;
  }

  private handleRequestCompletion(
    observableReq: ObservableRequest,
    req: { method?: string; path?: string; route?: { path?: string } },
    res: { statusCode?: number; getHeader(name: string): unknown },
    startTime: number
  ): void {
    const duration = Date.now() - startTime;
    const statusCode = typeof res.statusCode === 'number' ? res.statusCode : 0;

    // Log request completion
    if (observableReq.logger) {
      let logLevel: 'info' | 'warn' | 'error' = 'info';
      if (statusCode >= 400) {
        logLevel = 'error';
      } else if (statusCode >= 300) {
        logLevel = 'warn';
      }

      observableReq.logger[logLevel]('Request completed', {
        method: req.method ?? 'unknown',
        path: req.path ?? 'unknown',
        statusCode,
        duration,
        responseSize: res.getHeader('content-length') || 0,
      });
    }

    // Finish tracing span
    if (observableReq.span && this.tracer) {
      observableReq.span.tags['http.status_code'] = statusCode;
      observableReq.span.tags['http.duration_ms'] = duration;
      observableReq.span.status = statusCode >= 400 ? 'error' : 'success';
      this.tracer.finishSpan(observableReq.span);
    }

    // Record metrics
    if (this.metrics) {
      this.metrics.incrementCounter('http_requests_total', {
        method: req.method ?? 'unknown',
        status_code: statusCode.toString(),
        route: req.route?.path || req.path || 'unknown',
      });

      this.metrics.observeHistogram('http_request_duration_seconds', duration / 1000, {
        method: req.method ?? 'unknown',
        status_code: statusCode.toString(),
      });

      this.metrics.setGauge('active_connections', -1);
    }
  }

  private handleRequestError(req: ObservableRequest, error: Error): void {
    if (req.logger) {
      req.logger.error('Request stream error', {
        error: {
          name: error.name,
          message: error.message,
        },
      });
    }

    if (this.metrics) {
      this.metrics.incrementCounter('http_stream_errors_total', {
        error_type: error.name,
      });
    }
  }

  /**
   * Get logger instance for external use
   */
  getLogger(): Logger {
    return this.logger;
  }

  /**
   * Get metrics collector for external use
   */
  getMetrics(): MetricsCollector | undefined {
    return this.metrics;
  }

  /**
   * Get tracer for external use
   */
  getTracer(): Tracer | undefined {
    return this.tracer;
  }

  /**
   * Get configuration
   */
  getConfig(): ObservabilityConfig {
    return { ...this.config };
  }
}

/**
 * Factory function to create observability middleware from config
 */
export function createObservabilityMiddleware(configManager: Config): ObservabilityMiddleware {
  return new ObservabilityMiddleware(configManager);
}

/**
 * Create a complete observability setup with all middleware
 */
export function createCompleteObservabilitySetup(configManager: Config) {
  const middleware = new ObservabilityMiddleware(configManager);

  return {
    middleware: middleware.middleware(),
    errorMiddleware: middleware.errorMiddleware(),
    metricsEndpoint: middleware.metricsEndpoint(),
    healthEndpoint: middleware.healthEndpoint(),
    logger: middleware.getLogger(),
    metrics: middleware.getMetrics(),
    tracer: middleware.getTracer(),
    config: middleware.getConfig(),
  };
}
