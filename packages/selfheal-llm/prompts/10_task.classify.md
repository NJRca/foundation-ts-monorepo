# Task: Issue Classification

Analyze the provided error information and classify the type of issue to determine the appropriate repair strategy.

## Input Analysis

You will receive:

- Error messages and stack traces
- Failed test outputs
- Build/compilation errors
- Runtime exceptions
- Performance metrics (if applicable)

## Classification Categories

### 1. Syntax Errors

- Missing semicolons, brackets, or parentheses
- Incorrect function/variable declarations
- Invalid TypeScript type annotations

### 2. Type Errors

- Type mismatches
- Missing type definitions
- Incorrect generic usage
- Interface/contract violations

### 3. Runtime Errors

- Null/undefined reference errors
- Property access on undefined objects
- Function call errors
- Async/await issues

### 4. Logic Errors

- Incorrect conditional statements
- Wrong loop implementations
- Algorithm flaws
- Business logic errors

### 5. Dependency Issues

- Missing imports/exports
- Version conflicts
- Package resolution failures
- Module loading errors

### 6. Configuration Errors

- Build tool configuration
- Environment variable issues
- Database connection problems
- Service configuration

### 7. Test Failures

- Assertion failures
- Mock/stub issues
- Test environment problems
- Coverage gaps

## Output Format

Provide a structured classification:

```json
{
  "primaryCategory": "string",
  "subCategory": "string",
  "severity": "low|medium|high|critical",
  "confidence": "number (0-100)",
  "affectedComponents": ["list of components"],
  "requiresExternalResources": boolean,
  "estimatedComplexity": "simple|moderate|complex",
  "riskLevel": "low|medium|high"
}
```

## Decision Matrix

- **Severity**: Based on impact on functionality and user experience
- **Complexity**: Estimated effort required for resolution
- **Risk**: Potential for unintended side effects
- **Resources**: Whether fix requires external dependencies or services
