import * as cron from 'node-cron';

import { DomainEvent, Logger } from '@foundation/contracts';
import { ErrorFingerprint, SelfHealIngest } from '@foundation/selfheal-ingest';
import { LLMClient } from '@foundation/selfheal-llm';

import { EventBus } from '@foundation/events';
import { createLogger } from '@foundation/observability';

export interface HealingStrategy {
  name: string;
  description: string;
  applicableErrorTypes: string[];
  priority: number;
  execute(context: HealingContext): Promise<HealingResult>;
}

export interface HealingContext {
  fingerprint: ErrorFingerprint;
  recentLogs: any[];
  codeContext?: string;
  relatedFiles?: string[];
  environmentInfo?: Record<string, any>;
}

export interface HealingResult {
  success: boolean;
  strategy: string;
  actions: HealingAction[];
  confidence: number;
  reasoning: string;
  timeToHealing: number;
  metadata?: Record<string, any>;
}

export interface HealingAction {
  type: 'code_fix' | 'config_change' | 'restart_service' | 'scale_resource' | 'dependency_update';
  description: string;
  target: string;
  content?: string;
  executed: boolean;
  result?: string;
}

/**
 * Self-Healing Worker
 *
 * Orchestrates the self-healing process by:
 * 1. Listening for healing trigger events
 * 2. Analyzing error patterns using LLM
 * 3. Applying appropriate healing strategies
 * 4. Monitoring healing effectiveness
 */
export class SelfHealWorker {
  private readonly logger: Logger;
  private readonly eventBus: EventBus;
  private readonly ingestService: SelfHealIngest;
  private readonly llmClient: LLMClient;
  private readonly strategies: Map<string, HealingStrategy> = new Map();
  private readonly activeHealings: Map<string, HealingResult> = new Map();
  private isRunning = false;

  constructor(
    eventBus: EventBus,
    ingestService: SelfHealIngest,
    llmClient: LLMClient,
    logger?: Logger
  ) {
    this.logger = logger || createLogger(true, 1, 'SelfHealWorker');
    this.eventBus = eventBus;
    this.ingestService = ingestService;
    this.llmClient = llmClient;

    this.registerDefaultStrategies();
    this.setupEventListeners();
  }

  /**
   * Start the worker and enable healing
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Self-heal worker is already running');
      return;
    }

    this.isRunning = true;

    // Schedule periodic healing assessment
    cron.schedule('*/5 * * * *', () => {
      this.assessActiveFingerprints();
    });

    // Schedule cleanup of old healing results
    cron.schedule('0 0 * * *', () => {
      this.cleanup();
    });

    this.logger.info('Self-heal worker started successfully');
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    this.logger.info('Self-heal worker stopped');
  }

  /**
   * Register a healing strategy
   */
  registerStrategy(strategy: HealingStrategy): void {
    this.strategies.set(strategy.name, strategy);
    this.logger.info(`Registered healing strategy: ${strategy.name}`, {
      strategy: strategy.name,
      errorTypes: strategy.applicableErrorTypes,
      priority: strategy.priority,
    });
  }

  /**
   * Setup event listeners for healing triggers
   */
  private setupEventListeners(): void {
    this.eventBus.subscribe('self_heal.healing_triggered', async (event: DomainEvent) => {
      await this.handleHealingTrigger(event);
    });

    this.eventBus.subscribe('self_heal.fingerprint_updated', async (event: DomainEvent) => {
      await this.handleFingerprintUpdate(event);
    });
  }

  /**
   * Handle healing trigger events
   */
  private async handleHealingTrigger(event: DomainEvent): Promise<void> {
    try {
      const { fingerprint } = event.eventData as { fingerprint: ErrorFingerprint };

      this.logger.info('Processing healing trigger', {
        fingerprintId: fingerprint.id,
        service: fingerprint.service,
        severity: fingerprint.severity,
        errorType: fingerprint.errorType,
      });

      // Check if already healing this fingerprint
      if (this.activeHealings.has(fingerprint.id)) {
        this.logger.warn('Healing already in progress for fingerprint', {
          fingerprintId: fingerprint.id,
        });
        return;
      }

      await this.initiateHealing(fingerprint);
    } catch (error) {
      this.logger.error('Failed to handle healing trigger', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventData: event.eventData,
      });
    }
  }

  /**
   * Handle fingerprint update events
   */
  private async handleFingerprintUpdate(event: DomainEvent): Promise<void> {
    const { fingerprint } = event.eventData as { fingerprint: ErrorFingerprint };

    // If frequency crosses critical threshold, escalate healing priority
    if (fingerprint.frequency >= 50 && fingerprint.severity === 'critical') {
      this.logger.warn('Critical error pattern detected, escalating healing', {
        fingerprintId: fingerprint.id,
        frequency: fingerprint.frequency,
        service: fingerprint.service,
      });

      await this.initiateHealing(fingerprint, true); // escalated = true
    }
  }

  /**
   * Initiate healing process for a fingerprint
   */
  private async initiateHealing(fingerprint: ErrorFingerprint, escalated = false): Promise<void> {
    const startTime = Date.now();

    try {
      // Update fingerprint status
      this.ingestService.updateFingerprintStatus(fingerprint.id, 'healing');

      // Build healing context
      const context = await this.buildHealingContext(fingerprint);

      // Select appropriate strategies
      const applicableStrategies = this.selectStrategies(fingerprint, escalated);

      this.logger.info('Starting healing process', {
        fingerprintId: fingerprint.id,
        strategiesCount: applicableStrategies.length,
        escalated,
      });

      // Try strategies in priority order
      let healingResult: HealingResult | null = null;

      for (const strategy of applicableStrategies) {
        try {
          this.logger.info(`Attempting healing strategy: ${strategy.name}`, {
            fingerprintId: fingerprint.id,
            strategy: strategy.name,
          });

          healingResult = await strategy.execute(context);

          if (healingResult.success && healingResult.confidence > 0.7) {
            this.logger.info('Healing strategy succeeded', {
              fingerprintId: fingerprint.id,
              strategy: strategy.name,
              confidence: healingResult.confidence,
            });
            break;
          }
        } catch (error) {
          this.logger.error(`Healing strategy failed: ${strategy.name}`, {
            fingerprintId: fingerprint.id,
            strategy: strategy.name,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      if (healingResult && healingResult.success) {
        // Mark as resolved and store result
        this.ingestService.updateFingerprintStatus(fingerprint.id, 'resolved');
        this.activeHealings.set(fingerprint.id, healingResult);

        // Emit healing completed event
        const completedEvent: DomainEvent = {
          aggregateId: fingerprint.id,
          eventType: 'self_heal.healing_completed',
          eventData: { fingerprint, healingResult },
          timestamp: new Date(),
          metadata: {
            strategy: healingResult.strategy,
            timeToHealing: Date.now() - startTime,
          },
        };

        await this.eventBus.publish(completedEvent);
      } else {
        // Mark as failed
        this.ingestService.updateFingerprintStatus(fingerprint.id, 'new');

        const failedEvent: DomainEvent = {
          aggregateId: fingerprint.id,
          eventType: 'self_heal.healing_failed',
          eventData: { fingerprint, reason: 'No effective strategy found' },
          timestamp: new Date(),
          metadata: {
            triedStrategies: applicableStrategies.length,
            timeSpent: Date.now() - startTime,
          },
        };

        await this.eventBus.publish(failedEvent);
      }
    } catch (error) {
      this.logger.error('Healing process failed', {
        fingerprintId: fingerprint.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      this.ingestService.updateFingerprintStatus(fingerprint.id, 'new');
    }
  }

  /**
   * Build healing context from fingerprint and related data
   */
  private async buildHealingContext(fingerprint: ErrorFingerprint): Promise<HealingContext> {
    // In a real implementation, this would gather:
    // - Recent logs from the affected service
    // - Code context around the error
    // - Configuration files
    // - System metrics and resource usage

    return {
      fingerprint,
      recentLogs: [], // Would be populated from log aggregation
      codeContext: '', // Would be populated from source control
      relatedFiles: [], // Would be detected from stack traces
      environmentInfo: {
        service: fingerprint.service,
        timestamp: new Date().toISOString(),
        frequency: fingerprint.frequency,
      },
    };
  }

  /**
   * Select appropriate healing strategies for a fingerprint
   */
  private selectStrategies(fingerprint: ErrorFingerprint, escalated = false): HealingStrategy[] {
    const strategies = Array.from(this.strategies.values())
      .filter(
        strategy =>
          strategy.applicableErrorTypes.includes(fingerprint.errorType) ||
          strategy.applicableErrorTypes.includes('*')
      )
      .sort((a, b) => {
        if (escalated) {
          // For escalated issues, prioritize more aggressive strategies
          return b.priority - a.priority;
        }
        return a.priority - b.priority;
      });

    return strategies;
  }

  /**
   * Assess active fingerprints for potential healing opportunities
   */
  private async assessActiveFingerprints(): Promise<void> {
    if (!this.isRunning) return;

    const fingerprints = this.ingestService
      .getFingerprints()
      .filter(fp => fp.status === 'new' && fp.severity !== 'low');

    this.logger.debug('Assessing fingerprints for healing', {
      totalFingerprints: fingerprints.length,
    });

    for (const fingerprint of fingerprints) {
      // Check if should trigger proactive healing
      const shouldHeal = this.shouldTriggerProactiveHealing(fingerprint);

      if (shouldHeal) {
        await this.initiateHealing(fingerprint);
      }
    }
  }

  /**
   * Determine if proactive healing should be triggered
   */
  private shouldTriggerProactiveHealing(fingerprint: ErrorFingerprint): boolean {
    // Trigger for medium+ severity that's been occurring for a while
    if (fingerprint.severity === 'medium' && fingerprint.frequency >= 5) {
      const timeSinceFirst = Date.now() - fingerprint.firstSeen.getTime();
      return timeSinceFirst > 10 * 60 * 1000; // 10 minutes
    }

    if (fingerprint.severity === 'high' && fingerprint.frequency >= 3) {
      return true;
    }

    if (fingerprint.severity === 'critical') {
      return true;
    }

    return false;
  }

  /**
   * Register default healing strategies
   */
  private registerDefaultStrategies(): void {
    // Database connection strategy
    this.registerStrategy({
      name: 'database_connection_healing',
      description: 'Heal database connection issues',
      applicableErrorTypes: ['database', 'connection', 'timeout'],
      priority: 1,
      execute: async (context: HealingContext): Promise<HealingResult> => {
        const actions: HealingAction[] = [
          {
            type: 'restart_service',
            description: 'Restart database connection pool',
            target: context.fingerprint.service,
            executed: false,
          },
        ];

        return {
          success: true,
          strategy: 'database_connection_healing',
          actions,
          confidence: 0.8,
          reasoning: 'Database connection issues typically resolve with connection pool restart',
          timeToHealing: 30000, // 30 seconds
          metadata: { pattern: context.fingerprint.pattern },
        };
      },
    });

    // Network timeout strategy
    this.registerStrategy({
      name: 'network_timeout_healing',
      description: 'Heal network timeout issues',
      applicableErrorTypes: ['network', 'timeout'],
      priority: 2,
      execute: async (context: HealingContext): Promise<HealingResult> => {
        const actions: HealingAction[] = [
          {
            type: 'config_change',
            description: 'Increase timeout values',
            target: `${context.fingerprint.service}/config`,
            executed: false,
          },
        ];

        return {
          success: true,
          strategy: 'network_timeout_healing',
          actions,
          confidence: 0.75,
          reasoning: 'Network timeouts often resolve with increased timeout configuration',
          timeToHealing: 60000, // 1 minute
        };
      },
    });

    // LLM-powered generic strategy
    this.registerStrategy({
      name: 'llm_generic_healing',
      description: 'Use LLM to analyze and suggest fixes',
      applicableErrorTypes: ['*'], // Applies to all error types
      priority: 10, // Lower priority, used as fallback
      execute: async (context: HealingContext): Promise<HealingResult> => {
        return await this.llmHealingStrategy(context);
      },
    });
  }

  /**
   * LLM-powered healing strategy
   */
  private async llmHealingStrategy(context: HealingContext): Promise<HealingResult> {
    try {
      const prompt = this.buildLLMPrompt(context);

      const response = await this.llmClient.complete({
        prompt,
        systemPrompt:
          'You are a senior software engineer specialized in debugging and fixing production issues.',
        temperature: 0.1, // Low temperature for consistent, focused responses
        maxTokens: 1000,
      });

      // Parse LLM response to extract healing actions
      const healingActions = this.parseLLMResponse(response.content);

      return {
        success: healingActions.length > 0,
        strategy: 'llm_generic_healing',
        actions: healingActions,
        confidence: 0.6, // Conservative confidence for LLM suggestions
        reasoning: response.content,
        timeToHealing: 300000, // 5 minutes for LLM analysis + implementation
        metadata: {
          model: response.model,
          tokens: response.usage?.totalTokens,
        },
      };
    } catch (error) {
      this.logger.error('LLM healing strategy failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        strategy: 'llm_generic_healing',
        actions: [],
        confidence: 0,
        reasoning: 'Failed to analyze error with LLM',
        timeToHealing: 0,
      };
    }
  }

  /**
   * Build prompt for LLM analysis
   */
  private buildLLMPrompt(context: HealingContext): string {
    return `
Analyze this production error and suggest specific healing actions:

Error Details:
- Service: ${context.fingerprint.service}
- Error Type: ${context.fingerprint.errorType}
- Pattern: ${context.fingerprint.pattern}
- Frequency: ${context.fingerprint.frequency} occurrences
- Severity: ${context.fingerprint.severity}
- First Seen: ${context.fingerprint.firstSeen.toISOString()}
- Last Seen: ${context.fingerprint.lastSeen.toISOString()}

Environment Context:
${JSON.stringify(context.environmentInfo, null, 2)}

Please provide:
1. Root cause analysis
2. Specific healing actions (code_fix, config_change, restart_service, scale_resource, dependency_update)
3. Priority order for actions
4. Expected resolution time

Format your response as JSON with this structure:
{
  "analysis": "Root cause analysis",
  "actions": [
    {
      "type": "action_type",
      "description": "What to do",
      "target": "where to apply",
      "content": "specific changes if applicable"
    }
  ],
  "confidence": 0.8
}
`;
  }

  /**
   * Parse LLM response into healing actions
   */
  private parseLLMResponse(response: string): HealingAction[] {
    try {
      const parsed = JSON.parse(response);

      return (parsed.actions || []).map((action: any) => ({
        type: action.type || 'code_fix',
        description: action.description || 'LLM suggested action',
        target: action.target || 'unknown',
        content: action.content,
        executed: false,
      }));
    } catch {
      // Fallback: parse text response for common patterns
      const actions: HealingAction[] = [];

      if (response.toLowerCase().includes('restart')) {
        actions.push({
          type: 'restart_service',
          description: 'Restart service based on LLM analysis',
          target: 'service',
          executed: false,
        });
      }

      if (response.toLowerCase().includes('config')) {
        actions.push({
          type: 'config_change',
          description: 'Update configuration based on LLM analysis',
          target: 'config',
          executed: false,
        });
      }

      return actions;
    }
  }

  /**
   * Get healing statistics
   */
  getHealingStats(): Record<string, any> {
    const fingerprints = this.ingestService.getFingerprints();

    return {
      totalFingerprints: fingerprints.length,
      resolvedFingerprints: fingerprints.filter(fp => fp.status === 'resolved').length,
      activeHealings: this.activeHealings.size,
      strategies: this.strategies.size,
      severityBreakdown: {
        low: fingerprints.filter(fp => fp.severity === 'low').length,
        medium: fingerprints.filter(fp => fp.severity === 'medium').length,
        high: fingerprints.filter(fp => fp.severity === 'high').length,
        critical: fingerprints.filter(fp => fp.severity === 'critical').length,
      },
    };
  }

  /**
   * Cleanup old healing results
   */
  private cleanup(): void {
    // Clean up old active healings
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours

    for (const [fingerprintId, result] of this.activeHealings) {
      if (result.timeToHealing < cutoffTime) {
        this.activeHealings.delete(fingerprintId);
      }
    }

    // Clean up old fingerprints in ingest service
    this.ingestService.cleanup(7); // 7 days

    this.logger.info('Completed healing cleanup', {
      activeHealings: this.activeHealings.size,
    });
  }
}

export { SelfHealWorker as default };
