/**
 * @fileoverview Main Self-Healing Engine
 *
 * Core orchestrator for the self-healing system that coordinates
 * issue detection, analysis, patch generation, and validation.
 * Follows Functional Core / Imperative Shell pattern.
 */

import { Config, Logger, assertNonNull } from '@foundation/contracts';
import {
  ErrorInfo,
  IssueClassification,
  PatchProposal,
  SelfHealConfig,
  SelfHealResult,
  TestSuite,
  ValidationResult,
} from './types';

import { loadConfig } from '@foundation/config';

/**
 * Main engine for the self-healing system
 * Implements Functional Core / Imperative Shell pattern
 */
export class SelfHealEngine {
  private readonly config: SelfHealConfig;
  private readonly logger: Logger;
  private readonly configManager: Config;
  private isProcessing = false;

  constructor(dependencies: { logger: Logger; config?: Config }) {
    assertNonNull(dependencies, 'Dependencies must be provided');
    assertNonNull(dependencies.logger, 'Logger must be provided');

    this.logger = dependencies.logger;
    this.configManager = dependencies.config || loadConfig();
    this.config = this.createValidatedConfig(dependencies.logger, this.configManager);
  }

  /**
   * Create validated configuration with proper defaults
   */
  private createValidatedConfig(logger: Logger, configManager: Config): SelfHealConfig {
    const confidenceThreshold = configManager.get('SELFHEAL_CONFIDENCE_THRESHOLD', '0.8');
    const maxRetries = configManager.get('SELFHEAL_MAX_RETRIES', '3');

    const confidence = parseFloat(confidenceThreshold);
    const retries = parseInt(maxRetries, 10);

    if (isNaN(confidence) || confidence < 0 || confidence > 1) {
      throw new Error('SELFHEAL_CONFIDENCE_THRESHOLD must be a number between 0 and 1');
    }

    if (isNaN(retries) || retries < 1) {
      throw new Error('SELFHEAL_MAX_RETRIES must be a positive integer');
    }

    return {
      autoApply: configManager.get('SELFHEAL_AUTO_APPLY') === 'true',
      confidenceThreshold: confidence,
      maxRetries: retries,
      generateTests: configManager.get('SELFHEAL_GENERATE_TESTS') !== 'false',
      logger,
      config: configManager,
      prompts: {
        systemCore: '',
        classify: '',
        synthesizeTest: '',
        proposePatch: '',
        diffGuard: '',
        critiquePatch: '',
        commitMessage: '',
        pullRequestBody: '',
      },
    };
  }

  /**
   * Main entry point for self-healing process
   */
  async heal(errorInfo: ErrorInfo): Promise<SelfHealResult> {
    const startTime = new Date();
    const issueId = this.generateIssueId();

    try {
      if (this.isProcessing) {
        throw new Error('Self-healing process already in progress');
      }

      this.isProcessing = true;

      // Step 1: Classify the issue
      const classification = await this.classifyIssue(errorInfo);

      // Step 2: Generate patch proposal
      const patch = await this.proposePatch(errorInfo, classification);

      // Step 3: Validate the patch
      const validation = await this.validatePatch(patch);

      // Step 4: Generate tests
      const tests = await this.generateTests(patch, classification);

      // Step 5: Generate commit message and PR body
      const commitMessage = await this.generateCommitMessage(patch);
      const pullRequestBody = await this.generatePullRequestBody(
        patch,
        classification,
        validation,
        tests
      );

      const endTime = new Date();

      return {
        success: true,
        issueId,
        classification,
        patch,
        validation,
        tests,
        commitMessage,
        pullRequestBody,
        metadata: {
          startTime,
          endTime,
          duration: endTime.getTime() - startTime.getTime(),
          confidence: this.calculateOverallConfidence(classification, validation),
          automated: validation.recommendation === 'APPROVE',
        },
      };
    } catch (error) {
      const endTime = new Date();
      return {
        success: false,
        issueId,
        classification: await this.classifyIssue(errorInfo).catch(() => ({
          primaryCategory: 'unknown',
          subCategory: 'error',
          severity: 'high' as const,
          confidence: 0,
          affectedComponents: [],
          requiresExternalResources: false,
          estimatedComplexity: 'complex' as const,
          riskLevel: 'high' as const,
          traceId: this.generateTraceId(),
        })),
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          startTime,
          endTime,
          duration: endTime.getTime() - startTime.getTime(),
          confidence: 0,
          automated: false,
        },
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Classify the type of issue based on error information
   */
  private async classifyIssue(errorInfo: ErrorInfo): Promise<IssueClassification> {
    // Pure function - analyze error info without side effects
    const traceId = this.generateTraceId();

    this.logger.info('Classifying issue', {
      traceId,
      errorType: errorInfo.type,
      file: errorInfo.file,
    });

    // TODO: Implement LLM-based classification using prompts/10_task.classify.md

    // Placeholder implementation showing enhanced runtime error analysis
    const baseClassification: IssueClassification = {
      primaryCategory: 'runtime-error',
      subCategory: 'null-reference',
      severity: 'medium',
      confidence: 85,
      affectedComponents: [errorInfo.file || 'unknown'],
      requiresExternalResources: false,
      estimatedComplexity: 'moderate',
      riskLevel: 'medium',
      traceId,
    };

    // Add enhanced runtime error analysis for runtime errors
    if (baseClassification.primaryCategory === 'runtime-error') {
      baseClassification.runtimeErrorAnalysis = {
        rule: 'null',
        explanation: 'Null reference detected in function parameter validation',
        target: {
          file: errorInfo.file || 'unknown',
          startLine: errorInfo.line || 1,
          endLine: (errorInfo.line || 1) + 5,
        },
        suggested_strategy: [
          'Add assertNonNull on parameter at function entry',
          'Validate input before processing',
          'Early return with typed error code',
        ],
      };
    }

    return baseClassification;
  }

  /**
   * Generate a patch proposal for the identified issue
   */
  private async proposePatch(
    errorInfo: ErrorInfo,
    classification: IssueClassification
  ): Promise<PatchProposal> {
    // TODO: Implement LLM-based patch generation using prompts/30_task.propose_patch.md
    const traceId = this.generateTraceId();

    this.logger.info('Generating patch proposal', {
      traceId,
      primaryCategory: classification.primaryCategory,
      hasRuntimeAnalysis: !!classification.runtimeErrorAnalysis,
      file: errorInfo.file,
    });

    // Enhanced patch generation with DbC specialization
    const patchId = `patch-${Date.now()}`;
    let description = `Fix ${classification.primaryCategory} in ${errorInfo.file}`;
    const files = [];
    const dependencies = [];

    // For runtime errors with specialized analysis, generate DbC-based patch
    if (classification.runtimeErrorAnalysis) {
      const { rule, target, suggested_strategy } = classification.runtimeErrorAnalysis;
      
      description = `Fix ${rule} error in ${target.file} using DbC guards`;
      
      // Determine if @foundation/contracts import is needed
      let needsContractsImport = true; // TODO: Parse existing imports in target file
      
      if (needsContractsImport) {
        dependencies.push('@foundation/contracts');
      }

      // Create minimal patch file based on DbC rule
      files.push({
        path: target.file,
        changeType: 'MODIFY' as const,
        changes: [{
          lineStart: target.startLine,
          lineEnd: target.endLine,
          originalCode: '// TODO: Parse actual source code from target',
          newCode: `// TODO: Apply ${rule} DbC guard: ${suggested_strategy.join(', ')}`,
          reason: `Apply ${rule} validation using Design by Contract principles`,
        }],
      });
    }

    return {
      patchId,
      description,
      files,
      dependencies,
      riskAssessment: classification.riskLevel === 'high' ? 'high' : 'low',
      rollbackPlan: 'Revert commit to restore previous functionality',
    };
  }

  /**
   * Validate the proposed patch for safety and quality
   */
  private async validatePatch(patch: PatchProposal): Promise<ValidationResult> {
    const traceId = this.generateTraceId();

    this.logger.info('Validating patch', {
      traceId,
      patchId: patch.patchId,
    });

    // Placeholder implementation - would use comprehensive validation
    return {
      validationResult: 'PASS',
      criticalIssues: [],
      warnings: [],
      informational: [],
      overallRisk: 'low',
      recommendation: 'APPROVE',
      traceId,
      checklist: {
        typeChecking: 'pass',
        linting: 'pass',
        testing: 'pass',
        security: 'pass',
        performance: 'pass',
      },
    };
  }

  /**
   * Generate comprehensive test suite for the patch
   */
  private async generateTests(
    patch: PatchProposal,
    classification: IssueClassification
  ): Promise<TestSuite> {
    // TODO: Implement test generation using prompts/20_task.synthesize_test.md
    const traceId = this.generateTraceId();

    this.logger.info('Generating test suite', {
      traceId,
      patchId: patch.patchId,
      primaryCategory: classification.primaryCategory,
      hasRuntimeAnalysis: !!classification.runtimeErrorAnalysis,
    });

    // Enhanced test generation with regression test support
    const testFiles = [];

    // For runtime errors with specialized analysis, generate regression test
    if (classification.runtimeErrorAnalysis) {
      const { rule, target } = classification.runtimeErrorAnalysis;
      const fingerprint = `${rule}_${Date.now().toString(36)}`;

      testFiles.push({
        path: `tests/acceptance/regressions/err_${fingerprint}.spec.ts`,
        content: `/* Regression test for ${fingerprint}: ${rule} */
// Generated by SelfHeal-LLM test synthesis
// TODO: Implement using actual stack trace and public API analysis`,
        testType: 'regression' as const,
      });
    }

    // Add standard test files
    testFiles.push({
      path: `tests/unit/${patch.patchId}.test.ts`,
      content: '// Unit tests for the patch implementation',
      testType: 'unit' as const,
    });

    return {
      testId: `test-${patch.patchId}`,
      description: `Test suite for ${patch.description}`,
      files: testFiles,
      coverage: {
        statements: 90,
        branches: 85,
        functions: 95,
        lines: 88,
      },
    };
  }

  /**
   * Generate commit message for the patch
   */
  private async generateCommitMessage(patch: PatchProposal): Promise<string> {
    // TODO: Implement using prompts/50_task.commit_message.md

    // Placeholder implementation
    return `fix(selfheal): ${patch.description.toLowerCase()}\n\nGenerated by: SelfHeal-LLM\nPatch-ID: ${patch.patchId}`;
  }

  /**
   * Generate pull request body
   */
  private async generatePullRequestBody(
    patch: PatchProposal,
    classification: IssueClassification,
    validation: ValidationResult,
    tests: TestSuite
  ): Promise<string> {
    // TODO: Implement using prompts/60_task.pull_request_body.md

    // Placeholder implementation
    return `## 🤖 Automated Fix Summary\n\n**Issue**: ${classification.primaryCategory}\n**Solution**: ${patch.description}\n**Confidence**: ${classification.confidence}%\n\n*This PR was automatically generated by the SelfHeal-LLM system.*`;
  }

  /**
   * Generate unique issue ID
   */
  private generateIssueId(): string {
    return `AUTO-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate trace ID for observability
   */
  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Calculate overall confidence based on classification and validation
   */
  private calculateOverallConfidence(
    classification: IssueClassification,
    validation: ValidationResult
  ): number {
    const classificationConfidence = classification.confidence / 100;

    let validationConfidence: number;
    if (validation.validationResult === 'PASS') {
      validationConfidence = 1;
    } else if (validation.validationResult === 'WARN') {
      validationConfidence = 0.7;
    } else {
      validationConfidence = 0.3;
    }

    return Math.round(classificationConfidence * validationConfidence * 100);
  }
}
