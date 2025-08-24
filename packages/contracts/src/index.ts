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