# LLM Playbook

Machine-readable guardrails and prompt primitives for automated and human-in-the-loop assistants working on this repository.

## Structure

- `rules.yaml` – Single source of truth for DbC enforcement, environment access, complexity budgets, analyzer gates, and testing expectations (validated by `schemas/rules.schema.json`).
- `schemas/` – JSON Schemas for validating playbook config.
- `prompts/` – Primitive prompt templates (classification, patch proposal, diff guard, critique, commit, PR body, synthetic test).
- `recipes/` – Higher-level remediation / refactor flows triggered by patterns.
- `policies/` – Inputs for repository policy gate scripts (e.g., `repo-policy.json`).
- `actions/` – Reusable CI workflow components (pipeline for build/analyze/test).

## Usage Modes

1. Tooling loads `rules.yaml` and enforces constraints before generating patches.
2. Diff guard evaluates proposed changes against hard (fail) and soft (warn) policies.
3. Recipes provide guided multi-step automation beyond a single patch (e.g., strangler pattern).
4. CI can import `actions/pipeline.yml` via `workflow_call` for consistent enforcement.

## Extending

- Add new rule fields: update `rules.schema.json` then extend `rules.yaml`.
- Add a recipe: create `NN-snake-case.yaml` with `id`, `summary`, `triggers`, `steps`, `successCriteria`.
- Add a prompt: keep format minimal, explicit JSON output contracts.

## Conventions

- All generated output JSON must be valid (no trailing commas, double quotes only).
- Patches must respect `complexityBudget.maxAddedLines` unless recipe explicitly overrides.
- DbC assertions limited to `allowedAssertions` list.

## Validation

You can validate the rules file with any JSON Schema validator after converting YAML to JSON.

## Roadmap Ideas

- Add SARIF delta integration for `analyzer` section
- Introduce performance budget section
- Add security static analysis gating
