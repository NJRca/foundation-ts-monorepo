// ALLOW_COMPLEXITY_DELTA: This file is intentionally large due to orchestration
// logic and infra glue. Adding this marker to satisfy repository complexity policy.
import { DomainEvent, Logger } from '@foundation/contracts';

import { EventBus } from '@foundation/events';
import { createLogger } from '@foundation/observability';
import { createHash } from 'crypto';

export interface LogEntry {
  timestamp: Date;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  service: string;
  requestId?: string;
  userId?: string;
  stackTrace?: string;
  metadata?: Record<string, any>;
}

export interface ErrorFingerprint {
  id: string;
  pattern: string;
  service: string;
  errorType: string;
  stackSignature: string;
  frequency: number;
  firstSeen: Date;
  lastSeen: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'investigating' | 'healing' | 'resolved' | 'ignored';
}

export interface SelfHealEvent {
  id: string;
  fingerprintId: string;
  timestamp: Date;
  eventType: 'error_detected' | 'healing_started' | 'healing_completed' | 'healing_failed';
  service: string;
  severity: ErrorFingerprint['severity'];
  metadata: Record<string, any>;
}

/**
 * Log Ingestion and Fingerprinting Service
 *
 * Processes logs from various sources, creates fingerprints for errors,
 * and triggers self-healing workflows.
 */
export class SelfHealIngest {
  private readonly logger: Logger;
  private readonly eventBus: EventBus;
  private readonly fingerprints: Map<string, ErrorFingerprint> = new Map();
  private readonly fingerprintThresholds = {
    low: 5, // 5 occurrences
    medium: 10, // 10 occurrences
    high: 20, // 20 occurrences
    critical: 50, // 50 occurrences
  };

  constructor(eventBus: EventBus, logger?: Logger) {
    this.logger = logger || createLogger(true, 1, 'SelfHealIngest');
    this.eventBus = eventBus;
  }

  /**
   * Process a log entry and create/update fingerprints
   */
  async processLogEntry(entry: LogEntry): Promise<void> {
    try {
      // Only process error and warn levels for now
      if (entry.level !== 'error' && entry.level !== 'warn') {
        return;
      }

      const fingerprint = this.createFingerprint(entry);
      await this.updateFingerprint(fingerprint, entry);

      // Check if we should trigger healing
      await this.evaluateForHealing(fingerprint);
    } catch (error) {
      this.logger.error('Failed to process log entry', {
        error: error instanceof Error ? error.message : 'Unknown error',
        logEntry: entry,
      });
    }
  }

  /**
   * Create a fingerprint from a log entry
   */
  private createFingerprint(entry: LogEntry): ErrorFingerprint {
    const stackSignature = this.extractStackSignature(entry.stackTrace || '');
    const pattern = this.extractErrorPattern(entry.message);
    const fingerprintData = `${entry.service}:${pattern}:${stackSignature}`;
    const id = createHash('sha256').update(fingerprintData).digest('hex').substring(0, 16);

    const existingFingerprint = this.fingerprints.get(id);
    if (existingFingerprint) {
      return existingFingerprint;
    }

    return {
      id,
      pattern,
      service: entry.service,
      errorType: this.classifyErrorType(entry.message, entry.stackTrace),
      stackSignature,
      frequency: 0,
      firstSeen: entry.timestamp,
      lastSeen: entry.timestamp,
      severity: 'low',
      status: 'new',
    };
  }

  /**
   * Extract a normalized error pattern from the message
   */
  private extractErrorPattern(message: string): string {
    // Remove dynamic content like IDs, timestamps, paths
    return message
      .replace(/\b\d+\b/g, '<NUMBER>') // Replace numbers
      .replace(/\b[a-f0-9-]{32,}\b/gi, '<ID>') // Replace UUIDs/hashes
      .replace(/\/[^\s]+/g, '<PATH>') // Replace file paths
      .replace(/https?:\/\/[^\s]+/g, '<URL>') // Replace URLs
      .replace(/\b\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/g, '<TIMESTAMP>') // Replace timestamps
      .toLowerCase()
      .trim();
  }

  /**
   * Extract stack trace signature for grouping similar errors
   */
  private extractStackSignature(stackTrace: string): string {
    if (!stackTrace) return 'no-stack';

    // Extract just the function names and file locations, ignore line numbers
    const lines = stackTrace
      .split('\n')
      .filter(line => line.trim().includes('at '))
      .slice(0, 5) // Top 5 stack frames
      .map(line => {
        // Extract function name and file, ignore line numbers
        const match = line.match(/at\s+([^\s(]+)[\s(]*([^:)]+)/);
        return match ? `${match[1]}@${match[2]}` : line.trim();
      });

    return createHash('md5').update(lines.join('|')).digest('hex').substring(0, 12);
  }

  /**
   * Classify the type of error
   */
  private classifyErrorType(message: string, stackTrace?: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('timeout') || lowerMessage.includes('ttl exceeded')) {
      return 'timeout';
    }

    if (lowerMessage.includes('connection') || lowerMessage.includes('network')) {
      return 'network';
    }

    if (
      lowerMessage.includes('auth') ||
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('forbidden')
    ) {
      return 'authentication';
    }

    if (
      lowerMessage.includes('validation') ||
      lowerMessage.includes('invalid') ||
      lowerMessage.includes('required')
    ) {
      return 'validation';
    }

    if (
      lowerMessage.includes('database') ||
      lowerMessage.includes('sql') ||
      lowerMessage.includes('query')
    ) {
      return 'database';
    }

    if (stackTrace?.includes('TypeError') || lowerMessage.includes('type error')) {
      return 'type_error';
    }

    if (stackTrace?.includes('ReferenceError') || lowerMessage.includes('reference error')) {
      return 'reference_error';
    }

    return 'unknown';
  }

  /**
   * Update fingerprint with new occurrence
   */
  private async updateFingerprint(fingerprint: ErrorFingerprint, entry: LogEntry): Promise<void> {
    fingerprint.frequency += 1;
    fingerprint.lastSeen = entry.timestamp;

    // Update severity based on frequency
    fingerprint.severity = this.calculateSeverity(fingerprint.frequency);

    this.fingerprints.set(fingerprint.id, fingerprint);

    // Log fingerprint update
    this.logger.info('Updated error fingerprint', {
      fingerprintId: fingerprint.id,
      frequency: fingerprint.frequency,
      severity: fingerprint.severity,
      service: fingerprint.service,
      pattern: fingerprint.pattern,
    });

    // Emit event for persistence
    const fingerprintEvent: DomainEvent = {
      aggregateId: fingerprint.id,
      eventType: 'self_heal.fingerprint_updated',
      eventData: { fingerprint, logEntry: entry },
      timestamp: new Date(),
      metadata: { service: fingerprint.service },
    };

    await this.eventBus.publish(fingerprintEvent);
  }

  /**
   * Calculate severity based on frequency
   */
  private calculateSeverity(frequency: number): ErrorFingerprint['severity'] {
    if (frequency >= this.fingerprintThresholds.critical) return 'critical';
    if (frequency >= this.fingerprintThresholds.high) return 'high';
    if (frequency >= this.fingerprintThresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Evaluate if healing should be triggered
   */
  private async evaluateForHealing(fingerprint: ErrorFingerprint): Promise<void> {
    // Trigger healing for medium+ severity errors that aren't already being healed
    if (fingerprint.severity !== 'low' && fingerprint.status === 'new') {
      fingerprint.status = 'investigating';

      const healEvent: SelfHealEvent = {
        id: `heal_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        fingerprintId: fingerprint.id,
        timestamp: new Date(),
        eventType: 'error_detected',
        service: fingerprint.service,
        severity: fingerprint.severity,
        metadata: {
          errorType: fingerprint.errorType,
          frequency: fingerprint.frequency,
          pattern: fingerprint.pattern,
        },
      };

      this.logger.warn('Triggering self-healing for error pattern', {
        fingerprintId: fingerprint.id,
        severity: fingerprint.severity,
        frequency: fingerprint.frequency,
        service: fingerprint.service,
      });

      // Emit healing trigger event
      const healingEvent: DomainEvent = {
        aggregateId: healEvent.id,
        eventType: 'self_heal.healing_triggered',
        eventData: { event: healEvent, fingerprint },
        timestamp: new Date(),
        metadata: { service: fingerprint.service, severity: fingerprint.severity },
      };

      await this.eventBus.publish(healingEvent);
    }
  }

  /**
   * Get all fingerprints
   */
  getFingerprints(): ErrorFingerprint[] {
    return Array.from(this.fingerprints.values());
  }

  /**
   * Get fingerprint by ID
   */
  getFingerprint(id: string): ErrorFingerprint | undefined {
    return this.fingerprints.get(id);
  }

  /**
   * Update fingerprint status (e.g., when healing starts/completes)
   */
  updateFingerprintStatus(id: string, status: ErrorFingerprint['status']): void {
    const fingerprint = this.fingerprints.get(id);
    if (fingerprint) {
      fingerprint.status = status;
      this.fingerprints.set(id, fingerprint);
    }
  }

  /**
   * Get fingerprints by service
   */
  getFingerprintsByService(service: string): ErrorFingerprint[] {
    return this.getFingerprints().filter(fp => fp.service === service);
  }

  /**
   * Get fingerprints by severity
   */
  getFingerprintsBySeverity(severity: ErrorFingerprint['severity']): ErrorFingerprint[] {
    return this.getFingerprints().filter(fp => fp.severity === severity);
  }

  /**
   * Clear old fingerprints (cleanup)
   */
  cleanup(olderThanDays: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const toDelete: string[] = [];
    for (const [id, fingerprint] of this.fingerprints) {
      if (fingerprint.lastSeen < cutoffDate && fingerprint.status === 'resolved') {
        toDelete.push(id);
      }
    }

    toDelete.forEach(id => this.fingerprints.delete(id));

    if (toDelete.length > 0) {
      this.logger.info('Cleaned up old fingerprints', {
        deletedCount: toDelete.length,
        cutoffDate: cutoffDate.toISOString(),
      });
    }
  }
}

/**
 * Log Parser for different log formats
 */
export class LogParser {
  /**
   * Parse JSON structured logs
   */
  static parseJsonLog(logLine: string): LogEntry | null {
    try {
      const parsed = JSON.parse(logLine);
      return {
        timestamp: new Date(parsed.timestamp || Date.now()),
        level: parsed.level || 'info',
        message: parsed.message || '',
        service: parsed.service || 'unknown',
        requestId: parsed.requestId,
        userId: parsed.userId,
        stackTrace: parsed.stack || parsed.stackTrace,
        metadata: parsed,
      };
    } catch {
      // Invalid JSON format
      return null;
    }
  }

  /**
   * Parse standard application logs
   */
  static parseStandardLog(logLine: string): LogEntry | null {
    // Example: "2023-12-25T10:30:00.000Z [ERROR] user-service: Database connection failed"
    const regex = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\s+\[(\w+)\]\s+([^:]+):\s+(.+)$/;
    const match = regex.exec(logLine);

    if (!match) return null;

    return {
      timestamp: new Date(match[1]),
      level: match[2].toLowerCase() as LogEntry['level'],
      service: match[3].trim(),
      message: match[4].trim(),
      metadata: { rawLog: logLine },
    };
  }

  /**
   * Parse container logs (Docker format)
   */
  static parseContainerLog(logLine: string, containerName: string): LogEntry | null {
    // Try JSON first, then fallback to text
    const jsonEntry = this.parseJsonLog(logLine);
    if (jsonEntry) {
      jsonEntry.service = jsonEntry.service || containerName;
      return jsonEntry;
    }

    return {
      timestamp: new Date(),
      level: 'info',
      service: containerName,
      message: logLine,
      metadata: { rawLog: logLine },
    };
  }
}

export { SelfHealIngest as default };
