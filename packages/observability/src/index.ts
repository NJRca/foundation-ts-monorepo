import { Logger, assertNonNull } from '@foundation/contracts';

import { randomUUID } from 'crypto';

// ALLOW_COMPLEXITY_DELTA: Observability implementation includes multiple
// helpers and classes for tracing/logging. This header marks the file as an
// intended complexity exception for repository policy.

// Prometheus metrics support
// @intent: MetricsCollector
// Purpose: abstract metrics collection for lightweight in-memory or Prometheus backends.
// Constraints: implementations should expose a synchronous snapshot suitable for scraping.
export interface MetricsCollector {
  incrementCounter(name: string, labels?: Record<string, string>): void;
  setGauge(name: string, value: number, labels?: Record<string, string>): void;
  observeHistogram(name: string, value: number, labels?: Record<string, string>): void;
  getMetrics(): string;
}

// Enhanced logging with tracing support
// @intent: LogLevel
// Purpose: severity levels for logging. Keep numeric ordering stable.
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  meta?: Record<string, unknown>;
  service?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  correlationId?: string;
}

interface LogOutput {
  write(entry: LogEntry): void;
}

// Distributed tracing interfaces
export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, any>;
  logs: Array<{ timestamp: number; message: string; level?: string }>;
  status: 'success' | 'error' | 'cancelled';
  baggage: Record<string, string>;
}

export interface Tracer {
  startSpan(operationName: string, parentSpan?: Span): Span;
  finishSpan(span: Span): void;
  extractSpan(context: Record<string, any>): Span | undefined;
  injectSpan(span: Span, context: Record<string, any>): void;
}

// In-memory distributed tracer
// @intent: InMemoryTracer
// Purpose: in-memory span collection for local debugging and tests. Not for production-scale traces.
export class InMemoryTracer implements Tracer {
  private readonly spans: Map<string, Span> = new Map();
  private readonly logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || createLogger(false, LogLevel.INFO, 'Tracer');
  }

  startSpan(operationName: string, parentSpan?: Span): Span {
    const traceId = parentSpan?.traceId || randomUUID();
    const spanId = randomUUID();

    const span: Span = {
      traceId,
      spanId,
      parentSpanId: parentSpan?.spanId,
      operationName,
      startTime: Date.now(),
      tags: {},
      logs: [],
      status: 'success',
      baggage: parentSpan?.baggage || {},
    };

    this.spans.set(spanId, span);

    this.logger.debug('Started span', {
      traceId,
      spanId,
      operationName,
      parentSpanId: parentSpan?.spanId,
    });

    return span;
  }

  finishSpan(span: Span): void {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;

    this.logger.debug('Finished span', {
      traceId: span.traceId,
      spanId: span.spanId,
      operationName: span.operationName,
      duration: span.duration,
      status: span.status,
    });

    // In a real implementation, you'd send this to a tracing backend
    this.exportSpan(span);
  }

  extractSpan(context: Record<string, any>): Span | undefined {
    const spanId = context['span-id'] || context.spanId;
    return spanId ? this.spans.get(spanId) : undefined;
  }

  injectSpan(span: Span, context: Record<string, any>): void {
    context['trace-id'] = span.traceId;
    context['span-id'] = span.spanId;
    context['parent-span-id'] = span.parentSpanId;
  }

  private exportSpan(span: Span): void {
    // Export to tracing backend (e.g., Jaeger, Zipkin)
    this.logger.info('Span completed', {
      trace: {
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId,
        operationName: span.operationName,
        startTime: span.startTime,
        endTime: span.endTime,
        duration: span.duration,
        tags: span.tags,
        logs: span.logs,
        status: span.status,
      },
    });
  }

  getSpan(spanId: string): Span | undefined {
    assertNonNull(spanId, 'spanId');
    return this.spans.get(spanId);
  }

  getAllSpans(): Span[] {
    return Array.from(this.spans.values());
  }

  getTrace(traceId: string): Span[] {
    return Array.from(this.spans.values()).filter(span => span.traceId === traceId);
  }
}

class ConsoleLogOutput implements LogOutput {
  write(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level];
    const meta = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';
    const service = entry.service ? ` [${entry.service}]` : '';
    const requestId = entry.requestId ? ` (${entry.requestId})` : '';

    // eslint-disable-next-line no-console
    console.log(`${timestamp} ${level}${service}${requestId}: ${entry.message}${meta}`);
  }
}

class StructuredLogOutput implements LogOutput {
  write(entry: LogEntry): void {
    const logObject = {
      timestamp: entry.timestamp.toISOString(),
      level: LogLevel[entry.level],
      message: entry.message,
      service: entry.service ?? undefined,
      requestId: entry.requestId ?? undefined,
      ...(entry.meta ?? {}),
    };

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(logObject));
  }
}

// @intent: AppLogger
// Purpose: simple multi-output logger with optional structured output. Designed for app-level logging.
export class AppLogger implements Logger {
  private readonly outputs: LogOutput[];
  private readonly minLevel: LogLevel;
  private readonly service: string | undefined;
  private requestId: string | undefined;

  constructor(
    outputs: LogOutput[] = [new ConsoleLogOutput()],
    minLevel: LogLevel = LogLevel.INFO,
    service?: string
  ) {
    this.outputs = outputs;
    this.minLevel = minLevel;
    this.service = service;
  }

  setRequestId(requestId: string): void {
    this.requestId = requestId;
  }

  clearRequestId(): void {
    this.requestId = undefined;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, meta);
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (level < this.minLevel) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      ...(meta ? { meta } : {}),
      ...(this.service ? { service: this.service } : {}),
      ...(this.requestId ? { requestId: this.requestId } : {}),
    };

    this.outputs.forEach(output => output.write(entry));
  }

  child(service: string): AppLogger {
    return new AppLogger(this.outputs, this.minLevel, service);
  }
}

// Factory function to create logger with common configurations
// @intent: createLogger
// Purpose: factory for AppLogger instances with common defaults.
export function createLogger(
  structured: boolean = false,
  level: LogLevel = LogLevel.INFO,
  service?: string
): Logger {
  const output = structured ? new StructuredLogOutput() : new ConsoleLogOutput();
  return new AppLogger([output], level, service);
}

// Metrics interfaces and basic implementation
export interface Counter {
  inc(value?: number, labels?: Record<string, string>): void;
}

export interface Histogram {
  observe(value: number, labels?: Record<string, string>): void;
}

export interface Gauge {
  set(value: number, labels?: Record<string, string>): void;
  inc(value?: number, labels?: Record<string, string>): void;
  dec(value?: number, labels?: Record<string, string>): void;
}

export interface Metrics {
  counter(name: string, help?: string): Counter;
  histogram(name: string, help?: string, buckets?: number[]): Histogram;
  gauge(name: string, help?: string): Gauge;
}

// Simple in-memory metrics implementation
export class SimpleMetrics implements Metrics {
  private readonly counters = new Map<string, number>();
  private readonly histograms = new Map<string, number[]>();
  private readonly gauges = new Map<string, number>();

  counter(name: string): Counter {
    return {
      inc: (value = 1) => {
        const current = this.counters.get(name) ?? 0;
        this.counters.set(name, current + value);
      },
    };
  }

  histogram(name: string): Histogram {
    return {
      observe: (value: number) => {
        const current = this.histograms.get(name) ?? [];
        current.push(value);
        this.histograms.set(name, current);
      },
    };
  }

  gauge(name: string): Gauge {
    return {
      set: (value: number) => {
        this.gauges.set(name, value);
      },
      inc: (value = 1) => {
        const current = this.gauges.get(name) ?? 0;
        this.gauges.set(name, current + value);
      },
      dec: (value = 1) => {
        const current = this.gauges.get(name) ?? 0;
        this.gauges.set(name, current - value);
      },
    };
  }

  getMetrics(): Record<string, unknown> {
    return {
      counters: Object.fromEntries(this.counters),
      histograms: Object.fromEntries(this.histograms),
      gauges: Object.fromEntries(this.gauges),
    };
  }

  // Export metrics in Prometheus format
  getMetricsString(): string {
    const lines: string[] = [];

    // Export counters
    for (const [name, value] of this.counters.entries()) {
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${value}`);
    }

    // Export gauges
    for (const [name, value] of this.gauges.entries()) {
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    }

    // Export histograms (basic implementation)
    for (const [name, values] of this.histograms.entries()) {
      if (values.length > 0) {
        lines.push(`# TYPE ${name} histogram`);
        const sum = values.reduce((a, b) => a + b, 0);
        const count = values.length;
        lines.push(`${name}_sum ${sum}`);
        lines.push(`${name}_count ${count}`);

        // Basic bucketing
        const buckets = [0.1, 0.5, 1, 2.5, 5, 10];
        for (const bucket of buckets) {
          const count = values.filter(v => v <= bucket).length;
          lines.push(`${name}_bucket{le="${bucket}"} ${count}`);
        }
        lines.push(`${name}_bucket{le="+Inf"} ${count}`);
      }
    }

    return lines.join('\n') + '\n';
  }
}

// Prometheus-compatible metrics collector
export class PrometheusMetricsCollector implements MetricsCollector {
  private readonly metrics: SimpleMetrics;
  private readonly httpRequestsTotal: Counter;
  private readonly httpRequestDuration: Histogram;
  private readonly activeConnections: Gauge;

  constructor() {
    this.metrics = new SimpleMetrics();
    this.httpRequestsTotal = this.metrics.counter('http_requests_total');
    this.httpRequestDuration = this.metrics.histogram('http_request_duration_seconds');
    this.activeConnections = this.metrics.gauge('active_connections');
  }

  incrementCounter(name: string, labels?: Record<string, string>): void {
    const counter = this.metrics.counter(name);
    counter.inc(1, labels);
  }

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const gauge = this.metrics.gauge(name);
    gauge.set(value, labels);
  }

  observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const histogram = this.metrics.histogram(name);
    histogram.observe(value, labels);
  }

  getMetrics(): string {
    return this.metrics.getMetricsString();
  }

  // Convenience methods for common metrics
  recordHttpRequest(method: string, statusCode: number, duration: number): void {
    this.httpRequestsTotal.inc(1, { method, status_code: statusCode.toString() });
    this.httpRequestDuration.observe(duration / 1000); // Convert to seconds
  }

  setActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }
}

// Correlation ID middleware
export interface CorrelationConfig {
  headerName?: string;
  generateId?: () => string;
  skipPaths?: string[];
}

export function correlationMiddleware(config: CorrelationConfig = {}) {
  const {
    headerName = 'x-correlation-id',
    generateId = () => randomUUID(),
    skipPaths = [],
  } = config;

  return (req: any, res: any, next: any) => {
    // Skip middleware for certain paths
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Get or generate correlation ID
    const correlationId = req.headers[headerName] || generateId();

    // Set correlation ID in request and response headers
    req.correlationId = correlationId;
    res.setHeader(headerName, correlationId);

    // Add to trace context if available
    if (req.traceId) {
      req.traceContext = {
        traceId: req.traceId,
        correlationId,
      };
    }

    next();
  };
}

// Metrics middleware for HTTP requests
export function metricsMiddleware(collector: MetricsCollector) {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();

    // Increment active connections
    collector.setGauge('active_connections', 1);

    // Track when response finishes
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const method = req.method;
      const statusCode = res.statusCode;

      // Record HTTP request metrics
      collector.incrementCounter('http_requests_total', {
        method,
        status_code: statusCode.toString(),
        route: req.route?.path || req.path,
      });

      collector.observeHistogram('http_request_duration_seconds', duration / 1000, {
        method,
        status_code: statusCode.toString(),
      });

      // Decrement active connections
      collector.setGauge('active_connections', -1);
    });

    next();
  };
}

// Create default observability setup
export function createObservabilitySetup(serviceName: string) {
  const logger = createLogger(true, LogLevel.INFO, serviceName);
  const metricsCollector = new PrometheusMetricsCollector();
  const tracer = new InMemoryTracer();

  return {
    logger,
    metricsCollector,
    tracer,
    correlationMiddleware: correlationMiddleware(),
    metricsMiddleware: metricsMiddleware(metricsCollector),
  };
}

export { ConsoleLogOutput, StructuredLogOutput };

// Export new middleware functionality
export {
  ObservabilityMiddleware,
  createCompleteObservabilitySetup,
  createObservabilityMiddleware,
} from './middleware';

export type { ObservabilityConfig, ObservableRequest } from './middleware';
