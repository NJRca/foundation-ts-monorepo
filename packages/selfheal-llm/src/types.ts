/**
 * @fileoverview Type definitions for the Self-Healing LLM package
 */

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
 * Issue classification result
 */
export interface IssueClassification {
  primaryCategory: string;
  subCategory: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  affectedComponents: string[];
  requiresExternalResources: boolean;
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
  riskLevel: 'low' | 'medium' | 'high';
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
  validationResult: 'PASS' | 'WARN' | 'FAIL';
  criticalIssues: ValidationIssue[];
  warnings: ValidationIssue[];
  informational: ValidationIssue[];
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  recommendation: 'APPROVE' | 'APPROVE_WITH_CHANGES' | 'REJECT';
  checklist: {
    typeChecking: 'pass' | 'fail';
    linting: 'pass' | 'fail';
    testing: 'pass' | 'fail';
    security: 'pass' | 'fail';
    performance: 'pass' | 'fail';
  };
}

/**
 * Validation issue
 */
export interface ValidationIssue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  location: string;
  recommendation: string;
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
 * Self-healing operation result
 */
export interface SelfHealResult {
  success: boolean;
  issueId: string;
  classification: IssueClassification;
  patch?: PatchProposal;
  validation?: ValidationResult;
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
