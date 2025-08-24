# Task: Generate PR Body for Self-Healing Patch

## Context

You are generating a concise Pull Request body for an automated self-healing patch that fixes runtime errors using Design by Contract (DbC) principles. The PR body should be informative, focused, and follow a standardized template.

## Instructions

Generate a markdown PR body that explains:

1. **What was fixed** - The specific runtime error and location
2. **How it was fixed** - The DbC guards and minimal changes made
3. **Validation** - Static analysis improvements and test coverage
4. **Verification** - Commands to validate the fix

## Template

Use this exact template structure:

````markdown
## Self-heal: {{rule}} ({{fingerprint}})

**Context:** {{symptom}} at {{filePath}}. See logs: {{logsUrl}}

**Change:**

- DbC guards added (contracts) within target function lines {{functionStart}}..{{functionEnd}}
- Minimal patch; no new dependencies
- Regression test: `tests/acceptance/regressions/err_{{fingerprint}}.spec.ts`

**Analyzer:**

- Before: {{analyzerBeforeSummary}}
- After: {{analyzerAfterSummary}} (no new High severity)

**Validation:**

```bash
{{TEST_CMD}}
```
````

```text

```

## Input Variables

- `{{rule}}`: DbC rule type (null, divzero, oob, nan, unreachable)
- `{{fingerprint}}`: Unique identifier for the fix
- `{{filePath}}`: Relative path to the fixed file
- `{{symptom}}`: Original error message or symptom description
- `{{logsUrl}}`: URL to observability logs for this error occurrence
- `{{functionStart}}`: Starting line number of the modified function
- `{{functionEnd}}`: Ending line number of the modified function
- `{{analyzerBeforeSummary}}`: Static analysis summary before the patch
- `{{analyzerAfterSummary}}`: Static analysis summary after the patch
- `{{TEST_CMD}}`: Command to run tests and validation (default: "pnpm test && pnpm analyze")

## Example Outputs

### Null Reference Fix

````markdown
## Self-heal: null (abc123)

**Context:** TypeError: Cannot read property 'length' of undefined at src/utils/string-helper.ts. See logs: https://logs.example.com/trace/xyz789

**Change:**

- DbC guards added (contracts) within target function lines 15..28
- Minimal patch; no new dependencies
- Regression test: `tests/acceptance/regressions/err_abc123.spec.ts`

**Analyzer:**

- Before: 3 errors, 2 warnings (1 High severity: null dereference)
- After: 2 errors, 1 warning (no new High severity)

**Validation:**

```bash
pnpm test && pnpm analyze
```
````

````

```text

### Division by Zero Fix

```markdown
## Self-heal: divzero (def456)

**Context:** Division by zero error in calculation at src/math/calculator.ts. See logs: https://logs.example.com/trace/abc123

**Change:**
- DbC guards added (contracts) within target function lines 42..55
- Minimal patch; no new dependencies
- Regression test: `tests/acceptance/regressions/err_def456.spec.ts`

**Analyzer:**
- Before: 1 error, 0 warnings (1 High severity: division by zero)
- After: 0 errors, 0 warnings (no new High severity)

**Validation:**

```bash
pnpm test && pnpm analyze
````

````

```text

### Array Bounds Fix

```markdown
## Self-heal: oob (ghi789)

**Context:** Array index out of bounds at src/data/array-processor.ts. See logs: https://logs.example.com/trace/def456

**Change:**
- DbC guards added (contracts) within target function lines 78..92
- Minimal patch; no new dependencies
- Regression test: `tests/acceptance/regressions/err_ghi789.spec.ts`

**Analyzer:**
- Before: 2 errors, 1 warning (1 High severity: array bounds violation)
- After: 1 error, 0 warnings (no new High severity)

**Validation:**

```bash
pnpm test && pnpm analyze
````

````

```text

## Guidelines

### Tone and Style
- **Concise**: Keep descriptions brief and focused
- **Technical**: Use precise technical language
- **Factual**: Stick to objective facts about the change
- **Professional**: Maintain a formal, automated tone

### Content Requirements
- **Always include** the fingerprint for traceability
- **Always mention** the DbC contracts approach
- **Always confirm** no new high-severity issues
- **Always provide** the validation command
- **Always link** to observability logs

### Formatting Standards
- Use markdown formatting consistently
- Include code blocks for validation commands
- Use bullet points for change descriptions
- Maintain consistent spacing and structure

### Error Handling
- If any variable is missing, use placeholder text: `{{variableName}}`
- If logs URL is unavailable, use: "Logs: See trace ID in commit message"
- If analyzer summaries are missing, use: "Static analysis: In progress"

## Quality Checklist

Before generating the PR body, ensure:

- [ ] Title includes rule type and fingerprint
- [ ] Context explains what error occurred and where
- [ ] Change section describes DbC approach and test coverage
- [ ] Analyzer section shows improvement in static analysis
- [ ] Validation section provides clear verification steps
- [ ] All template variables are properly substituted
- [ ] Markdown formatting is correct and consistent
- [ ] Content is concise but complete (target: 100-150 words)
````
