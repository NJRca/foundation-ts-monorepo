import { DatabaseConnection, User } from '../index';

import { Logger } from '@foundation/contracts';
import { QueryResultRow } from 'pg';
import { createLogger } from '@foundation/observability';

export interface UserAdapter {
  findById(id: string): Promise<User | undefined>;
  findByEmail(email: string): Promise<User | undefined>;
  save(user: User): Promise<User>;
  delete(id: string): Promise<void>;
  findAll(): Promise<User[]>;
}

export class PostgresUserAdapter implements UserAdapter {
  private readonly db: DatabaseConnection;
  private readonly logger: Logger;

  constructor(db: DatabaseConnection, logger?: Logger) {
    this.db = db;
    this.logger = logger || createLogger(false, 0, 'PostgresUserAdapter');
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

  async findById(id: string): Promise<User | undefined> {
    try {
      const result = await this.db.query(
        'SELECT id, name, email, created_at, updated_at FROM users WHERE id = $1',
        [id]
      );
      const row = result.rows[0] as QueryResultRow | undefined;
      if (!row) return undefined;

      try {
        return this.transformFromDb(row);
      } catch (tErr) {
        this.logger.error('Failed to transform DB row in findById', {
          id,
          error: tErr instanceof Error ? tErr.message : tErr,
        });
        throw tErr;
      }
    } catch (error) {
      this.logger.error('PostgresUserAdapter.findById failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | undefined> {
    try {
      const result = await this.db.query(
        'SELECT id, name, email, created_at, updated_at FROM users WHERE email = $1',
        [email]
      );
      const row = result.rows[0] as QueryResultRow | undefined;
      if (!row) return undefined;

      try {
        return this.transformFromDb(row);
      } catch (tErr) {
        this.logger.error('Failed to transform DB row in findByEmail', {
          email,
          error: tErr instanceof Error ? tErr.message : tErr,
        });
        throw tErr;
      }
    } catch (error) {
      this.logger.error('PostgresUserAdapter.findByEmail failed', {
        email,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      throw error;
    }
  }

  async save(user: User): Promise<User> {
    const now = new Date();

    try {
      if (await this.findById(user.id)) {
        const result = await this.db.query(
          'UPDATE users SET name = $2, email = $3, updated_at = $4 WHERE id = $1 RETURNING id, name, email, created_at, updated_at',
          [user.id, user.name, user.email, now]
        );

        try {
          return this.transformFromDb(result.rows[0]);
        } catch (tErr) {
          this.logger.error('Failed to transform DB row in save (update)', {
            userId: user.id,
            error: tErr instanceof Error ? tErr.message : tErr,
          });
          throw tErr;
        }
      } else {
        const result = await this.db.query(
          'INSERT INTO users (id, name, email, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, created_at, updated_at',
          [user.id, user.name, user.email, now, now]
        );

        try {
          return this.transformFromDb(result.rows[0]);
        } catch (tErr) {
          this.logger.error('Failed to transform DB row in save (insert)', {
            userId: user.id,
            error: tErr instanceof Error ? tErr.message : tErr,
          });
          throw tErr;
        }
      }
    } catch (error) {
      this.logger.error('PostgresUserAdapter.save failed', {
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.db.query('DELETE FROM users WHERE id = $1', [id]);
    } catch (error) {
      this.logger.error('PostgresUserAdapter.delete failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      throw error;
    }
  }

  async findAll(): Promise<User[]> {
    try {
      const result = await this.db.query(
        'SELECT id, name, email, created_at, updated_at FROM users ORDER BY created_at DESC'
      );
      try {
        return result.rows.map(r => this.transformFromDb(r));
      } catch (tErr) {
        this.logger.error('Failed to transform DB rows in findAll', {
          error: tErr instanceof Error ? tErr.message : tErr,
        });
        throw tErr;
      }
    } catch (error) {
      this.logger.error('PostgresUserAdapter.findAll failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      throw error;
    }
  }
}
