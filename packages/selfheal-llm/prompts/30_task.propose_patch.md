# Task: Propose Code Patch

Generate a targeted code patch that resolves the identified issue while maintaining system integrity and code quality.

## Patch Development Process

### 1. Root Cause Analysis

- Identify the exact location and nature of the issue
- Understand the context and dependencies
- Analyze the impact scope

### 2. Solution Design

- Design minimal invasive fix
- Consider alternative approaches
- Evaluate trade-offs and implications

### 3. Implementation Planning

- Break down changes into atomic units
- Plan the order of changes
- Identify dependencies and prerequisites

## Patch Requirements

### Code Quality Standards

- Follow existing code style and patterns
- Maintain TypeScript type safety
- Preserve existing API contracts
- Ensure backward compatibility

### Safety Principles

- Minimal surface area of change
- No breaking changes to public APIs
- Preserve existing functionality
- Include proper error handling

### Documentation Requirements

- Clear inline comments for complex logic
- Update relevant documentation
- Explain the reasoning behind the fix
- Document any assumptions or limitations

## Patch Format

### File Changes

```typescript
// File: path/to/file.ts
// Change Type: [ADD|MODIFY|DELETE]
// Reason: Brief explanation of why this change is needed

// BEFORE (if modifying existing code)
function originalFunction() {
  // existing implementation
}

// AFTER
function fixedFunction() {
  // corrected implementation with explanation
}
```

### Change Categories

1. **Bug Fixes**
   - Correct logic errors
   - Fix type mismatches
   - Handle edge cases

2. **Error Handling**
   - Add try-catch blocks
   - Validate inputs
   - Improve error messages

3. **Type Safety**
   - Add missing type annotations
   - Fix type definitions
   - Improve generic constraints

4. **Performance Improvements**
   - Optimize algorithms
   - Reduce memory usage
   - Improve async handling

## Validation Checklist

Before proposing a patch, ensure:

- [ ] Fix addresses the root cause
- [ ] No new TypeScript errors introduced
- [ ] Existing tests still pass
- [ ] New tests validate the fix
- [ ] No breaking changes to APIs
- [ ] Performance impact is acceptable
- [ ] Code style is consistent
- [ ] Error handling is appropriate

## Output Structure

```json
{
  "patchId": "unique-identifier",
  "description": "Brief description of the fix",
  "files": [
    {
      "path": "relative/path/to/file.ts",
      "changeType": "MODIFY|ADD|DELETE",
      "changes": [
        {
          "lineStart": 10,
          "lineEnd": 15,
          "originalCode": "...",
          "newCode": "...",
          "reason": "Explanation"
        }
      ]
    }
  ],
  "dependencies": ["list of required packages"],
  "riskAssessment": "low|medium|high",
  "rollbackPlan": "Description of how to revert"
}
```

## Testing Integration

Each patch should include:

- Unit tests for the specific fix
- Integration tests for affected components
- Regression tests to prevent recurrence
- Performance benchmarks if applicable
