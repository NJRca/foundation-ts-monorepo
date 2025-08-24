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
- Apply Design by Contract (DbC) at function boundaries
- Use early returns with typed error codes over deep throwing
- Ensure static analyzer compliance (no new High severity warnings)

### Design by Contract Integration

When applying DbC principles for runtime error fixes:

- **Function Boundary Validation**: Use `@foundation/contracts` assertions at entry points
- **Input Validation**: Apply `assertNonNull`, `assertNumberFinite`, `assertIndexInRange` as needed
- **Error Path Handling**: Use `fail()` for unreachable code paths
- **Minimal Scope**: Modify only the specified function range unless import needed
- **Type Safety**: Preserve existing API types, maintain backward compatibility

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

## Specialized DbC Minimal Patches

### Task: Produce a minimal patch that fixes the error by applying DbC at the boundary and safe guards inside the specified function range

**Constraints:**

- Modify ONLY `{{filePath}}` and ONLY lines `{{functionStart}}..{{functionEnd}}` unless a tiny import of contracts is needed
- Use contracts from `@foundation/contracts` (`assertNonNull`, `assertNumberFinite`, `assertIndexInRange`, `fail`)
- Do NOT add dependencies. Do NOT change public API types unless strictly necessary; if you must, keep it backward compatible
- Prefer early return with typed error codes over throwing in deep layers
- Avoid changing behavior unrelated to the failure
- Ensure static analyzer will not introduce new High severity warnings

**Context Template:**

- RULE: `{{rule}}`
- STACK (redacted): `<<<STACK::{{stack}}>>>`
- FILE PATH: `{{filePath}}`
- FUNCTION RANGE: `{{functionStart}}..{{functionEnd}}`
- SOURCE: `<<<SOURCE::START>>>{{source}}<<<SOURCE::END>>>`

**Output Format:**

- **Unified diff only**
- Absolute or repo-root relative paths are fine
- **No prose, no extra fences**

**DbC Rule Application:**

- `null`: Add `assertNonNull(param, 'Parameter description')` at function entry
- `divzero`: Add conditional guard before division with early return
- `oob`: Add `assertIndexInRange(index, length, 'Index description')` before array access
- `nan`: Add `assertNumberFinite(value, 'Value description')` for arithmetic operations
- `unreachable`: Add `fail('Should not reach this code path')` for impossible conditions
- `other`: Apply appropriate validation based on error context

**Example Patch Structure:**

```diff
--- a/src/example.ts
+++ b/src/example.ts
@@ -1,5 +1,6 @@
+import { assertNonNull } from '@foundation/contracts';
 
 function processData(input: Data | null): Result {
+  assertNonNull(input, 'Input data cannot be null');
   return input.process();
 }
```
