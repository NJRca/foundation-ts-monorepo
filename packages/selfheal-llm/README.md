# Self-Healing LLM Package

An advanced TypeScript package that provides automated code analysis, repair, and testing capabilities using Large Language Models to create self-healing software systems.

## Features

- **🔍 Intelligent Issue Classification**: Automatically categorize and analyze code issues
- **🔧 Automated Patch Generation**: Generate targeted fixes for identified problems
- **✅ Comprehensive Validation**: Validate patches for safety, quality, and compatibility
- **🧪 Test Synthesis**: Create comprehensive test suites to validate fixes
- **📝 Documentation Generation**: Auto-generate commit messages and PR descriptions
- **🛡️ Safety-First Approach**: Ensure all changes are safe and reversible

## Installation

```bash
npm install @foundation/selfheal-llm
```

## Quick Start

```typescript
import { SelfHealEngine } from '@foundation/selfheal-llm';

// Initialize the self-healing engine
const engine = new SelfHealEngine({
  autoApply: false,           // Manual approval required
  confidenceThreshold: 0.8,   // High confidence threshold
  generateTests: true         // Generate comprehensive tests
});

// Analyze and fix an error
const errorInfo = {
  message: "Cannot read property 'id' of undefined",
  type: "TypeError",
  file: "src/user-service.ts",
  line: 42,
  stack: "..."
};

const result = await engine.heal(errorInfo);

if (result.success) {
  console.log(`Issue classified as: ${result.classification.primaryCategory}`);
  console.log(`Patch generated: ${result.patch?.description}`);
  console.log(`Validation result: ${result.validation?.validationResult}`);
  console.log(`Tests generated: ${result.tests?.files.length} test files`);
}
```

## Architecture

The package is built around several core components:

### SelfHealEngine
The main orchestrator that coordinates the entire self-healing process:
- Issue classification
- Patch proposal generation
- Validation and safety checks
- Test generation
- Documentation creation

### PromptManager
Manages LLM prompt templates for different tasks:
- System core prompts
- Issue classification prompts
- Patch generation prompts
- Validation prompts
- Test synthesis prompts

### PatchValidator
Validates proposed patches for:
- Syntax and type safety
- Security implications
- Performance impact
- Compatibility concerns

### TestSynthesizer
Generates comprehensive test suites:
- Unit tests for individual components
- Integration tests for component interactions
- Regression tests to prevent issue recurrence
- Performance tests when applicable

## Prompt Templates

The package includes specialized prompt templates for each task:

- `00_system.core.md` - Core system instructions
- `10_task.classify.md` - Issue classification guidelines
- `20_task.synthesize_test.md` - Test generation instructions
- `30_task.propose_patch.md` - Patch proposal guidelines
- `35_task.diff_guard.md` - Patch validation criteria
- `40_task.critique_patch.md` - Patch review framework
- `50_task.commit_message.md` - Commit message generation
- `60_task.pull_request_body.md` - PR description templates

## Configuration

```typescript
interface SelfHealConfig {
  autoApply: boolean;              // Automatically apply approved fixes
  confidenceThreshold: number;     // Minimum confidence for auto-application (0-1)
  maxRetries: number;              // Maximum retry attempts for failed operations
  generateTests: boolean;          // Generate test suites for patches
  prompts: {                       // Custom prompt templates
    systemCore: string;
    classify: string;
    synthesizeTest: string;
    proposePatch: string;
    diffGuard: string;
    critiquePatch: string;
    commitMessage: string;
    pullRequestBody: string;
  };
}
```

## Safety Features

- **Validation Pipeline**: Multi-stage validation before any changes
- **Risk Assessment**: Comprehensive risk analysis for each patch
- **Rollback Support**: All changes include rollback instructions
- **Test Coverage**: Mandatory test generation for all fixes
- **Human Oversight**: Optional human review for critical changes

## Integration Examples

### CI/CD Integration
```typescript
// In your CI pipeline
const engine = new SelfHealEngine({
  autoApply: process.env.NODE_ENV === 'development',
  confidenceThreshold: 0.9
});

// Monitor for build failures and auto-fix
if (buildFailed) {
  const result = await engine.heal(buildError);
  if (result.success && result.validation?.recommendation === 'APPROVE') {
    await applyPatch(result.patch);
    await runTests(result.tests);
  }
}
```

### Development Workflow
```typescript
// During development
const result = await engine.heal(runtimeError);

if (result.success) {
  // Review the proposed changes
  console.log('Proposed changes:', result.patch);
  console.log('Safety assessment:', result.validation);
  
  // Apply if approved
  if (userApproves(result)) {
    await applyPatch(result.patch);
  }
}
```

## Best Practices

1. **Start with Low Auto-Apply Thresholds**: Begin with manual review
2. **Monitor Validation Results**: Track success rates and adjust thresholds
3. **Maintain Test Coverage**: Ensure generated tests are comprehensive
4. **Review Security Implications**: Always review security-related changes
5. **Keep Rollback Plans**: Maintain ability to revert changes quickly

## Contributing

This package is part of the Foundation TypeScript Monorepo. See the main repository documentation for contribution guidelines.

## License

MIT License - see the main repository LICENSE file for details.
