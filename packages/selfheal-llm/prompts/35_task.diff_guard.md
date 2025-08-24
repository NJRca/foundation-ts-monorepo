# Task: Diff Guard

Analyze the proposed patch for potential issues, validate safety, and ensure compatibility before application.

## Validation Framework

### 1. Safety Analysis

- **Breaking Changes**: Identify any changes that could break existing APIs
- **Side Effects**: Analyze potential unintended consequences
- **Dependencies**: Verify all required dependencies are available
- **Rollback Safety**: Ensure changes can be safely reverted

### 2. Quality Assessment

- **Code Style**: Verify adherence to project coding standards
- **Type Safety**: Check TypeScript type compatibility
- **Performance Impact**: Assess potential performance implications
- **Security Implications**: Review for potential security vulnerabilities

### 3. Compatibility Checks

- **API Contracts**: Ensure existing interfaces remain unchanged
- **Backward Compatibility**: Verify no breaking changes for consumers
- **Platform Compatibility**: Check compatibility across target platforms
- **Version Constraints**: Validate against dependency version requirements

## Analysis Criteria

### Critical Issues (Must Fix)

- Breaking changes to public APIs
- Security vulnerabilities introduced
- Type errors or compilation failures
- Critical performance regressions

### Warning Issues (Should Address)

- Code style violations
- Missing error handling
- Incomplete test coverage
- Documentation gaps

### Informational Issues (Consider)

- Optimization opportunities
- Refactoring suggestions
- Alternative approaches
- Future maintenance concerns

## Validation Process

### 1. Static Analysis

```bash
# Type checking
tsc --noEmit

# Linting
eslint --ext .ts,.js src/

# Security scanning
npm audit

# Dependency analysis
depcheck
```

### 2. Test Validation

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# Coverage analysis
npm run test:coverage
```

### 3. Build Verification

```bash
# Clean build
npm run clean && npm run build

# Production build
npm run build:prod

# Bundle analysis
npm run analyze
```

## Risk Assessment Matrix

| Impact | Probability | Risk Level | Action Required    |
| ------ | ----------- | ---------- | ------------------ |
| High   | High        | Critical   | Block deployment   |
| High   | Medium      | High       | Require review     |
| High   | Low         | Medium     | Monitor closely    |
| Medium | High        | Medium     | Review recommended |
| Medium | Medium      | Low        | Standard process   |
| Low    | Any         | Low        | Proceed            |

## Output Format

```json
{
  "validationResult": "PASS|WARN|FAIL",
  "criticalIssues": [
    {
      "type": "string",
      "severity": "critical|high|medium|low",
      "description": "string",
      "location": "file:line",
      "recommendation": "string"
    }
  ],
  "warnings": [],
  "informational": [],
  "overallRisk": "low|medium|high|critical",
  "recommendation": "APPROVE|APPROVE_WITH_CHANGES|REJECT",
  "checklist": {
    "typeChecking": "pass|fail",
    "linting": "pass|fail",
    "testing": "pass|fail",
    "security": "pass|fail",
    "performance": "pass|fail"
  }
}
```

## Automated Checks

### Pre-Application Validation

- Syntax validation
- Type checking
- Import/export verification
- Test compilation

### Post-Application Validation

- Build success
- Test execution
- Runtime validation
- Integration testing

## Approval Criteria

A patch is approved if:

- [ ] No critical issues identified
- [ ] All automated checks pass
- [ ] Risk level is acceptable
- [ ] Proper test coverage exists
- [ ] Documentation is updated
- [ ] Rollback plan is defined
