import { Logger } from '@foundation/contracts';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  meta?: Record<string, unknown>;
  service?: string;
  requestId?: string;
}

interface LogOutput {
  write(entry: LogEntry): void;
}

class ConsoleLogOutput implements LogOutput {
  write(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level];
    const meta = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';
    const service = entry.service ? ` [${entry.service}]` : '';
    const requestId = entry.requestId ? ` (${entry.requestId})` : '';
    
    // eslint-disable-next-line no-console
    console.log(`${timestamp} ${level}${service}${requestId}: ${entry.message}${meta}`);
  }
}

class StructuredLogOutput implements LogOutput {
  write(entry: LogEntry): void {
    const logObject = {
      timestamp: entry.timestamp.toISOString(),
      level: LogLevel[entry.level],
      message: entry.message,
      ...(entry.service ? { service: entry.service } : {}),
      ...(entry.requestId ? { requestId: entry.requestId } : {}),
      ...(entry.meta ? entry.meta : {})
    };
    
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(logObject));
  }
}

export class AppLogger implements Logger {
  private outputs: LogOutput[];
  private minLevel: LogLevel;
  private service: string | undefined;
  private requestId: string | undefined;

  constructor(
    outputs: LogOutput[] = [new ConsoleLogOutput()],
    minLevel: LogLevel = LogLevel.INFO,
    service?: string
  ) {
    this.outputs = outputs;
    this.minLevel = minLevel;
    this.service = service;
  }

  setRequestId(requestId: string): void {
    this.requestId = requestId;
  }

  clearRequestId(): void {
    this.requestId = undefined;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, meta);
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (level < this.minLevel) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      ...(meta ? { meta } : {}),
      ...(this.service ? { service: this.service } : {}),
      ...(this.requestId ? { requestId: this.requestId } : {})
    };

    this.outputs.forEach(output => output.write(entry));
  }

  child(service: string): AppLogger {
    return new AppLogger(this.outputs, this.minLevel, service);
  }
}

// Factory function to create logger with common configurations
export function createLogger(
  structured: boolean = false,
  level: LogLevel = LogLevel.INFO,
  service?: string
): Logger {
  const output = structured ? new StructuredLogOutput() : new ConsoleLogOutput();
  return new AppLogger([output], level, service);
}

// Metrics interfaces and basic implementation
export interface Counter {
  inc(value?: number, labels?: Record<string, string>): void;
}

export interface Histogram {
  observe(value: number, labels?: Record<string, string>): void;
}

export interface Gauge {
  set(value: number, labels?: Record<string, string>): void;
  inc(value?: number, labels?: Record<string, string>): void;
  dec(value?: number, labels?: Record<string, string>): void;
}

export interface Metrics {
  counter(name: string, help?: string): Counter;
  histogram(name: string, help?: string, buckets?: number[]): Histogram;
  gauge(name: string, help?: string): Gauge;
}

// Simple in-memory metrics implementation
export class SimpleMetrics implements Metrics {
  private counters = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private gauges = new Map<string, number>();

  counter(name: string): Counter {
    return {
      inc: (value = 1) => {
        const current = this.counters.get(name) ?? 0;
        this.counters.set(name, current + value);
      }
    };
  }

  histogram(name: string): Histogram {
    return {
      observe: (value: number) => {
        const current = this.histograms.get(name) ?? [];
        current.push(value);
        this.histograms.set(name, current);
      }
    };
  }

  gauge(name: string): Gauge {
    return {
      set: (value: number) => {
        this.gauges.set(name, value);
      },
      inc: (value = 1) => {
        const current = this.gauges.get(name) ?? 0;
        this.gauges.set(name, current + value);
      },
      dec: (value = 1) => {
        const current = this.gauges.get(name) ?? 0;
        this.gauges.set(name, current - value);
      }
    };
  }

  getMetrics(): Record<string, unknown> {
    return {
      counters: Object.fromEntries(this.counters),
      histograms: Object.fromEntries(this.histograms),
      gauges: Object.fromEntries(this.gauges)
    };
  }
}

export { ConsoleLogOutput, StructuredLogOutput };