/**
 * @fileoverview Self-Healing LLM Package
 *
 * This package provides automated code analysis, repair, and testing capabilities
 * using Large Language Models to create self-healing software systems.
 */

/**
 * @intent: selfheal-llm
 * Purpose: Provide LLM clients, engines, and utilities for generating repair
 * strategies and patch proposals. Keep hardware/network concerns in the client
 * implementations and keep higher-level orchestration side-effect free.
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
export { MockLLMClient, OpenAIClient, SUPPORTED_MODELS, createLLMClient } from './llm-client';
