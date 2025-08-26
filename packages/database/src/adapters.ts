// Adapter implementations for database package (Postgres & Redis)

import { Logger } from '@foundation/contracts';
import { Pool, QueryResult, QueryResultRow, PoolClient } from 'pg';
import { RedisClientType, createClient } from 'redis';
import { createLogger } from '@foundation/observability';

// PostgreSQL connection implementation (adapter)
export class PostgresConnection {
  private readonly pool: Pool;
  private readonly logger: Logger;

  constructor(
    config: {
      host: string;
      port: number;
      database: string;
      username: string;
      password: string;
      maxConnections?: number;
      idleTimeoutMs?: number;
      connectionTimeoutMs?: number;
    },
    logger?: Logger
  ) {
    this.logger = logger || createLogger(false, 0, 'PostgresConnection');

    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      max: config.maxConnections || 10,
      idleTimeoutMillis: config.idleTimeoutMs || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMs || 2000,
    });

    this.pool.on('error', err => {
      this.logger.error('PostgreSQL pool error', { error: err.message });
    });

    this.pool.on('connect', () => {
      this.logger.debug('New PostgreSQL client connected');
    });
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    const start = Date.now();

    try {
      this.logger.debug('Executing query', { query: text, params });
  const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;

      this.logger.debug('Query completed', {
        query: text,
        duration,
  rowCount: result.rowCount,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.logger.error('Query failed', {
        query: text,
        params,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async transaction<T>(callback: (client: { query: <U extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<QueryResult<U>>; commit: () => Promise<void>; rollback: () => Promise<void>; }) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const transactionClient = {
        query: async <U extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => {
          return client.query<U>(text, params);
        },
        commit: async (): Promise<void> => {
          await client.query('COMMIT');
        },
        rollback: async (): Promise<void> => {
          await client.query('ROLLBACK');
        },
      };

      const result = await callback(transactionClient);
      await client.query('COMMIT');

      this.logger.debug('Transaction completed successfully');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Transaction failed, rolled back', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    this.logger.info('PostgreSQL connection pool closed');
  }
}

// Redis cache implementation (adapter)
export class RedisCache {
  private readonly client: RedisClientType;
  private readonly logger: Logger;

  constructor(
    config: {
      host: string;
      port: number;
      password?: string;
      database?: number;
    },
    logger?: Logger
  ) {
    this.logger = logger || createLogger(false, 0, 'RedisCache');

    this.client = createClient({
      socket: {
        host: config.host,
        port: config.port,
      },
      password: config.password,
      database: config.database,
    });

    this.client.on('error', err => {
      this.logger.error('Redis client error', { error: err.message });
    });

    this.client.on('connect', () => {
      this.logger.debug('Redis client connected');
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.logger.info('Connected to Redis');
  }

  async get(key: string): Promise<string | null> {
    try {
      const value = await this.client.get(key);
      this.logger.debug('Cache get', { key, hit: value !== null });
      return value;
    } catch (error) {
      this.logger.error('Cache get failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }

      this.logger.debug('Cache set', { key, ttl: ttlSeconds });
    } catch (error) {
      this.logger.error('Cache set failed', {
        key,
        ttl: ttlSeconds,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
      this.logger.debug('Cache delete', { key });
    } catch (error) {
      this.logger.error('Cache delete failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      this.logger.error('Cache exists check failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.client.quit();
    this.logger.info('Redis connection closed');
  }
}
