import { Config } from '@foundation/contracts';

interface ConfigSource {
  get(key: string): string | undefined;
  has(key: string): boolean;
}

class EnvironmentConfigSource implements ConfigSource {
  private env: Record<string, string | undefined>;

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
  private config: Map<string, string>;

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
  private sources: ConfigSource[];

  constructor(sources: ConfigSource[] = []) {
    this.sources = sources;
  }

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
    if ((value.startsWith('{') && value.endsWith('}')) || 
        (value.startsWith('[') && value.endsWith(']'))) {
      try {
        return JSON.parse(value) as T;
      } catch {
        // If JSON parsing fails, return as string
      }
    }

    return value as unknown as T;
  }
}

// Factory function to create a config manager with common sources
export function loadConfig(additionalConfig?: Record<string, string>): Config {
  const sources: ConfigSource[] = [
    new EnvironmentConfigSource(process.env),
  ];

  if (additionalConfig) {
    sources.push(new MemoryConfigSource(additionalConfig));
  }

  return new ConfigManager(sources);
}

// Export config sources for testing
export { EnvironmentConfigSource, MemoryConfigSource };