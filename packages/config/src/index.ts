import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file if present
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Local Config interface to avoid circular dependency
interface Config {
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  has(key: string): boolean;
  getRequired?<T>(key: string): T;
  validate?(): void;
}

interface ConfigSource {
  get(key: string): string | undefined;
  has(key: string): boolean;
}

interface ConfigValidationRule {
  key: string;
  required?: boolean;
  validator?: (value: string) => boolean;
  errorMessage?: string;
}

class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly missingKeys: string[] = []
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

class EnvironmentConfigSource implements ConfigSource {
  private readonly env: Record<string, string | undefined>;

  constructor(environment: Record<string, string | undefined> = {}) {
    this.env = environment;
  }

  get(key: string): string | undefined {
    return this.env[key];
  }

  has(key: string): boolean {
    return key in this.env && this.env[key] !== undefined;
  }
}

class MemoryConfigSource implements ConfigSource {
  private readonly config: Map<string, string>;

  constructor(config: Record<string, string> = {}) {
    this.config = new Map(Object.entries(config));
  }

  get(key: string): string | undefined {
    return this.config.get(key);
  }

  has(key: string): boolean {
    return this.config.has(key);
  }

  set(key: string, value: string): void {
    this.config.set(key, value);
  }
}

export class ConfigManager implements Config {
  private readonly sources: ConfigSource[];
  private readonly validationRules: ConfigValidationRule[] = [];

  constructor(sources: ConfigSource[] = []) {
    this.sources = sources;
  }

  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    for (const source of this.sources) {
      if (source.has(key)) {
        const value = source.get(key);
        if (value !== undefined) {
          return this.parseValue<T>(value);
        }
      }
    }
    return defaultValue;
  }

  has(key: string): boolean {
    return this.sources.some(source => source.has(key));
  }

  /**
   * Get a required configuration value with validation
   */
  getRequired<T>(key: string): T {
    const value = this.get<T>(key);
    if (value === undefined) {
      throw new ConfigValidationError(
        `Required configuration key '${key}' is missing or undefined`
      );
    }
    return value;
  }

  /**
   * Add validation rules for configuration keys
   */
  addValidationRule(rule: ConfigValidationRule): void {
    this.validationRules.push(rule);
  }

  /**
   * Validate all configuration according to defined rules
   */
  validate(): void {
    const errors: string[] = [];
    const missingKeys: string[] = [];

    for (const rule of this.validationRules) {
      const value = this.get<string>(rule.key);

      if (rule.required && (value === undefined || value === '')) {
        errors.push(`Required configuration '${rule.key}' is missing`);
        missingKeys.push(rule.key);
        continue;
      }

      if (value !== undefined && rule.validator && !rule.validator(value)) {
        errors.push(rule.errorMessage || `Configuration '${rule.key}' has invalid value: ${value}`);
      }
    }

    if (errors.length > 0) {
      throw new ConfigValidationError(
        `Configuration validation failed:\n${errors.join('\n')}`,
        missingKeys
      );
    }
  }

  private parseValue<T>(value: string): T {
    // Handle boolean values
    if (value.toLowerCase() === 'true') {
      return true as unknown as T;
    }
    if (value.toLowerCase() === 'false') {
      return false as unknown as T;
    }

    // Handle numeric values
    if (/^\d+$/.test(value)) {
      return Number.parseInt(value, 10) as unknown as T;
    }
    if (/^\d*\.\d+$/.test(value)) {
      return Number.parseFloat(value) as unknown as T;
    }

    // Handle JSON values
    if (
      (value.startsWith('{') && value.endsWith('}')) ||
      (value.startsWith('[') && value.endsWith(']'))
    ) {
      try {
        return JSON.parse(value) as T;
      } catch {
        // If JSON parsing fails, return as string
      }
    }

    return value as unknown as T;
  }
}

// Common validation functions
export const validators = {
  isUrl: (value: string): boolean => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },

  isPort: (value: string): boolean => {
    const port = parseInt(value, 10);
    return !isNaN(port) && port > 0 && port <= 65535;
  },

  isNotDangerousDefault: (value: string): boolean => {
    const dangerousDefaults = [
      'your-secret-key',
      'your-refresh-secret',
      'change-in-production',
      'your_openai_api_key_here',
    ];
    return !dangerousDefaults.includes(value);
  },

  minLength:
    (minLen: number) =>
    (value: string): boolean => {
      return value.length >= minLen;
    },

  isOneOf:
    (validValues: string[]) =>
    (value: string): boolean => {
      return validValues.includes(value);
    },
};

// Factory function to create a config manager with common sources and validation
export function loadConfig(additionalConfig?: Record<string, string>): ConfigManager {
  const config = createValidatedConfig(additionalConfig);
  
  // Validate configuration on load
  try {
    config.validate();
    return config;
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      console.error('Configuration validation failed:');
      console.error(error.message);
      if (error.missingKeys.length > 0) {
        console.error('Missing required keys:', error.missingKeys.join(', '));
      }
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Create a validated config with common production-ready rules
 */
export function createValidatedConfig(additionalConfig?: Record<string, string>): ConfigManager {
  const config = new ConfigManager([
    new EnvironmentConfigSource(process.env),
    ...(additionalConfig ? [new MemoryConfigSource(additionalConfig)] : []),
  ]);

  // Add common validation rules
  config.addValidationRule({
    key: 'JWT_SECRET',
    required: true,
    validator: value => validators.minLength(32)(value) && validators.isNotDangerousDefault(value),
    errorMessage: 'JWT_SECRET must be at least 32 characters and not use default value',
  });

  config.addValidationRule({
    key: 'JWT_REFRESH_SECRET',
    required: true,
    validator: value => validators.minLength(32)(value) && validators.isNotDangerousDefault(value),
    errorMessage: 'JWT_REFRESH_SECRET must be at least 32 characters and not use default value',
  });

  config.addValidationRule({
    key: 'DB_HOST',
    required: true,
    errorMessage: 'Database host is required',
  });

  config.addValidationRule({
    key: 'DB_PASSWORD',
    required: true,
    errorMessage: 'Database password is required',
  });

  config.addValidationRule({
    key: 'REDIS_HOST',
    required: true,
    errorMessage: 'Redis host is required',
  });

  config.addValidationRule({
    key: 'PORT',
    validator: validators.isPort,
    errorMessage: 'PORT must be a valid port number (1-65535)',
  });

  config.addValidationRule({
    key: 'NODE_ENV',
    validator: validators.isOneOf(['development', 'test', 'production']),
    errorMessage: 'NODE_ENV must be development, test, or production',
  });

  return config;
}

/**
 * Configuration schema definition for TypeScript apps
 */
export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'test' | 'production';
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  redis: {
    host: string;
    port: number;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  observability: {
    tracing: boolean;
    metrics: boolean;
    logLevel: string;
  };
}

/**
 * Type-safe configuration getter with schema validation
 */
export function getTypedConfig(config: ConfigManager): AppConfig {
  return {
    port: config.getRequired<number>('PORT'),
    nodeEnv: config.getRequired<'development' | 'test' | 'production'>('NODE_ENV'),
    database: {
      host: config.getRequired<string>('DB_HOST'),
      port: config.get<number>('DB_PORT', 5432),
      name: config.getRequired<string>('DB_NAME'),
      user: config.getRequired<string>('DB_USER'),
      password: config.getRequired<string>('DB_PASSWORD'),
    },
    redis: {
      host: config.getRequired<string>('REDIS_HOST'),
      port: config.get<number>('REDIS_PORT', 6379),
    },
    jwt: {
      secret: config.getRequired<string>('JWT_SECRET'),
      expiresIn: config.get<string>('JWT_EXPIRES_IN', '24h'),
    },
    observability: {
      tracing: config.get<boolean>('ENABLE_TRACING', false),
      metrics: config.get<boolean>('ENABLE_METRICS', true),
      logLevel: config.get<string>('LOG_LEVEL', 'info'),
    },
  };
}

/**
 * Legacy function name for backward compatibility
 */
export function loadValidatedConfig(envOverrides?: Record<string, string>): ConfigManager {
  return loadConfig(envOverrides);
}

// Export config sources and error class for testing
export { ConfigValidationError, EnvironmentConfigSource, MemoryConfigSource };
