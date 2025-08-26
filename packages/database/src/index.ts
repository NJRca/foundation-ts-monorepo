// ALLOW_COMPLEXITY_DELTA: Database package aggregates adapters and helpers; intentionally large.

import { Logger, Repository } from '@foundation/contracts';
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { RedisClientType, createClient } from 'redis';

import { createLogger } from '@foundation/observability';

// Database connection interfaces
export interface DatabaseConnection {
  query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  transaction<T>(callback: (client: TransactionClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface TransactionClient {
  query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface CacheConnection {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  close(): Promise<void>;
}

// PostgreSQL connection implementation
export class PostgresConnection implements DatabaseConnection {
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

  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
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

  async transaction<T>(callback: (client: TransactionClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const transactionClient: TransactionClient = {
        query: async <U extends QueryResultRow = any>(
          text: string,
          params?: any[]
        ): Promise<QueryResult<U>> => {
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

// Redis cache implementation
export class RedisCache implements CacheConnection {
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

// Base repository implementation
export abstract class BaseRepository<T, ID> implements Repository<T, ID> {
  protected readonly db: DatabaseConnection;
  protected readonly cache?: CacheConnection;
  protected readonly logger: Logger;
  protected readonly tableName: string;

  constructor(tableName: string, db: DatabaseConnection, cache?: CacheConnection, logger?: Logger) {
    this.tableName = tableName;
    this.db = db;
    this.cache = cache;
    this.logger = logger || createLogger(false, 0, `${tableName}Repository`);
  }

  abstract findById(id: ID): Promise<T | undefined>;
  abstract save(entity: T): Promise<T>;
  abstract delete(id: ID): Promise<void>;
  abstract findAll(): Promise<T[]>;

  // Helper methods for common operations
  protected async findOne(query: string, params?: unknown[]): Promise<T | undefined> {
    try {
      const result = await this.db.query<T & QueryResultRow>(query, params);
      return result.rows[0];
    } catch (error) {
      this.logger.error('findOne failed', {
        query,
        params,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  protected async findMany(query: string, params?: unknown[]): Promise<T[]> {
    try {
      const result = await this.db.query<T & QueryResultRow>(query, params);
      return result.rows;
    } catch (error) {
      this.logger.error('findMany failed', {
        query,
        params,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  protected async execute(query: string, params?: unknown[]): Promise<QueryResult> {
    try {
      return await this.db.query(query, params);
    } catch (error) {
      this.logger.error('execute failed', {
        query,
        params,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // Cache helper methods
  protected getCacheKey(id: ID): string {
    return `${this.tableName}:${id}`;
  }

  protected async getFromCache(id: ID): Promise<T | undefined> {
    if (!this.cache) return undefined;

    try {
      const cached = await this.cache.get(this.getCacheKey(id));
      if (cached) {
        this.logger.debug('Cache hit', { table: this.tableName, id });
        return JSON.parse(cached) as T;
      }
    } catch (error) {
      this.logger.warn('Cache read failed', {
        table: this.tableName,
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return undefined;
  }

  protected async setInCache(id: ID, entity: T, ttlSeconds = 3600): Promise<void> {
    if (!this.cache) return;

    try {
      await this.cache.set(this.getCacheKey(id), JSON.stringify(entity), ttlSeconds);
      this.logger.debug('Cached entity', { table: this.tableName, id, ttl: ttlSeconds });
    } catch (error) {
      this.logger.warn('Cache write failed', {
        table: this.tableName,
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  protected async invalidateCache(id: ID): Promise<void> {
    if (!this.cache) return;

    try {
      await this.cache.del(this.getCacheKey(id));
      this.logger.debug('Cache invalidated', { table: this.tableName, id });
    } catch (error) {
      this.logger.warn('Cache invalidation failed', {
        table: this.tableName,
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// Example User repository implementation
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserRepository extends BaseRepository<User, string> {
  constructor(db: DatabaseConnection, cache?: CacheConnection, logger?: Logger) {
    super('users', db, cache, logger);
  }

  async findById(id: string): Promise<User | undefined> {
    try {
      // Try cache first
      const cached = await this.getFromCache(id);
      if (cached) return cached;

      // Query database
      const user = await this.findOne(
        'SELECT id, name, email, created_at, updated_at FROM users WHERE id = $1',
        [id]
      );

      if (user) {
        // Transform database result
        const transformedUser = this.transformFromDb(user as QueryResultRow);
        await this.setInCache(id, transformedUser);
        return transformedUser;
      }

      return undefined;
    } catch (error) {
      this.logger.error('findById failed', { id, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | undefined> {
    try {
      const user = await this.findOne(
        'SELECT id, name, email, created_at, updated_at FROM users WHERE email = $1',
        [email]
      );

      return user ? this.transformFromDb(user as QueryResultRow) : undefined;
    } catch (error) {
      this.logger.error('findByEmail failed', { email, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  async save(user: User): Promise<User> {
    const now = new Date();

    try {
      if (await this.findById(user.id)) {
        // Update existing user
        const result = await this.execute(
          `UPDATE users
           SET name = $2, email = $3, updated_at = $4
           WHERE id = $1
           RETURNING id, name, email, created_at, updated_at`,
          [user.id, user.name, user.email, now]
        );

        const updatedUser = this.transformFromDb(result.rows[0]);
        await this.setInCache(user.id, updatedUser);
        return updatedUser;
      } else {
        // Insert new user
        const result = await this.execute(
          `INSERT INTO users (id, name, email, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, name, email, created_at, updated_at`,
          [user.id, user.name, user.email, now, now]
        );

        const newUser = this.transformFromDb(result.rows[0]);
        await this.setInCache(user.id, newUser);
        return newUser;
      }
    } catch (error) {
      this.logger.error('save failed', {
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.execute('DELETE FROM users WHERE id = $1', [id]);
      await this.invalidateCache(id);
    } catch (error) {
      this.logger.error('delete failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async findAll(): Promise<User[]> {
    try {
      const users = await this.findMany(
        'SELECT id, name, email, created_at, updated_at FROM users ORDER BY created_at DESC'
      );

      return users.map(user => this.transformFromDb(user));
    } catch (error) {
      this.logger.error('findAll failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private transformFromDb(dbUser: QueryResultRow): User {
    return {
      id: String(dbUser.id),
      name: String(dbUser.name),
      email: String(dbUser.email),
      createdAt: new Date(dbUser.created_at as string | number),
      updatedAt: new Date(dbUser.updated_at as string | number),
    };
  }
}

// Database migration utilities
export interface Migration {
  version: number;
  name: string;
  up: (db: DatabaseConnection) => Promise<void>;
  down: (db: DatabaseConnection) => Promise<void>;
}

export class MigrationRunner {
  private readonly db: DatabaseConnection;
  private readonly logger: Logger;
  private readonly migrations: Map<number, Migration> = new Map();

  constructor(db: DatabaseConnection, logger?: Logger) {
    this.db = db;
    this.logger = logger || createLogger(false, 0, 'MigrationRunner');
  }

  addMigration(migration: Migration): void {
    this.migrations.set(migration.version, migration);
  }

  async initializeMigrationTable(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async getCurrentVersion(): Promise<number> {
    const result = await this.db.query('SELECT MAX(version) as version FROM schema_migrations');
    return result.rows[0]?.version || 0;
  }

  async migrate(targetVersion?: number): Promise<void> {
    try {
      await this.initializeMigrationTable();

      const currentVersion = await this.getCurrentVersion();
      const target = targetVersion || Math.max(...Array.from(this.migrations.keys()));

      if (currentVersion >= target) {
        this.logger.info('Database is already up to date', {
          currentVersion,
          targetVersion: target,
        });
        return;
      }

      const migrationsToRun = Array.from(this.migrations.values())
        .filter(m => m.version > currentVersion && m.version <= target)
        .sort((a, b) => a.version - b.version);

      for (const migration of migrationsToRun) {
        this.logger.info(`Running migration: ${migration.name}`, {
          version: migration.version,
        });

        await this.db.transaction(async client => {
          await migration.up(this.db);
          await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [
            migration.version,
            migration.name,
          ]);
        });

        this.logger.info(`Migration completed: ${migration.name}`, {
          version: migration.version,
        });
      }
    } catch (error) {
      this.logger.error('migrate failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async rollback(targetVersion: number): Promise<void> {
    try {
      const currentVersion = await this.getCurrentVersion();

      if (currentVersion <= targetVersion) {
        this.logger.info('No rollback needed', {
          currentVersion,
          targetVersion,
        });
        return;
      }

      const migrationsToRollback = Array.from(this.migrations.values())
        .filter(m => m.version > targetVersion && m.version <= currentVersion)
        .sort((a, b) => b.version - a.version);

      for (const migration of migrationsToRollback) {
        this.logger.info(`Rolling back migration: ${migration.name}`, {
          version: migration.version,
        });

        await this.db.transaction(async client => {
          await migration.down(this.db);
          await client.query('DELETE FROM schema_migrations WHERE version = $1', [migration.version]);
        });

        this.logger.info(`Rollback completed: ${migration.name}`, {
          version: migration.version,
        });
      }
    } catch (error) {
      this.logger.error('rollback failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

// Health check implementations
export class DatabaseHealthCheck {
  private readonly db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  async check(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const start = Date.now();

    try {
      await this.db.query('SELECT 1');
      const latency = Date.now() - start;

      return { healthy: true, latency };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export class CacheHealthCheck {
  private readonly cache: CacheConnection;

  constructor(cache: CacheConnection) {
    this.cache = cache;
  }

  async check(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const start = Date.now();
    const testKey = '__health_check__';

    try {
      await this.cache.set(testKey, 'test', 10);
      await this.cache.get(testKey);
      await this.cache.del(testKey);

      const latency = Date.now() - start;
      return { healthy: true, latency };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
