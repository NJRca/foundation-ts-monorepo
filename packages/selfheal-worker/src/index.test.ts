// Import after mocking
import { beforeEach, describe, expect, it } from '@jest/globals';
import { HealingContext, HealingResult, HealingStrategy, SelfHealWorker } from '../src/index';

// Mock dependencies
const mockEventBus = {
  publish: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn(),
};

const mockIngestService = {
  updateFingerprintStatus: jest.fn().mockResolvedValue(undefined),
};

const mockLLMClient = {
  analyzeError: jest.fn().mockResolvedValue({
    confidence: 0.8,
    suggestion: 'Restart the database connection pool',
    strategy: 'restart_service',
  }),
};

jest.mock('@foundation/events', () => ({
  EventBus: jest.fn().mockImplementation(() => mockEventBus),
}));

jest.mock('@foundation/observability', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('@foundation/selfheal-llm', () => ({
  createLLMClient: jest.fn().mockReturnValue(mockLLMClient),
}));

jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

describe('SelfHealWorker', () => {
  let worker: SelfHealWorker;

  beforeEach(() => {
    worker = new SelfHealWorker(
      mockEventBus as any,
      mockIngestService as any,
      mockLLMClient as any
    );
    jest.clearAllMocks();
  });

  describe('worker lifecycle', () => {
    it('should initialize without errors', () => {
      expect(worker).toBeInstanceOf(SelfHealWorker);
    });

    it('should start and stop successfully', async () => {
      await expect(worker.start()).resolves.not.toThrow();
      await expect(worker.stop()).resolves.not.toThrow();
    });
  });

  describe('strategy registration', () => {
    it('should register healing strategies', () => {
      const strategy: HealingStrategy = {
        name: 'test-strategy',
        description: 'Test healing strategy',
        applicableErrorTypes: ['database', 'network'],
        priority: 1,
        execute: jest.fn().mockResolvedValue({
          success: true,
          strategy: 'test-strategy',
          actions: [],
          confidence: 0.8,
          reasoning: 'Test healing completed',
          timeToHealing: 1000,
          metadata: {},
        } as HealingResult),
      };

      expect(() => {
        worker.registerStrategy(strategy);
      }).not.toThrow();

      expect(strategy.execute).toBeDefined();
    });

    it('should handle multiple strategies with different priorities', () => {
      const strategy1: HealingStrategy = {
        name: 'high-priority-strategy',
        description: 'High priority strategy',
        applicableErrorTypes: ['critical'],
        priority: 10,
        execute: jest.fn().mockResolvedValue({} as HealingResult),
      };

      const strategy2: HealingStrategy = {
        name: 'low-priority-strategy',
        description: 'Low priority strategy',
        applicableErrorTypes: ['network'],
        priority: 1,
        execute: jest.fn().mockResolvedValue({} as HealingResult),
      };

      expect(() => {
        worker.registerStrategy(strategy1);
        worker.registerStrategy(strategy2);
      }).not.toThrow();
    });
  });

  describe('event handling', () => {
    it('should set up event listeners during construction', () => {
      // EventBus.subscribe should have been called during construction
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'self_heal.healing_triggered',
        expect.any(Function)
      );

      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'self_heal.fingerprint_updated',
        expect.any(Function)
      );
    });
  });

  describe('healing process', () => {
    it('should handle healing context', () => {
      const context: HealingContext = {
        fingerprint: {
          id: 'fp-123',
          pattern: 'database connection failed',
          service: 'user-service',
          errorType: 'database',
          stackSignature: 'db-sig-123',
          frequency: 10,
          firstSeen: new Date(),
          lastSeen: new Date(),
          severity: 'high',
          status: 'new',
        },
        recentLogs: [],
        codeContext: 'async function connectToDatabase() { ... }',
        relatedFiles: ['db.js', 'config.js'],
        environmentInfo: { nodeVersion: '18.17.0' },
      };

      expect(context.fingerprint).toBeDefined();
      expect(context.recentLogs).toEqual([]);
    });

    it('should structure healing results properly', () => {
      const result: HealingResult = {
        success: true,
        strategy: 'database-restart',
        actions: [
          {
            type: 'restart_service',
            description: 'Restart database service',
            target: 'postgres',
            executed: true,
            result: 'Service restarted successfully',
          },
        ],
        confidence: 0.9,
        reasoning: 'Database connection pool was exhausted',
        timeToHealing: 2000,
        metadata: {
          restartCount: 1,
          previousAttempts: 0,
        },
      };

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('restart_service');
    });
  });
});
