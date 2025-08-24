/**
 * @fileoverview Self-Healing LLM Package
 *
 * This package provides automated code analysis, repair, and testing capabilities
 * using Large Language Models to create self-healing software systems.
 */

export * from './llm-client';
export * from './patch-validator';
export * from './prompt-manager';
export * from './selfheal-engine';
export * from './test-synthesizer';
export * from './types';

// Re-export commonly used types and interfaces
export type {
  IssueClassification,
  PatchProposal,
  SelfHealConfig,
  TestSuite,
  ValidationResult,
} from './types';

export type { LLMClient, LLMModel, LLMRequest, LLMResponse } from './llm-client';

// Main entry point for the self-healing system
export { SelfHealEngine as default } from './selfheal-engine';

// LLM client factory and implementations
export { createLLMClient, MockLLMClient, OpenAIClient, SUPPORTED_MODELS } from './llm-client';
