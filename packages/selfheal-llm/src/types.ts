/**
 * @fileoverview Type definitions for the Self-Healing LLM package
 */

import { Config, Logger } from '@foundation/contracts';

// Risk levels as type union
export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type ComplexityLevel = 'simple' | 'moderate' | 'complex';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ValidationStatus = 'pass' | 'fail';
export type ValidationResultType = 'PASS' | 'WARN' | 'FAIL';
export type RecommendationType = 'APPROVE' | 'APPROVE_WITH_CHANGES' | 'REJECT';

/**
 * Configuration for the self-healing system
 */
export interface SelfHealConfig {
  /** Enable automatic fix application */
  autoApply: boolean;
  /** Confidence threshold for automatic fixes (0-1) */
  confidenceThreshold: number;
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Enable test generation */
  generateTests: boolean;
  /** Logger instance for structured logging */
  logger: Logger;
  /** Configuration manager */
  config: Config;
  /** Prompt templates configuration */
  prompts: {
    systemCore: string;
    classify: string;
    synthesizeTest: string;
    proposePatch: string;
    diffGuard: string;
    critiquePatch: string;
    commitMessage: string;
    pullRequestBody: string;
  };
}

/**
 * Error information for analysis with observability
 */
export interface ErrorInfo {
  message: string;
  stack?: string;
  type: string;
  file?: string;
  line?: number;
  column?: number;
  context?: Record<string, any>;
  traceId: string;
  errorCode: string;
  riskBreadcrumb?: string[];
}

/**
 * Issue classification result
 */
export interface IssueClassification {
  primaryCategory: string;
  subCategory: string;
  severity: SeverityLevel;
  confidence: number;
  affectedComponents: string[];
  requiresExternalResources: boolean;
  estimatedComplexity: ComplexityLevel;
  riskLevel: RiskLevel;
  traceId: string;
  runtimeErrorAnalysis?: RuntimeErrorAnalysis;
}

/**
 * Enhanced runtime error analysis for DbC-based fixes
 */
export interface RuntimeErrorAnalysis {
  rule: 'null' | 'divzero' | 'oob' | 'nan' | 'unreachable' | 'other';
  explanation: string;
  target: {
    file: string;
    startLine: number;
    endLine: number;
  };
  suggested_strategy: string[];
}

/**
 * Code patch proposal
 */
export interface PatchProposal {
  patchId: string;
  description: string;
  files: FileChange[];
  dependencies: string[];
  riskAssessment: 'low' | 'medium' | 'high';
  rollbackPlan: string;
}

/**
 * File change description
 */
export interface FileChange {
  path: string;
  changeType: 'MODIFY' | 'ADD' | 'DELETE';
  changes: CodeChange[];
}

/**
 * Individual code change
 */
export interface CodeChange {
  lineStart: number;
  lineEnd: number;
  originalCode: string;
  newCode: string;
  reason: string;
}

/**
 * Patch validation result
 */
export interface ValidationResult {
  validationResult: ValidationResultType;
  criticalIssues: ValidationIssue[];
  warnings: ValidationIssue[];
  informational: ValidationIssue[];
  overallRisk: SeverityLevel;
  recommendation: RecommendationType;
  traceId: string;
  checklist: {
    typeChecking: ValidationStatus;
    linting: ValidationStatus;
    testing: ValidationStatus;
    security: ValidationStatus;
    performance: ValidationStatus;
  };
}

/**
 * Validation issue
 */
export interface ValidationIssue {
  type: string;
  severity: SeverityLevel;
  description: string;
  location: string;
  recommendation: string;
  errorCode: string;
  traceId: string;
}

/**
 * Test suite generated for validation
 */
export interface TestSuite {
  testId: string;
  description: string;
  files: TestFile[];
  coverage: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
}

/**
 * Test file description
 */
export interface TestFile {
  path: string;
  content: string;
  testType: 'unit' | 'integration' | 'regression' | 'performance';
}

/**
 * Error information for analysis
 */
export interface ErrorInfo {
  message: string;
  stack?: string;
  type: string;
  file?: string;
  line?: number;
  column?: number;
  context?: Record<string, any>;
}

/**
 * Patch critique result
 */
export interface PatchCritique {
  risks: string[];
  suggested_small_adjustments: string[];
  should_revise: boolean;
}

/**
 * Self-healing operation result
 */
export interface SelfHealResult {
  success: boolean;
  issueId: string;
  classification: IssueClassification;
  patch?: PatchProposal;
  validation?: ValidationResult;
  critique?: PatchCritique;
  tests?: TestSuite;
  commitMessage?: string;
  pullRequestBody?: string;
  error?: string;
  metadata: {
    startTime: Date;
    endTime: Date;
    duration: number;
    confidence: number;
    automated: boolean;
  };
}
