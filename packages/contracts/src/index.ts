// Core domain contracts and interfaces
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

export interface Config {
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  has(key: string): boolean;
}

export interface HealthCheck {
  name: string;
  check(): Promise<HealthResult>;
}

export interface HealthResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

export interface Repository<T, ID> {
  findById(id: ID): Promise<T | undefined>;
  save(entity: T): Promise<T>;
  delete(id: ID): Promise<void>;
  findAll(): Promise<T[]>;
}

export interface UseCase<TRequest, TResponse> {
  execute(request: TRequest): Promise<TResponse>;
}

export interface DomainEvent {
  aggregateId: string;
  eventType: string;
  eventData: Record<string, unknown>;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface EventStore {
  saveEvents(
    aggregateId: string,
    aggregateType: string,
    events: DomainEvent[],
    expectedVersion?: number
  ): Promise<void>;
  loadEvents(aggregateId: string, aggregateType: string, fromVersion?: number): Promise<unknown[]>;
}

export interface Command {
  commandId: string;
  timestamp: Date;
}

export interface Query {
  queryId: string;
  timestamp: Date;
}

export interface Result<T, E = Error> {
  isSuccess: boolean;
  isFailure: boolean;
  value?: T;
  error?: E;
}

// Factory function for creating results
export const ResultFactory = {
  success: <T>(value: T): Result<T> => ({
    isSuccess: true,
    isFailure: false,
    value
  }),
  
  failure: <T, E = Error>(error: E): Result<T, E> => ({
    isSuccess: false,
    isFailure: true,
    error
  })
};

// Design by Contract - Runtime validation guards
export function assertNonNull<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Value must not be null or undefined');
  }
}

export function assertNumberFinite(value: number, message?: string): asserts value is number {
  if (!Number.isFinite(value)) {
    throw new Error(message || 'Value must be a finite number');
  }
}

export function assertIndexInRange(index: number, length: number, message?: string): asserts index is number {
  assertNumberFinite(index, 'Index must be a finite number');
  assertNumberFinite(length, 'Length must be a finite number');
  if (index < 0 || index >= length) {
    throw new Error(message || `Index ${index} is out of range [0, ${length})`);
  }
}

export function fail(message: string): never {
  throw new Error(message);
}