// ALLOW_COMPLEXITY_DELTA: Performance module aggregates monitoring helpers; large but intentionally structured.
// Future: refactor into smaller modules.

import { Logger } from '@foundation/contracts';
import { createLogger } from '@foundation/observability';

// Cache interfaces
export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  hitCount: number;
  lastAccessed: number;
}

export interface CacheStrategy {
  shouldEvict(entry: CacheEntry<any>, now: number): boolean;
  onAccess(entry: CacheEntry<any>): void;
  onSet(entry: CacheEntry<any>): void;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
  evictions: number;
  totalOperations: number;
}

// In-memory cache with configurable strategies
export class MemoryCache<T> {
  private readonly cache = new Map<string, CacheEntry<T>>();
  private readonly logger: Logger;
  private readonly maxSize: number;
  private readonly defaultTtl: number;
  private readonly strategy: CacheStrategy;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalOperations: 0,
  };

  constructor(
    config: {
      maxSize?: number;
      defaultTtl?: number; // seconds
      strategy?: CacheStrategy;
      logger?: Logger;
    } = {}
  ) {
    this.maxSize = config.maxSize || 1000;
    this.defaultTtl = (config.defaultTtl || 3600) * 1000; // Convert to ms
    this.strategy = config.strategy || new LRUStrategy();
    this.logger = config.logger || createLogger(false, 0, 'MemoryCache');
  }

  get(key: string): T | undefined {
    this.stats.totalOperations++;

    const entry = this.cache.get(key);
    const now = Date.now();

    if (!entry) {
      this.stats.misses++;
      this.logger.debug('Cache miss', { key });
      return undefined;
    }

    // Check if expired
    if (now > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      this.logger.debug('Cache miss (expired)', { key, age: now - entry.timestamp });
      return undefined;
    }

    // Update access statistics
    entry.hitCount++;
    entry.lastAccessed = now;
    this.strategy.onAccess(entry);

    this.stats.hits++;
    this.logger.debug('Cache hit', { key, hitCount: entry.hitCount });

    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const entryTtl = ttl ? ttl * 1000 : this.defaultTtl;

    const entry: CacheEntry<T> = {
      value,
      timestamp: now,
      ttl: entryTtl,
      hitCount: 0,
      lastAccessed: now,
    };

    // Check if we need to evict
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictEntries(1);
    }

    this.cache.set(key, entry);
    this.strategy.onSet(entry);

    this.logger.debug('Cache set', { key, ttl: ttl || this.defaultTtl / 1000 });
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.logger.debug('Cache delete', { key });
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalOperations: 0,
    };
    this.logger.debug('Cache cleared');
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): CacheStats {
    const totalOps = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: totalOps > 0 ? this.stats.hits / totalOps : 0,
      size: this.cache.size,
      maxSize: this.maxSize,
      totalOperations: totalOps,
    };
  }

  private evictEntries(count: number): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());

    // Sort by eviction criteria
    entries.sort((a, b) => {
      if (this.strategy.shouldEvict(a[1], now) && !this.strategy.shouldEvict(b[1], now)) {
        return -1;
      }
      if (!this.strategy.shouldEvict(a[1], now) && this.strategy.shouldEvict(b[1], now)) {
        return 1;
      }
      return a[1].lastAccessed - b[1].lastAccessed;
    });

    let evicted = 0;
    for (const [key] of entries) {
      if (evicted >= count) break;
      this.cache.delete(key);
      evicted++;
      this.stats.evictions++;
    }

    this.logger.debug('Evicted entries', { count: evicted });
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      this.logger.debug('Cleaned up expired entries', { count: cleaned });
    }
  }

  // Get all keys (for debugging)
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// Cache strategies
export class LRUStrategy implements CacheStrategy {
  shouldEvict(entry: CacheEntry<any>, now: number): boolean {
    return now > entry.timestamp + entry.ttl;
  }

  onAccess(entry: CacheEntry<any>): void {
    entry.lastAccessed = Date.now();
  }

  onSet(entry: CacheEntry<any>): void {
    // Nothing special for LRU
  }
}

export class LFUStrategy implements CacheStrategy {
  shouldEvict(entry: CacheEntry<any>, now: number): boolean {
    return now > entry.timestamp + entry.ttl;
  }

  onAccess(entry: CacheEntry<any>): void {
    entry.hitCount++;
    entry.lastAccessed = Date.now();
  }

  onSet(entry: CacheEntry<any>): void {
    // Nothing special for LFU
  }
}

// Memoization decorator
export function memoize<T extends (...args: any[]) => any>(
  ttl: number = 3600,
  maxSize: number = 100
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const cache = new MemoryCache<any>({ maxSize, defaultTtl: ttl });

    descriptor.value = function (...args: any[]) {
      const key = `${propertyKey}:${JSON.stringify(args)}`;

      let result = cache.get(key);
      if (result !== undefined) {
        return result;
      }

      result = originalMethod.apply(this, args);

      // Handle promises
      if (result && typeof result.then === 'function') {
        return result.then((resolvedValue: any) => {
          cache.set(key, resolvedValue, ttl);
          return resolvedValue;
        });
      }

      cache.set(key, result, ttl);
      return result;
    };

    return descriptor;
  };
}

// Circuit breaker for performance protection
export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number; // ms
  monitoringPeriod: number; // ms
  logger?: Logger;
}

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private lastFailureTime = 0;
  private readonly config: CircuitBreakerConfig;
  private readonly logger: Logger;
  private readonly metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    rejectedRequests: 0,
  };

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
    this.logger = config.logger || createLogger(false, 0, 'CircuitBreaker');
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.metrics.totalRequests++;

    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime < this.config.resetTimeout) {
        this.metrics.rejectedRequests++;
        throw new Error('Circuit breaker is OPEN');
      } else {
        this.state = CircuitState.HALF_OPEN;
        this.logger.info('Circuit breaker transitioning to HALF_OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.metrics.successfulRequests++;
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.logger.info('Circuit breaker CLOSED after successful request');
    }
  }

  private onFailure(): void {
    this.metrics.failedRequests++;
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.logger.warn('Circuit breaker OPENED', {
        failures: this.failures,
        threshold: this.config.failureThreshold,
      });
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics() {
    return { ...this.metrics };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.lastFailureTime = 0;
    this.logger.info('Circuit breaker manually reset');
  }
}

// Rate limiter for performance protection
export interface RateLimiterConfig {
  windowSize: number; // ms
  maxRequests: number;
  logger?: Logger;
}

export class RateLimiter {
  private readonly requests = new Map<string, number[]>();
  private readonly config: RateLimiterConfig;
  private readonly logger: Logger;

  constructor(config: RateLimiterConfig) {
    this.config = config;
    this.logger = config.logger || createLogger(false, 0, 'RateLimiter');
  }

  async isAllowed(identifier: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - this.config.windowSize;

    // Get or create request history for this identifier
    let requestTimes = this.requests.get(identifier) || [];

    // Remove old requests outside the window
    requestTimes = requestTimes.filter(time => time > windowStart);

    // Check if we're at the limit
    if (requestTimes.length >= this.config.maxRequests) {
      this.logger.debug('Rate limit exceeded', {
        identifier,
        requests: requestTimes.length,
        maxRequests: this.config.maxRequests,
      });
      return false;
    }

    // Add current request
    requestTimes.push(now);
    this.requests.set(identifier, requestTimes);

    return true;
  }

  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowSize;
    let cleaned = 0;

    Array.from(this.requests.entries()).forEach(([identifier, requestTimes]) => {
      const validRequests = requestTimes.filter(time => time > windowStart);

      if (validRequests.length === 0) {
        this.requests.delete(identifier);
        cleaned++;
      } else {
        this.requests.set(identifier, validRequests);
      }
    });

    if (cleaned > 0) {
      this.logger.debug('Cleaned up old rate limit entries', { count: cleaned });
    }
  }

  getUsage(identifier: string): { requests: number; maxRequests: number; resetTime: number } {
    const now = Date.now();
    const windowStart = now - this.config.windowSize;
    const requestTimes = this.requests.get(identifier) || [];
    const validRequests = requestTimes.filter(time => time > windowStart);

    return {
      requests: validRequests.length,
      maxRequests: this.config.maxRequests,
      resetTime: windowStart + this.config.windowSize,
    };
  }
}

// Performance monitoring
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

export class PerformanceMonitor {
  private readonly logger: Logger;
  private readonly metrics: PerformanceMetric[] = [];
  private readonly activeTimers = new Map<string, number>();

  constructor(logger?: Logger) {
    this.logger = logger || createLogger(false, 0, 'PerformanceMonitor');
  }

  startTimer(name: string): void {
    this.activeTimers.set(name, Date.now());
  }

  endTimer(name: string, tags?: Record<string, string>): number {
    const startTime = this.activeTimers.get(name);
    if (!startTime) {
      this.logger.warn('Timer not found', { name });
      return 0;
    }

    const duration = Date.now() - startTime;
    this.activeTimers.delete(name);

    this.recordMetric({
      name: `${name}_duration`,
      value: duration,
      unit: 'ms',
      timestamp: new Date(),
      tags,
    });

    return duration;
  }

  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    this.logger.debug('Performance metric recorded', {
      name: metric.name,
      value: metric.value,
      unit: metric.unit,
      timestamp: metric.timestamp.toISOString(),
      tags: metric.tags,
    });

    // Keep only recent metrics to prevent memory leaks
    if (this.metrics.length > 10000) {
      this.metrics.splice(0, 1000);
    }
  }

  getMetrics(filter?: { name?: string; since?: Date }): PerformanceMetric[] {
    let filtered = this.metrics;

    if (filter?.name) {
      filtered = filtered.filter(m => m.name.includes(filter.name!));
    }

    if (filter?.since) {
      filtered = filtered.filter(m => m.timestamp >= filter.since!);
    }

    return [...filtered];
  }

  getAverageMetric(name: string, since?: Date): number {
    const filtered = this.getMetrics({ name, since });
    if (filtered.length === 0) return 0;

    const sum = filtered.reduce((acc, metric) => acc + metric.value, 0);
    return sum / filtered.length;
  }

  // Decorator for automatic performance monitoring
  monitor(name?: string) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      const metricName = name || `${target.constructor.name}.${propertyKey}`;
      const originalMethod = descriptor.value;

      descriptor.value = function (...args: any[]) {
        const monitor = (this as any).performanceMonitor || new PerformanceMonitor();
        monitor.startTimer(metricName);

        try {
          const result = originalMethod.apply(this, args);

          if (result && typeof result.then === 'function') {
            return result.finally(() => {
              monitor.endTimer(metricName);
            });
          }

          monitor.endTimer(metricName);
          return result;
        } catch (error) {
          monitor.endTimer(metricName, { status: 'error' });
          throw error;
        }
      };

      return descriptor;
    };
  }
}

// Memory usage monitoring
export class MemoryMonitor {
  private readonly logger: Logger;
  private readonly warningThreshold: number;
  private readonly criticalThreshold: number;

  constructor(
    config: {
      warningThreshold?: number; // percentage
      criticalThreshold?: number; // percentage
      logger?: Logger;
    } = {}
  ) {
    this.warningThreshold = config.warningThreshold || 80;
    this.criticalThreshold = config.criticalThreshold || 90;
    this.logger = config.logger || createLogger(false, 0, 'MemoryMonitor');
  }

  getMemoryUsage(): {
    used: number;
    total: number;
    percentage: number;
    details: NodeJS.MemoryUsage;
  } {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal;
    const usedMemory = memUsage.heapUsed;
    const percentage = (usedMemory / totalMemory) * 100;

    return {
      used: usedMemory,
      total: totalMemory,
      percentage,
      details: memUsage,
    };
  }

  checkMemoryUsage(): void {
    const usage = this.getMemoryUsage();

    if (usage.percentage >= this.criticalThreshold) {
      this.logger.error('Critical memory usage detected', {
        percentage: usage.percentage,
        used: usage.used,
        total: usage.total,
        threshold: this.criticalThreshold,
      });
    } else if (usage.percentage >= this.warningThreshold) {
      this.logger.warn('High memory usage detected', {
        percentage: usage.percentage,
        used: usage.used,
        total: usage.total,
        threshold: this.warningThreshold,
      });
    }
  }

  startMonitoring(intervalMs: number = 30000): NodeJS.Timeout {
    return setInterval(() => {
      this.checkMemoryUsage();
    }, intervalMs);
  }
}

// Connection pooling utility
export class ConnectionPool<T> {
  private readonly pool: T[] = [];
  private readonly inUse = new Set<T>();
  private readonly logger: Logger;
  private readonly factory: () => Promise<T>;
  private readonly destroyer: (resource: T) => Promise<void>;
  private readonly validator: (resource: T) => Promise<boolean>;
  private readonly maxSize: number;
  private readonly minSize: number;

  constructor(config: {
    factory: () => Promise<T>;
    destroyer: (resource: T) => Promise<void>;
    validator: (resource: T) => Promise<boolean>;
    maxSize?: number;
    minSize?: number;
    logger?: Logger;
  }) {
    this.factory = config.factory;
    this.destroyer = config.destroyer;
    this.validator = config.validator;
    this.maxSize = config.maxSize || 10;
    this.minSize = config.minSize || 2;
    this.logger = config.logger || createLogger(false, 0, 'ConnectionPool');
  }

  async acquire(): Promise<T> {
    // Try to get from pool
    while (this.pool.length > 0) {
      const resource = this.pool.pop()!;

      if (await this.validator(resource)) {
        this.inUse.add(resource);
        this.logger.debug('Acquired resource from pool', {
          poolSize: this.pool.length,
          inUse: this.inUse.size,
        });
        return resource;
      } else {
        // Resource is invalid, destroy it
        await this.destroyer(resource);
      }
    }

    // Create new resource if under max size
    if (this.getTotalSize() < this.maxSize) {
      const resource = await this.factory();
      this.inUse.add(resource);
      this.logger.debug('Created new resource', {
        poolSize: this.pool.length,
        inUse: this.inUse.size,
      });
      return resource;
    }

    throw new Error('Pool exhausted');
  }

  async release(resource: T): Promise<void> {
    if (!this.inUse.has(resource)) {
      this.logger.warn('Attempted to release resource not in use');
      return;
    }

    this.inUse.delete(resource);

    if (await this.validator(resource)) {
      this.pool.push(resource);
      this.logger.debug('Released resource to pool', {
        poolSize: this.pool.length,
        inUse: this.inUse.size,
      });
    } else {
      await this.destroyer(resource);
      this.logger.debug('Destroyed invalid resource', {
        poolSize: this.pool.length,
        inUse: this.inUse.size,
      });
    }
  }

  async destroy(): Promise<void> {
    // Destroy all pooled resources
    for (const resource of this.pool) {
      await this.destroyer(resource);
    }
    this.pool.length = 0;

    // Destroy all in-use resources
    await Promise.all(Array.from(this.inUse).map(resource => this.destroyer(resource)));
    this.inUse.clear();

    this.logger.info('Connection pool destroyed');
  }

  getTotalSize(): number {
    return this.pool.length + this.inUse.size;
  }

  getStats(): {
    available: number;
    inUse: number;
    total: number;
    maxSize: number;
    minSize: number;
  } {
    return {
      available: this.pool.length,
      inUse: this.inUse.size,
      total: this.getTotalSize(),
      maxSize: this.maxSize,
      minSize: this.minSize,
    };
  }
}
