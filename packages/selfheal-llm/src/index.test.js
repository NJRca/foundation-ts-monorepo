// Require the compiled package (dist) so Jest doesn't need to parse TypeScript
const { MockLLMClient, SUPPORTED_MODELS, createLLMClient } = require('../dist/index');

const jestGlobals = require('@jest/globals');
const { describe, it, expect, beforeEach } = jestGlobals;

// Minimal mock config used across tests
const mockConfig = {
  get: jest.fn().mockImplementation((key, defaultValue) => {
    const mockValues = {
      LLM_PROVIDER: 'mock',
      OPENAI_API_KEY: 'placeholder-test-openai-key',
      OPENAI_MODEL: 'gpt-4o-mini',
    };
    return mockValues[key] || defaultValue;
  }),
};

describe('LLM Integration (compiled)', () => {
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
    let mockClient;
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
  });
});
