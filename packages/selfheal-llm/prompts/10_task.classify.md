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

- Null/undefined reference errors (`null`)
- Division by zero errors (`divzero`)
- Array/string out of bounds access (`oob`)
- Not-a-Number (NaN) arithmetic issues (`nan`)
- Unreachable code execution (`unreachable`)
- Property access on undefined objects
- Function call errors
- Async/await issues
- Other runtime exceptions (`other`)

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

### Enhanced Runtime Error Analysis

When `primaryCategory` is "runtime-error", provide additional specialized analysis:

```json
{
  "runtimeErrorAnalysis": {
    "rule": "null|divzero|oob|nan|unreachable|other",
    "explanation": "1-2 sentences describing the specific runtime issue",
    "target": {
      "file": "{{filePath}}",
      "startLine": "{{functionStart}}",
      "endLine": "{{functionEnd}}"
    },
    "suggested_strategy": [
      "Add assertNonNull on parameter X",
      "Guard denominator before division Y",
      "Validate index vs array length L",
      "Add assertNumberFinite for value Z",
      "Add assertIndexInRange for array access",
      "Early return Result error with typed code"
    ]
  }
}
```

### DbC Strategy Mapping

- **null**: Use `assertNonNull(param, 'description')` from @foundation/contracts
- **divzero**: Add conditional guard before division operations
- **oob**: Use `assertIndexInRange(index, length, 'description')` for array/string access
- **nan**: Use `assertNumberFinite(value, 'description')` for arithmetic operations
- **unreachable**: Add early return with `fail('Should not reach this code path')`
- **other**: Apply appropriate validation based on error context

## Decision Matrix

- **Severity**: Based on impact on functionality and user experience
- **Complexity**: Estimated effort required for resolution
- **Risk**: Potential for unintended side effects
- **Resources**: Whether fix requires external dependencies or services

### Runtime Error Priority Guidelines

**High Priority (Critical/High Severity)**:

- `null`: Null pointer exceptions causing immediate crashes
- `divzero`: Division by zero in critical calculations
- `oob`: Buffer overflows or array access violations

**Medium Priority (Medium Severity)**:

- `nan`: NaN propagation affecting calculations
- `unreachable`: Logic errors leading to unexpected code paths

**Lower Priority (Low Severity)**:

- `other`: Non-critical runtime issues with graceful degradation

### Integration with Design by Contract

The runtime error analysis directly maps to @foundation/contracts validation functions:

- Enables surgical fixes with minimal code changes
- Provides consistent error handling patterns
- Maintains type safety and observability
- Supports automated patch generation with high confidence
