import {
  LLMModel,
  MockLLMClient,
  OpenAIClient,
  SUPPORTED_MODELS,
  createLLMClient,
} from '../src/index';
// Import after mocking
import { beforeEach, describe, expect, it } from '@jest/globals';

import { Config } from '@foundation/contracts';

// Mock dependencies
    const mockConfig: Config = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: unknown) => {
        const mockValues: Record<string, unknown> = {
      LLM_PROVIDER: 'mock',
      // Use a clearly marked test-only placeholder key
      OPENAI_API_KEY: 'placeholder-test-openai-key',
      OPENAI_MODEL: 'gpt-4o-mini',
    };
        return (mockValues as Record<string, any>)[key] || (defaultValue as any);
  }),
} as any;

jest.mock('@foundation/observability', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('LLM Integration', () => {
  describe('LLM Client Creation', () => {
    it('should create mock client when useMock is true', async () => {
      const client = await createLLMClient(mockConfig, true);

      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(MockLLMClient);
    });

    it('should create appropriate client based on configuration', async () => {
      const client = await createLLMClient(mockConfig, false);

      expect(client).toBeDefined();
      expect(typeof client.complete).toBe('function');
      expect(typeof client.isConfigured).toBe('function');
      expect(typeof client.getAvailableModels).toBe('function');
    });
  });

  describe('Supported Models', () => {
    it('should have correct models for each provider', () => {
      expect(SUPPORTED_MODELS.openai).toContain('gpt-4o');
      expect(SUPPORTED_MODELS.openai).toContain('gpt-4o-mini');
      expect(SUPPORTED_MODELS.github).toContain('gpt-4o');
      expect(SUPPORTED_MODELS.ollama).toContain('llama3.1');
      expect(SUPPORTED_MODELS.mock).toContain('mock-gpt-4');
    });
  });

  describe('Mock LLM Client', () => {
    let mockClient: MockLLMClient;

    beforeEach(() => {
      mockClient = new MockLLMClient();
    });

    it('should be properly configured', () => {
      expect(mockClient.isConfigured()).toBe(true);
    });

    it('should return available models', () => {
      const models = mockClient.getAvailableModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });

    it('should generate mock completions', async () => {
      const response = await mockClient.complete({
        prompt: 'Fix this error: TypeError in function',
        model: 'mock-gpt-4',
        temperature: 0.7,
        maxTokens: 1000,
      });

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(response.model).toBe('mock-gpt-4');
      expect(typeof response.content).toBe('string');
    });

    it('should handle different prompt types', async () => {
      const systemPrompt = 'You are a code debugging assistant';
      const userPrompt = 'Analyze this error and suggest a fix';

      const response = await mockClient.complete({
        prompt: userPrompt,
        systemPrompt,
        model: 'mock-gpt-4',
      });

      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(0);
    });
  });

  describe('OpenAI Client Configuration', () => {
    it('should throw error when API key is missing', () => {
      const invalidConfig: Config = {
        get: jest.fn().mockReturnValue(undefined),
      } as any;

      expect(() => {
        const client = new OpenAIClient(invalidConfig);
        expect(client).toBeDefined();
      }).toThrow('OpenAI API key not configured');
    });

    it('should throw error when API key is placeholder', () => {
      const invalidConfig: Config = {
        get: jest.fn().mockReturnValue('your_openai_api_key_here'),
      } as any;

      expect(() => {
        const client = new OpenAIClient(invalidConfig);
        expect(client).toBeDefined();
      }).toThrow('OpenAI API key not configured');
    });

    it('should initialize with valid configuration', () => {
      const validConfig: Config = {
        get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
          if (key === 'OPENAI_API_KEY') return 'sk-test123';
          if (key === 'OPENAI_MODEL') return 'gpt-4o-mini';
          return defaultValue;
        }),
      } as any;

      expect(() => {
        const client = new OpenAIClient(validConfig);
        expect(client).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('LLM Request/Response Types', () => {
    it('should structure LLM requests correctly', () => {
      const request = {
        prompt: 'Analyze this error and suggest a fix',
        model: 'gpt-4o-mini' as LLMModel,
        temperature: 0.7,
        maxTokens: 1000,
        systemPrompt: 'You are a helpful debugging assistant',
      };

      expect(request.prompt).toBeDefined();
      expect(request.model).toBe('gpt-4o-mini');
      expect(request.temperature).toBe(0.7);
      expect(request.maxTokens).toBe(1000);
    });

    it('should handle LLM responses correctly', async () => {
      const mockClient = new MockLLMClient();

      const response = await mockClient.complete({
        prompt: 'Test prompt',
        model: 'mock-gpt-4',
      });

      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('model');
      expect(typeof response.content).toBe('string');
      expect(typeof response.model).toBe('string');
    });
  });

  describe('Factory Function', () => {
    it('should create appropriate client based on configuration', async () => {
      const client = await createLLMClient(mockConfig, true);

      expect(client).toBeInstanceOf(MockLLMClient);
      expect(client.isConfigured()).toBe(true);
    });

    it('should respect useMock parameter', async () => {
      const mockClient = await createLLMClient(mockConfig, true);
      const realClient = await createLLMClient(mockConfig, false);

      expect(mockClient).toBeInstanceOf(MockLLMClient);
      expect(realClient).toBeDefined();
    });
  });
});
