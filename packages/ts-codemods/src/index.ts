/**
 * @intent: ts-codemods
 * Purpose: Collection of codemods used by the refactor toolchain to apply
 *          mechanical edits (add config loader, extract functional core, etc.).
 * Constraints: Keep transformations idempotent and reversible where possible; do
 *             not perform semantic-only edits that could change runtime behavior
 *             without explicit opt-in.
 */
export { addConfigLoader } from './add-config-loader.js';
export { addDbcGuards } from './add-dbc-guards.js';
export { addStranglerFacade } from './add-strangler-facade.js';
export { extractFunctionalCore } from './extract-functional-core.js';
export * from './types.js';
export { wrapAdapterResilience } from './wrap-adapter-resilience.js';
