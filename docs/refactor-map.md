# Refactor Map

This file tracks safe-first-pass refactors and intent anchors added by automated tooling.

- [x] `invoice.ts > calculateLateFee` → extracted to `utils/fees.ts`
  - Added `@intent`
  - Wrapped with `zod` contract
  - Verified snapshot consistency

- [ ] `performance` package safe-first pass
  - Files touched: `packages/performance/src/index.ts`, `packages/performance/src/monitoring.ts`
  - Added `@intent` anchors to major exported classes and functions
  - Added light runtime guards for decorator config (ttl, maxSize)
  - Notes: did not change public API shapes or remove/rename exports. Lint warnings may need follow-up (unused imports, broad `any` types left as-is to avoid behavioral changes).

- [ ] `observability`, `events`, `utils` packages safe-first pass - Files touched: - `packages/observability/src/index.ts` - `packages/events/src/index.ts` - `packages/utils/src/index.ts` - Added `@intent` anchors to major exported classes, enums, and helpers - Notes: additions are comments and low-risk guards; no exports renamed/removed.

- [ ] `api-gateway`, `config`, `security` packages safe-first pass - Files touched: - `packages/api-gateway/src/index.ts` - `packages/config/src/index.ts` - `packages/security/src/index.ts` - Added `@intent` anchors to major exported classes and helpers - Notes: low-risk comments only; no API changes.

- [ ] `contracts`, `analyzer`, `database` packages safe-first pass - Files touched: - `packages/contracts/src/index.ts` - `packages/analyzer/src/index.ts` - `packages/database/src/index.ts` - Added `@intent` anchors to core interfaces and top-level classes - Notes: comments only; no code behavior altered.

- [ ] `app`, `eslint-plugin-foundation`, `domain-sample` packages safe-first pass - Files touched: - `packages/app/src/index.ts` - `packages/eslint-plugin-foundation/src/index.ts` - `packages/domain-sample/src/index.ts` - Added `@intent` anchors to top-level health/server, linter configs, and sample services - Notes: comments only; no API changes.
