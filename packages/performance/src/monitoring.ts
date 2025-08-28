import { NextFunction, Request, Response } from 'express';

import { assertNonNull } from '@foundation/contracts';
// @intent: PerformanceMonitoringMiddleware
// Purpose: collect in-process request timing and basic system metrics for observability.
// Constraints: lightweight, in-memory; not a replacement for dedicated APM. All exported
// interfaces are read-only snapshots to avoid leaking internal mutable state.
import { performance } from 'perf_hooks';

// ALLOW_COMPLEXITY_DELTA: Performance monitoring contains detailed timing
// and metrics collection code; considered an allowed complexity exception.

// Performance metrics collection interface
export interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  totalResponseTime: number;
  errorCount: number;
  errorRate: number;
  requestsPerSecond: number;
  memoryCurrent: number;
  memoryPeak: number;
  cpuUsage: number;
  timestamp: number;
}

// Endpoint-specific metrics
export interface EndpointMetrics {
  path: string;
  method: string;
  metrics: PerformanceMetrics;
  statusCodes: Record<string, number>;
  lastRequests: RequestTiming[];
}

// Individual request timing
export interface RequestTiming {
  timestamp: number;
  duration: number;
  statusCode: number;
  path: string;
  method: string;
  memoryUsage: number;
  correlationId?: string;
}

// Performance monitoring configuration
export interface PerformanceConfig {
  enabled: boolean;
  collectCpuMetrics: boolean;
  collectMemoryMetrics: boolean;
  maxRequestHistory: number;
  metricsWindowMs: number;
  enableSlowQueryDetection: boolean;
  slowQueryThresholdMs: number;
}

// Performance monitoring middleware
export class PerformanceMonitoringMiddleware {
  private readonly metrics: Map<string, EndpointMetrics> = new Map();
  private globalMetrics: PerformanceMetrics;
  private requestHistory: RequestTiming[] = [];
  private readonly config: PerformanceConfig;
  private readonly startTime: number;

  constructor(config: Partial<PerformanceConfig> = {}) {
    assertNonNull(config, 'config');
    this.config = {
      enabled: true,
      collectCpuMetrics: true,
      collectMemoryMetrics: true,
      maxRequestHistory: 1000,
      metricsWindowMs: 60000, // 1 minute
      enableSlowQueryDetection: true,
      slowQueryThresholdMs: 1000,
      ...config,
    };

    this.startTime = Date.now();
    this.globalMetrics = this.createEmptyMetrics();

    // Clean up old metrics periodically
    setInterval(() => this.cleanupOldMetrics(), this.config.metricsWindowMs);
  }

  // Main middleware function
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enabled) {
        return next();
      }

      const self = this;
      const startTime = performance.now();
      const startMemory = this.config.collectMemoryMetrics ? process.memoryUsage().heapUsed : 0;
      const correlationId = (req.headers['x-correlation-id'] as string) || 'unknown';
      assertNonNull(req, 'req');
      const routePath = (req as any)?.route?.path || req.path;

      // Override res.end to capture response time. Use captured `self` so we don't mix up
      // the express Response `this` with the middleware class instance.
      const originalEnd = res.end;
      res.end = function (this: Response, chunk?: any, encoding?: any, cb?: any) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        const endMemory = self.config.collectMemoryMetrics ? process.memoryUsage().heapUsed : 0;

        // Record timing
        const timing: RequestTiming = {
          timestamp: Date.now(),
          duration,
          statusCode: this.statusCode,
          path: routePath,
          method: req.method,
          memoryUsage: endMemory - startMemory,
          correlationId,
        };

        // Record via the middleware instance
        self.recordRequest(timing);

        // Check for slow queries
        if (self.config.enableSlowQueryDetection && duration > self.config.slowQueryThresholdMs) {
          console.warn(
            `🐌 Slow request detected: ${req.method} ${routePath} took ${duration.toFixed(2)}ms`,
            {
              correlationId,
              duration,
              path: req.path,
              method: req.method,
            }
          );
        }

        return originalEnd.call(this, chunk, encoding, cb);
      };

      next();
    };
  }

  // Record request metrics
  private recordRequest(timing: RequestTiming): void {
    const key = `${timing.method}:${timing.path}`;

    // Update endpoint-specific metrics
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        path: timing.path,
        method: timing.method,
        metrics: this.createEmptyMetrics(),
        statusCodes: {},
        lastRequests: [],
      });
    }

    const endpointMetrics = this.metrics.get(key)!;
    this.updateMetrics(endpointMetrics.metrics, timing);

    // Update status code counts
    const statusKey = timing.statusCode.toString();
    endpointMetrics.statusCodes[statusKey] = (endpointMetrics.statusCodes[statusKey] || 0) + 1;

    // Add to recent requests (keeping only the latest)
    endpointMetrics.lastRequests.push(timing);
    if (endpointMetrics.lastRequests.length > 100) {
      endpointMetrics.lastRequests.shift();
    }

    // Update global metrics
    this.updateMetrics(this.globalMetrics, timing);

    // Add to global request history
    this.requestHistory.push(timing);
    if (this.requestHistory.length > this.config.maxRequestHistory) {
      this.requestHistory.shift();
    }
  }

  // Update metrics with new timing
  private updateMetrics(metrics: PerformanceMetrics, timing: RequestTiming): void {
    metrics.requestCount++;
    metrics.totalResponseTime += timing.duration;
    metrics.averageResponseTime = metrics.totalResponseTime / metrics.requestCount;

    if (metrics.minResponseTime === 0 || timing.duration < metrics.minResponseTime) {
      metrics.minResponseTime = timing.duration;
    }

    if (timing.duration > metrics.maxResponseTime) {
      metrics.maxResponseTime = timing.duration;
    }

    if (timing.statusCode >= 400) {
      metrics.errorCount++;
    }

    metrics.errorRate = (metrics.errorCount / metrics.requestCount) * 100;

    if (this.config.collectMemoryMetrics) {
      const currentMemory = process.memoryUsage().heapUsed;
      metrics.memoryCurrent = currentMemory;
      if (currentMemory > metrics.memoryPeak) {
        metrics.memoryPeak = currentMemory;
      }
    }

    metrics.timestamp = Date.now();

    // Calculate requests per second over the last minute
    const oneMinuteAgo = Date.now() - this.config.metricsWindowMs;
    const recentRequests = this.requestHistory.filter(r => r.timestamp > oneMinuteAgo);
    metrics.requestsPerSecond = recentRequests.length / (this.config.metricsWindowMs / 1000);
  }

  // Create empty metrics object
  private createEmptyMetrics(): PerformanceMetrics {
    return {
      requestCount: 0,
      averageResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      totalResponseTime: 0,
      errorCount: 0,
      errorRate: 0,
      requestsPerSecond: 0,
      memoryCurrent: 0,
      memoryPeak: 0,
      cpuUsage: 0,
      timestamp: Date.now(),
    };
  }

  // Clean up old metrics data
  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.config.metricsWindowMs;
    this.requestHistory = this.requestHistory.filter(r => r.timestamp > cutoff);

    // Clean up endpoint metrics history
    for (const endpointMetrics of this.metrics.values()) {
      endpointMetrics.lastRequests = endpointMetrics.lastRequests.filter(r => r.timestamp > cutoff);
    }
  }

  // Get global performance metrics
  getGlobalMetrics(): PerformanceMetrics {
    if (this.config.collectCpuMetrics) {
      this.globalMetrics.cpuUsage = process.cpuUsage().user / 1000000; // Convert to seconds
    }

    return { ...this.globalMetrics };
  }

  // Get endpoint-specific metrics
  getEndpointMetrics(): EndpointMetrics[] {
    return Array.from(this.metrics.values()).map(endpoint => ({
      ...endpoint,
      metrics: { ...endpoint.metrics },
    }));
  }

  // Get slow requests
  getSlowRequests(thresholdMs?: number): RequestTiming[] {
    const threshold = thresholdMs || this.config.slowQueryThresholdMs;
    return this.requestHistory
      .filter(r => r.duration > threshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 50); // Top 50 slowest
  }

  // Get error requests
  getErrorRequests(): RequestTiming[] {
    return this.requestHistory
      .filter(r => r.statusCode >= 400)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 100); // Latest 100 errors
  }

  // Generate Prometheus metrics
  getPrometheusMetrics(): string {
    const metrics: string[] = [];
    const globalMetrics = this.getGlobalMetrics();

    // Global metrics
    metrics.push('# HELP http_requests_total Total number of HTTP requests');
    metrics.push('# TYPE http_requests_total counter');
    metrics.push(`http_requests_total ${globalMetrics.requestCount}`);

    metrics.push('# HELP http_request_duration_ms Average HTTP request duration in milliseconds');
    metrics.push('# TYPE http_request_duration_ms gauge');
    metrics.push(
      `http_request_duration_ms{type="average"} ${globalMetrics.averageResponseTime.toFixed(2)}`
    );
    metrics.push(
      `http_request_duration_ms{type="min"} ${globalMetrics.minResponseTime.toFixed(2)}`
    );
    metrics.push(
      `http_request_duration_ms{type="max"} ${globalMetrics.maxResponseTime.toFixed(2)}`
    );

    metrics.push('# HELP http_requests_per_second Current requests per second');
    metrics.push('# TYPE http_requests_per_second gauge');
    metrics.push(`http_requests_per_second ${globalMetrics.requestsPerSecond.toFixed(2)}`);

    metrics.push('# HELP http_error_rate Error rate percentage');
    metrics.push('# TYPE http_error_rate gauge');
    metrics.push(`http_error_rate ${globalMetrics.errorRate.toFixed(2)}`);

    if (this.config.collectMemoryMetrics) {
      metrics.push('# HELP process_memory_usage_bytes Process memory usage in bytes');
      metrics.push('# TYPE process_memory_usage_bytes gauge');
      metrics.push(`process_memory_usage_bytes{type="current"} ${globalMetrics.memoryCurrent}`);
      metrics.push(`process_memory_usage_bytes{type="peak"} ${globalMetrics.memoryPeak}`);
    }

    // Endpoint-specific metrics
    for (const endpoint of this.getEndpointMetrics()) {
      const labels = `method="${endpoint.method}",path="${endpoint.path}"`;

      metrics.push(`http_endpoint_requests_total{${labels}} ${endpoint.metrics.requestCount}`);
      metrics.push(
        `http_endpoint_duration_ms{${labels}} ${endpoint.metrics.averageResponseTime.toFixed(2)}`
      );
      metrics.push(`http_endpoint_error_rate{${labels}} ${endpoint.metrics.errorRate.toFixed(2)}`);

      // Status code distribution
      for (const [statusCode, count] of Object.entries(endpoint.statusCodes)) {
        metrics.push(`http_endpoint_status_codes{${labels},status="${statusCode}"} ${count}`);
      }
    }

    return metrics.join('\n') + '\n';
  }

  // Get performance dashboard data
  getDashboardData(): any {
    return {
      global: this.getGlobalMetrics(),
      endpoints: this.getEndpointMetrics(),
      slowRequests: this.getSlowRequests(),
      errorRequests: this.getErrorRequests(),
      systemInfo: {
        uptime: Date.now() - this.startTime,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      },
      timestamp: Date.now(),
    };
  }

  // Reset all metrics
  reset(): void {
    this.metrics.clear();
    this.requestHistory = [];
    this.globalMetrics = this.createEmptyMetrics();
  }
}

// Express middleware factory
export function createPerformanceMiddleware(config?: Partial<PerformanceConfig>) {
  return new PerformanceMonitoringMiddleware(config);
}

// Default export
export default PerformanceMonitoringMiddleware;
