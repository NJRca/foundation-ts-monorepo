# Playbook Rules Cheatsheet (Agent Anchors)

Purpose: Self-healing refactors for TypeScript monorepos. Agents MUST follow these anchors plus canonical `playbook/rules.yaml`.

---

## R0. Observability and Risk Breadcrumbs

Rule: Emit structured logs with traceId and riskBreadcrumb(rule, details) on defensive paths (null-guard fallbacks, divide-by-zero clamps, circuit trips).
Why: Breadcrumbs create stable incident fingerprints for detect → classify → fix.
Enforcement: Visual; optional grep in `refactor-kit scan`.

Example:

```ts
import { createLogger, riskBreadcrumb } from '@foundation/observability';
const log = createLogger('mod');
function safeDivide(a: number, b: number) {
  if (b === 0) {
    riskBreadcrumb('divzero', { b });
    return 0;
  }
  return a / b;
}
```

## R1. Contracts (Design by Contract)

Source: rules.yaml > contracts
Goal: Every exported function defends inputs early using `assertNonNull`, `assertNumberFinite`, `assertIndexInRange`, `fail`.
ESLint: `require-dbc-on-exported`
Good:

```ts
export function createUser(id: number, name: string) {
  assertNumberFinite(id, 'id');
  assertNonNull(name, 'name'); /* ... */
}
```

Anti-pattern (triggers ESLint rule): direct logic before any assertion.

## R2. Env Access Centralization

Source: rules.yaml > envAccess
Rule: No `process.env.*` outside `packages/config/src`.
Codemod: `addConfigLoader`

```ts
import { loadConfig } from '@foundation/config';
const key = loadConfig().API_KEY;
```

Violation triggers: CLI `guard`, ESLint `no-process-env-outside-config`.

## R3. Complexity Budget

Source: rules.yaml > complexityBudget
Limits: maxAddedLines: 40, soft maxFunctionLength: 120, maxCyclomatic: 12.
Marker: `ALLOW_COMPLEXITY_DELTA` with justification.
Action: Prefer `extractFunctionalCore`.

Signals:

- > 40 added lines: propose split / multiple commits.
- Large function: extract core via `extractFunctionalCore`.

If exceeding, add `ALLOW_COMPLEXITY_DELTA` with one-line rationale.

## R4. Static Analyzer Gate

Source: rules.yaml > analyzer
Gate: `severityGate: high`, `failOnNew: true` (changed files).
Meaning: No new HIGH (or worse) findings in SARIF vs baseline.
Action: Fix (preferred) OR temporarily justify (future annotation file TBD) before merge.

## R5. Testing Requirements

Source: rules.yaml > testing
Rule: `requireNewTest: true` when behavior changes; acceptance tests in `tests/acceptance`.
Generated name: `<file>.generated.test.ts`

## R5.1 Regression Test From Incident

Rule: For incidents with stack traces, create `tests/acceptance/regressions/err_<fingerprint>.spec.ts` failing before and passing after the fix.
Why: Converts crashes into permanent protections.

## R6. Functional Core Extraction

Recipe: 03-functional-core
Heuristic: If function > 40 lines AND mixes I/O, extract \*Core pure fn; shell validates inputs and handles effects.
Marker: `CORE_EXTRACTED`.

## R7. Strangler Facade

Recipe: 04-strangler
Flags: `MIRROR` (dual-run + diff log), `ENABLE` (switch over).
Marker: `STRANGLER_FACADE`.

## R8. Resilience Wrapping

Recipe: resilience
Rule: Wrap outbound adapters with small retry + timeout + circuit breaker.
Marker: `RESILIENCE_WRAPPED`.

## R9. Scan & Guard Workflow

CLI:

- `refactor-kit scan` → JSON report (env violations, complexity, analyzer)
- `refactor-kit guard` → enforce env/DbC rules
- `refactor-kit apply <recipe>` → run codemods first; else emit plan

## R10. Patch Scope Limitation

Rule: `contracts.patchScope: function-range-only`. Automated patches must stay within the specified function range; only import edits allowed outside.

## R11. Commit / PR Hygiene

Commits: Conventional (`fix:`, `refactor(<recipe>): ...`).
PR body sections: Summary, Change Detail, Validation, Risks & Mitigations, Checklist (Mikado link, Analyzer delta, Boy-Scout cleanup).

## R12. Complexity Delta Process

Script: `scripts/complexity-diff.js` maintains `playbook/.complexity-baseline.json`.
If positive delta: add `ALLOW_COMPLEXITY_DELTA` + rationale.
ESLint: `complexity-delta-justified`.

## R13. Priority Ordering Cheat (When Multiple Issues)

1. Security / High analyzer findings (R4)
2. Env access violations (R2)
3. Missing contracts (R1)
4. Complexity overflow (R3 / R12)
5. Testing gaps (R5 / R5.1)
6. Architecture extraction (R6 / R7 / R8)

## R14. Safe Automation Markers Summary

| Marker                   | Purpose                     |
| ------------------------ | --------------------------- |
| `CORE_EXTRACTED`         | Functional core isolated    |
| `STRANGLER_FACADE`       | Legacy facade present       |
| `RESILIENCE_WRAPPED`     | Adapter resilience applied  |
| `ALLOW_COMPLEXITY_DELTA` | Intentional complexity rise |

## Usage Guidance for Agents

1. Load `playbook/rules.yaml`; map task to R0–R14.
2. Run deterministic codemods before free‑form patching.
3. Keep patch ≤ 40 added lines unless justified.
4. Always add/adjust tests (R5 / R5.1).
5. Fail fast if env or analyzer gates violated; propose remediation steps.

---

<!-- <200 lines limit respected -->
