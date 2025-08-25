#!/usr/bin/env node

/**
 * Foundation Monorepo - Database Migration Runner
 * Manages versioned database migrations with state tracking
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Default database configuration (can be overridden by environment variables)
const DEFAULT_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'foundation_db',
  user: process.env.DB_USER || 'foundation_user',
  password: process.env.DB_PASSWORD || 'foundation_password',
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class MigrationRunner {
  constructor(config = DEFAULT_CONFIG) {
    this.config = config;
    this.client = new Client(config);
    this.migrationsDir = path.join(__dirname, 'migrations');
  }

  async connect() {
    try {
      await this.client.connect();
      log('✅ Connected to database', 'green');
    } catch (error) {
      log(`❌ Failed to connect to database: ${error.message}`, 'red');
      throw error;
    }
  }

  async disconnect() {
    await this.client.end();
    log('📤 Disconnected from database', 'blue');
  }

  async ensureMigrationsTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    try {
      await this.client.query(createTableQuery);
      log('✅ Migrations table ready', 'green');
    } catch (error) {
      log(`❌ Failed to create migrations table: ${error.message}`, 'red');
      throw error;
    }
  }

  async getExecutedMigrations() {
    const query = 'SELECT version FROM schema_migrations ORDER BY version';
    try {
      const result = await this.client.query(query);
      return result.rows.map(row => row.version);
    } catch (error) {
      log(`❌ Failed to get executed migrations: ${error.message}`, 'red');
      throw error;
    }
  }

  async getMigrationFiles() {
    try {
      const files = fs
        .readdirSync(this.migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

      return files.map(file => {
        const version = file.split('_')[0];
        const name = file.replace(/^\d+_/, '').replace('.sql', '');
        return {
          version,
          name,
          file,
          path: path.join(this.migrationsDir, file),
        };
      });
    } catch (error) {
      log(`❌ Failed to read migration files: ${error.message}`, 'red');
      throw error;
    }
  }

  async executeMigration(migration) {
    const sql = fs.readFileSync(migration.path, 'utf8');

    try {
      // Begin transaction
      await this.client.query('BEGIN');

      // Execute migration SQL
      await this.client.query(sql);

      // Record migration as executed
      await this.client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [
        migration.version,
        migration.name,
      ]);

      // Commit transaction
      await this.client.query('COMMIT');

      log(`✅ Executed migration ${migration.version}: ${migration.name}`, 'green');
    } catch (error) {
      // Rollback transaction on error
      await this.client.query('ROLLBACK');
      log(`❌ Failed to execute migration ${migration.version}: ${error.message}`, 'red');
      throw error;
    }
  }

  async run() {
    log('🚀 Starting database migrations...', 'blue');

    try {
      await this.connect();
      await this.ensureMigrationsTable();

      const executedMigrations = await this.getExecutedMigrations();
      const availableMigrations = await this.getMigrationFiles();

      const pendingMigrations = availableMigrations.filter(
        migration => !executedMigrations.includes(migration.version)
      );

      if (pendingMigrations.length === 0) {
        log('📋 No pending migrations', 'yellow');
        log(
          `✅ Database is up to date (${executedMigrations.length} migrations executed)`,
          'green'
        );
        return;
      }

      log(`📋 Found ${pendingMigrations.length} pending migration(s):`, 'cyan');
      pendingMigrations.forEach(migration => {
        log(`   - ${migration.version}: ${migration.name}`, 'cyan');
      });

      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }

      log(`🎉 Successfully executed ${pendingMigrations.length} migration(s)`, 'green');
    } catch (error) {
      log(`💥 Migration failed: ${error.message}`, 'red');
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }

  async status() {
    log('📊 Migration status...', 'blue');

    try {
      await this.connect();
      await this.ensureMigrationsTable();

      const executedMigrations = await this.getExecutedMigrations();
      const availableMigrations = await this.getMigrationFiles();

      log('📋 Migration Status:', 'cyan');
      log('================', 'cyan');

      for (const migration of availableMigrations) {
        const status = executedMigrations.includes(migration.version)
          ? '✅ EXECUTED'
          : '⏳ PENDING';
        const color = executedMigrations.includes(migration.version) ? 'green' : 'yellow';
        log(`${status} ${migration.version}: ${migration.name}`, color);
      }

      log('', 'reset');
      log(`Total migrations: ${availableMigrations.length}`, 'blue');
      log(`Executed: ${executedMigrations.length}`, 'green');
      log(`Pending: ${availableMigrations.length - executedMigrations.length}`, 'yellow');
    } catch (error) {
      log(`💥 Failed to get migration status: ${error.message}`, 'red');
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2] || 'migrate';

  if (command === '--help' || command === '-h') {
    log('🗄️  Foundation Monorepo - Database Migration Runner', 'blue');
    log('=================================================', 'blue');
    log('');
    log('Usage:', 'cyan');
    log('  node migrate.js [command]', 'cyan');
    log('');
    log('Commands:', 'cyan');
    log('  migrate (default)  Run pending migrations', 'cyan');
    log('  status            Show migration status', 'cyan');
    log('  --help, -h        Show this help', 'cyan');
    log('');
    log('Environment Variables:', 'cyan');
    log('  DB_HOST           Database host (default: localhost)', 'cyan');
    log('  DB_PORT           Database port (default: 5432)', 'cyan');
    log('  DB_NAME           Database name (default: foundation_db)', 'cyan');
    log('  DB_USER           Database user (default: foundation_user)', 'cyan');
    log('  DB_PASSWORD       Database password (default: foundation_password)', 'cyan');
    return;
  }

  const runner = new MigrationRunner();

  switch (command) {
    case 'migrate':
      await runner.run();
      break;
    case 'status':
      await runner.status();
      break;
    default:
      log(`❌ Unknown command: ${command}`, 'red');
      log('Use --help for usage information', 'yellow');
      process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    log(`💥 Unexpected error: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { MigrationRunner };
