const { describe, beforeEach, it, expect } = require('@jest/globals');
const { LogParser, SelfHealIngest } = require('../dist/index');

// Mock the EventBus and other dependencies
const mockEventBus = {
  publish: jest.fn().mockResolvedValue(undefined),
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

describe('SelfHealIngest', () => {
  let ingest;

  beforeEach(() => {
    ingest = new SelfHealIngest(mockEventBus);
    jest.clearAllMocks();
  });

  describe('log processing', () => {
    it('should process error logs and create fingerprints', async () => {
      const logEntry = {
        timestamp: new Date(),
        level: 'error',
        message: 'TypeError: Cannot read property "foo" of undefined',
        service: 'user-service',
        stackTrace: 'at function1 (file1.js:10:5)\nat function2 (file2.js:15:3)',
        requestId: 'req-123',
      };

      await ingest.processLogEntry(logEntry);

      // Should not throw an error
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should skip non-error logs', async () => {
      const logEntry = {
        timestamp: new Date(),
        level: 'info',
        message: 'User logged in successfully',
        service: 'user-service',
      };

      await ingest.processLogEntry(logEntry);

      // Should not publish events for info logs
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('should handle multiple similar errors', async () => {
      const logEntry1 = {
        timestamp: new Date(),
        level: 'error',
        message: 'TypeError: Cannot read property "test1" of undefined',
        service: 'user-service',
        stackTrace: 'at function1 (file1.js:10:5)',
      };

      const logEntry2 = {
        timestamp: new Date(),
        level: 'error',
        message: 'TypeError: Cannot read property "test2" of undefined',
        service: 'user-service',
        stackTrace: 'at function1 (file1.js:10:5)',
      };

      await ingest.processLogEntry(logEntry1);
      await ingest.processLogEntry(logEntry2);

      expect(mockEventBus.publish).toHaveBeenCalledTimes(2);
    });
  });
});

describe('LogParser', () => {
  describe('JSON log parsing', () => {
    it('should parse JSON formatted logs correctly', () => {
      const logLine =
        '{"timestamp":"2024-01-15T10:30:00Z","level":"error","message":"Database connection failed","service":"user-service"}';

      const parsed = LogParser.parseJsonLog(logLine);

      expect(parsed).toBeTruthy();
      expect(parsed.timestamp).toBeInstanceOf(Date);
      expect(parsed.level).toBe('error');
      expect(parsed.message).toBe('Database connection failed');
      expect(parsed.service).toBe('user-service');
    });

    it('should return null for invalid JSON', () => {
      const logLine = 'not valid json';

      const parsed = LogParser.parseJsonLog(logLine);

      expect(parsed).toBeNull();
    });
  });

  describe('Standard log parsing', () => {
    it('should parse standard formatted logs correctly', () => {
      const logLine = '2024-01-15T10:30:00.000Z [ERROR] user-service: Database connection failed';

      const parsed = LogParser.parseStandardLog(logLine);

      expect(parsed).toBeTruthy();
      expect(parsed.level).toBe('error');
      expect(parsed.message).toBe('Database connection failed');
      expect(parsed.service).toBe('user-service');
    });

    it('should return null for invalid format', () => {
      const logLine = 'invalid log format';

      const parsed = LogParser.parseStandardLog(logLine);

      expect(parsed).toBeNull();
    });
  });

  describe('Container log parsing', () => {
    it('should parse container logs with JSON content', () => {
      const logLine = '{"level":"error","message":"Connection refused","service":"api"}';
      const containerName = 'user-service-container';

      const parsed = LogParser.parseContainerLog(logLine, containerName);

      expect(parsed).toBeTruthy();
      expect(parsed.level).toBe('error');
      expect(parsed.message).toBe('Connection refused');
      expect(parsed.service).toBe('api');
    });

    it('should fallback to plain text for non-JSON container logs', () => {
      const logLine = 'Simple error message';
      const containerName = 'user-service-container';

      const parsed = LogParser.parseContainerLog(logLine, containerName);

      expect(parsed).toBeTruthy();
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('Simple error message');
      expect(parsed.service).toBe('user-service-container');
    });
  });
});
