// ALLOW_COMPLEXITY_DELTA: Database package aggregates adapters and helpers; intentionally large.

import { Logger, Repository } from '@foundation/contracts';
import { QueryResult, QueryResultRow } from 'pg';

import { UserAdapter } from './repositories/user-adapter';
import { createLogger } from '@foundation/observability';

// Database connection interfaces
export interface DatabaseConnection {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
  transaction<T>(callback: (client: TransactionClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface TransactionClient {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
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

// Adapter implementations live in a separate module to split repository and adapter responsibilities.
export { PostgresConnection, RedisCache } from './adapters';

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
  private readonly adapter: UserAdapter;

  constructor(db: DatabaseConnection, cache: CacheConnection | undefined, logger: Logger | undefined, adapter: UserAdapter) {
    super('users', db, cache, logger);
    if (!adapter) throw new Error('UserRepository requires a UserAdapter');
    this.adapter = adapter;
  }

  async findById(id: string): Promise<User | undefined> {
    try {
      const cached = await this.getFromCache(id);
      if (cached) return cached;

      const user = await this.adapter.findById(id);
      if (user) await this.setInCache(id, user);
      return user;
    } catch (error) {
      this.logger.error('findById failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | undefined> {
    try {
      return this.adapter.findByEmail(email);
    } catch (error) {
      this.logger.error('findByEmail failed', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async save(user: User): Promise<User> {
    try {
      const saved = await this.adapter.save(user);
      await this.setInCache(user.id, saved);
      return saved;
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
      await this.adapter.delete(id);
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
      return this.adapter.findAll();
    } catch (error) {
      this.logger.error('findAll failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
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
        await this.runMigration(migration);
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
        await this.rollbackMigration(migration);
      }
    } catch (error) {
      this.logger.error('rollback failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // Helper to run a single migration inside a transaction and record it
  private async runMigration(migration: Migration): Promise<void> {
    this.logger.info(`Running migration: ${migration.name}`, { version: migration.version });

    await this.db.transaction(async client => {
      await migration.up(this.db);
      await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [
        migration.version,
        migration.name,
      ]);
    });

    this.logger.info(`Migration completed: ${migration.name}`, { version: migration.version });
  }

  // Helper to rollback a single migration inside a transaction and remove its record
  private async rollbackMigration(migration: Migration): Promise<void> {
    this.logger.info(`Rolling back migration: ${migration.name}`, { version: migration.version });

    await this.db.transaction(async client => {
      await migration.down(this.db);
      await client.query('DELETE FROM schema_migrations WHERE version = $1', [migration.version]);
    });

    this.logger.info(`Rollback completed: ${migration.name}`, { version: migration.version });
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

// Re-export repository adapters
export { PostgresUserAdapter } from './repositories/user-adapter';
export type { UserAdapter } from './repositories/user-adapter';
