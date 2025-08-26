// Adapter implementations for database package (Postgres & Redis)

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { RedisClientType, createClient } from 'redis';

import { Logger } from '@foundation/contracts';
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

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
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

  async transaction<T>(
    callback: (client: {
      query: <U extends QueryResultRow = QueryResultRow>(
        text: string,
        params?: unknown[]
      ) => Promise<QueryResult<U>>;
      commit: () => Promise<void>;
      rollback: () => Promise<void>;
    }) => Promise<T>
  ): Promise<T> {
    let client: PoolClient | undefined;

    try {
      client = await this.acquireClient();
      await this.beginTransaction(client);
      return await this.runTransactionClient(client, callback);
    } finally {
      if (client) await this.safeRelease(client);
    }
  }

  private async runTransactionClient<T>(
    client: PoolClient,
    callback: (client: {
      query: <U extends QueryResultRow = QueryResultRow>(
        text: string,
        params?: unknown[]
      ) => Promise<QueryResult<U>>;
      commit: () => Promise<void>;
      rollback: () => Promise<void>;
    }) => Promise<T>
  ): Promise<T> {
    const transactionClient = this.createTransactionClient(client);

    try {
      return await this.executeCallbackAndCommit(client, transactionClient, callback);
    } catch (error) {
      await this.handleTransactionError(client, error);
    }
    // TypeScript: this line is unreachable but required for typing
    throw new Error('Unreachable');
  }

  private async executeCallbackAndCommit<T>(
    client: PoolClient,
    transactionClient: {
      query: <U extends QueryResultRow = QueryResultRow>(
        text: string,
        params?: unknown[]
      ) => Promise<QueryResult<U>>;
      commit: () => Promise<void>;
      rollback: () => Promise<void>;
    },
    callback: (client: {
      query: <U extends QueryResultRow = QueryResultRow>(
        text: string,
        params?: unknown[]
      ) => Promise<QueryResult<U>>;
      commit: () => Promise<void>;
      rollback: () => Promise<void>;
    }) => Promise<T>
  ): Promise<T> {
    const result = await callback(transactionClient);
    await this.safeCommit(client);
    this.logger.debug('Transaction completed successfully');
    return result;
  }

  private async handleTransactionError(client: PoolClient, error: unknown): Promise<never> {
    try {
      await this.safeRollback(client);
    } catch (rbErr) {
      this.logger.error('Rollback failed', {
        error: rbErr instanceof Error ? rbErr.message : rbErr,
      });
    }
    this.logger.error('Transaction failed, rolled back', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }

  private async acquireClient(): Promise<PoolClient> {
    try {
      return await this.pool.connect();
    } catch (error) {
      this.logger.error('Failed to acquire connection from pool', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async beginTransaction(client: PoolClient): Promise<void> {
    try {
      await client.query('BEGIN');
    } catch (error) {
      this.logger.error('Failed to begin transaction', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  private createTransactionClient(client: PoolClient) {
    return {
      query: async <U extends QueryResultRow = QueryResultRow>(
        text: string,
        params?: unknown[]
      ) => {
        return this.safeQuery<U>(client, text, params);
      },
      commit: async (): Promise<void> => {
        return this.safeCommit(client);
      },
      rollback: async (): Promise<void> => {
        return this.safeRollback(client);
      },
    };
  }

  private async safeQuery<U extends QueryResultRow = QueryResultRow>(
    client: PoolClient,
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<U>> {
    try {
      return await client.query<U>(text, params);
    } catch (err) {
      this.logger.error('Transaction client query failed', {
        query: text,
        error: err instanceof Error ? err.message : err,
      });
      throw err;
    }
  }

  private async safeCommit(client: PoolClient): Promise<void> {
    try {
      await client.query('COMMIT');
    } catch (err) {
      this.logger.error('Transaction commit failed', {
        error: err instanceof Error ? err.message : err,
      });
      // Attempt rollback if commit fails
      try {
        await client.query('ROLLBACK');
      } catch (rbErr) {
        this.logger.error('Rollback failed after commit failure', {
          error: rbErr instanceof Error ? rbErr.message : rbErr,
        });
      }
      throw err;
    }
  }

  private async safeRollback(client: PoolClient): Promise<void> {
    try {
      await client.query('ROLLBACK');
    } catch (err) {
      this.logger.error('Transaction rollback failed', {
        error: err instanceof Error ? err.message : err,
      });
      throw err;
    }
  }

  private async safeRelease(client: PoolClient): Promise<void> {
    try {
      client.release();
    } catch (releaseErr) {
      this.logger.error('Failed to release client back to pool', {
        error: releaseErr instanceof Error ? releaseErr.message : releaseErr,
      });
    }
  }

  async close(): Promise<void> {
    try {
      await this.pool.end();
      this.logger.info('PostgreSQL connection pool closed');
    } catch (error) {
      this.logger.error('Failed to close PostgreSQL pool', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
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
    try {
      await this.client.connect();
      this.logger.info('Connected to Redis');
    } catch (error) {
      this.logger.error('Failed to connect to Redis', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
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
    try {
      await this.client.quit();
      this.logger.info('Redis connection closed');
    } catch (error) {
      this.logger.error('Failed to close Redis client', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
