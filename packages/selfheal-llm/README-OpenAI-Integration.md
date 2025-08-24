# Self-Healing LLM - OpenAI Integration Guide

## Overview

The Self-Healing LLM system now includes secure OpenAI API integration with model selection capabilities. This guide covers setup, security best practices, and usage.

## 🔒 Security Setup

### 1. API Key Protection

**Never commit API keys to version control!** The repository includes proper `.gitignore` rules:

```gitignore
# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
```

### 2. Environment Configuration

Copy the example environment file and configure your API key:

```bash
cp .env.example .env
```

Edit `.env` with your OpenAI API key:

```bash
# OpenAI API Configuration
OPENAI_API_KEY=sk-your-actual-api-key-here
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1

# Self-Healing Configuration
SELFHEAL_CONFIDENCE_THRESHOLD=0.8
SELFHEAL_MAX_RETRIES=3
SELFHEAL_ENABLED=true
SELFHEAL_USE_MOCK_LLM=false
```

### 3. Production Security

For production deployments:

- **Environment Variables**: Use your platform's secrets management
- **AWS**: AWS Secrets Manager or Parameter Store
- **Azure**: Azure Key Vault
- **GCP**: Google Secret Manager
- **Kubernetes**: Kubernetes Secrets
- **Docker**: Docker Secrets

Example production environment variable setup:

```bash
export OPENAI_API_KEY="$OPENAI_API_KEY_SECRET"
export OPENAI_MODEL="gpt-4o-mini"
```

## 🤖 Model Selection

### Supported Models

| Model           | Use Case         | Cost   | Performance |
| --------------- | ---------------- | ------ | ----------- |
| `gpt-4o`        | Maximum accuracy | Higher | Excellent   |
| `gpt-4o-mini`   | **Recommended**  | Lower  | Very Good   |
| `gpt-4-turbo`   | Large context    | High   | Excellent   |
| `gpt-3.5-turbo` | Fast responses   | Lowest | Good        |

### Model Selection Guidelines

- **Development**: `gpt-4o-mini` (cost-effective, good performance)
- **Production**: `gpt-4o-mini` or `gpt-4o` (depending on accuracy needs)
- **Testing**: Use mock client (`SELFHEAL_USE_MOCK_LLM=true`)

## 💻 Usage Examples

### Basic Usage

```typescript
import { SelfHealEngine, createLLMClient } from '@foundation/selfheal-llm';
import { loadConfig } from '@foundation/config';

// Initialize with default configuration
const logger = console; // Use your logger
const config = loadConfig();

const engine = new SelfHealEngine({
  logger,
  config,
  llmModel: 'gpt-4o-mini', // Optional: override model
  useMockLLM: false, // Optional: use mock for testing
});

// Heal a runtime error
const errorInfo = {
  message: "TypeError: Cannot read property 'length' of undefined",
  stack: '...',
  type: 'TypeError',
  file: 'src/utils/string-helper.ts',
  line: 42,
  traceId: 'trace-123',
  errorCode: 'RUNTIME_ERROR',
};

const result = await engine.heal(errorInfo);

if (result.success) {
  console.log('Fix generated:', result.patch?.description);
  console.log('Commit message:', result.commitMessage);
  console.log('PR body:', result.pullRequestBody);
} else {
  console.error('Healing failed:', result.error);
}
```

### Advanced Configuration

```typescript
import { SelfHealEngine, OpenAIClient, MockLLMClient } from '@foundation/selfheal-llm';

// Custom LLM client
const llmClient = process.env.NODE_ENV === 'test' ? new MockLLMClient() : new OpenAIClient(config);

// Engine with specific model selection
const engine = new SelfHealEngine({
  logger: myLogger,
  config: myConfig,
  llmModel: 'gpt-4o', // Use high-accuracy model
  useMockLLM: false,
});

// Check if properly configured
const client = await createLLMClient(config);
console.log('Available models:', client.getAvailableModels());
console.log('Is configured:', client.isConfigured());
```

### Testing with Mock Client

```typescript
// For unit tests - no API calls made
const engine = new SelfHealEngine({
  logger: testLogger,
  config: testConfig,
  useMockLLM: true, // Use mock responses
});

// Mock client with custom responses
const mockClient = new MockLLMClient();
mockClient.addMockResponse(
  'classify',
  JSON.stringify({
    primaryCategory: 'null-reference',
    confidence: 0.95,
  })
);
```

## 🚀 Integration Examples

### CI/CD Integration

```yaml
# .github/workflows/selfheal.yml
name: Self-Healing
on:
  push:
    branches: [main]

jobs:
  selfheal:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run self-healing analysis
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          OPENAI_MODEL: gpt-4o-mini
        run: npm run selfheal
```

### Docker Integration

```dockerfile
# Dockerfile
FROM node:18-alpine

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build
RUN npm run build

# Runtime configuration
ENV OPENAI_MODEL=gpt-4o-mini
ENV SELFHEAL_CONFIDENCE_THRESHOLD=0.8

# Don't expose API key in Dockerfile!
# Use docker secrets or environment variables
CMD ["npm", "start"]
```

## 🔧 Configuration Reference

### Environment Variables

| Variable                        | Default                     | Description                       |
| ------------------------------- | --------------------------- | --------------------------------- |
| `OPENAI_API_KEY`                | _required_                  | Your OpenAI API key               |
| `OPENAI_MODEL`                  | `gpt-4o-mini`               | Model to use for completions      |
| `OPENAI_BASE_URL`               | `https://api.openai.com/v1` | API endpoint                      |
| `SELFHEAL_CONFIDENCE_THRESHOLD` | `0.8`                       | Minimum confidence for auto-apply |
| `SELFHEAL_MAX_RETRIES`          | `3`                         | Maximum retry attempts            |
| `SELFHEAL_ENABLED`              | `true`                      | Enable self-healing               |
| `SELFHEAL_USE_MOCK_LLM`         | `false`                     | Use mock client (testing)         |

### Model-Specific Configuration

```typescript
// Different models for different tasks
const engine = new SelfHealEngine({
  logger,
  config,
  llmModel: 'gpt-4o-mini', // Default for most operations
});

// Override model for specific requests
await engine.executeLLMRequest(
  prompt,
  systemPrompt,
  traceId,
  'gpt-4o' // Use higher accuracy model for critical fixes
);
```

## 🛡️ Security Best Practices

### 1. API Key Management

- ✅ Use environment variables
- ✅ Use secrets management in production
- ✅ Rotate keys regularly
- ❌ Never commit keys to git
- ❌ Never log API keys

### 2. Access Control

```typescript
// Validate API key format
if (!apiKey.startsWith('sk-')) {
  throw new Error('Invalid OpenAI API key format');
}

// Check configuration
if (!client.isConfigured()) {
  throw new Error('LLM client not properly configured');
}
```

### 3. Error Handling

```typescript
try {
  const result = await engine.heal(errorInfo);
} catch (error) {
  // Don't expose API errors to users
  logger.error('Self-healing failed', {
    error: error.message,
    traceId: errorInfo.traceId,
  });

  // Return safe error to user
  throw new Error('Self-healing service temporarily unavailable');
}
```

### 4. Rate Limiting

```typescript
// Implement rate limiting for API calls
const rateLimiter = new RateLimiter({
  tokensPerInterval: 100,
  interval: 'hour',
});

await rateLimiter.removeTokens(1);
const result = await engine.heal(errorInfo);
```

## 📊 Monitoring & Observability

### Cost Tracking

```typescript
// Monitor token usage
engine.on('llm-request', event => {
  console.log('Token usage:', {
    model: event.model,
    promptTokens: event.usage.promptTokens,
    completionTokens: event.usage.completionTokens,
    totalTokens: event.usage.totalTokens,
    estimatedCost: calculateCost(event.model, event.usage.totalTokens),
  });
});
```

### Error Monitoring

```typescript
// Track API failures
engine.on('llm-error', error => {
  metrics.increment('selfheal.llm.errors', {
    model: error.model,
    type: error.type,
  });
});
```

## 🔄 Migration & Upgrades

### From Mock to Real API

```typescript
// Start with mock for development
const engine = new SelfHealEngine({
  logger,
  config,
  useMockLLM: true,
});

// Switch to real API for production
const prodEngine = new SelfHealEngine({
  logger,
  config,
  llmModel: 'gpt-4o-mini',
  useMockLLM: false,
});
```

### Model Upgrades

```typescript
// Gradual rollout of new models
const model = config.get('FEATURE_FLAG_NEW_MODEL') === 'true' ? 'gpt-4o' : 'gpt-4o-mini';

const engine = new SelfHealEngine({
  logger,
  config,
  llmModel: model,
});
```

## 🆘 Troubleshooting

### Common Issues

1. **"OpenAI API key not configured"**
   - Check `.env` file exists and contains `OPENAI_API_KEY`
   - Verify key format starts with `sk-`
   - Ensure environment variables are loaded

2. **"OpenAI package not installed"**
   - Run `npm install openai`
   - Check package.json includes openai dependency

3. **"API request failed"**
   - Check API key validity
   - Verify network connectivity
   - Check rate limits
   - Review OpenAI API status

4. **High costs**
   - Use `gpt-4o-mini` for development
   - Implement rate limiting
   - Monitor token usage
   - Use mock client for testing

### Debug Mode

```bash
DEBUG=selfheal:* npm start
```

This comprehensive integration provides secure, configurable OpenAI API access with proper model selection and production-ready security practices.
