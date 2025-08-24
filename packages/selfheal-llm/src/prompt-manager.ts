/**
 * @fileoverview Prompt Manager
 * 
 * Manages loading and processing of prompt templates for the self-healing system.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Manager for prompt templates used in the self-healing process
 */
export class PromptManager {
  private readonly promptsDir: string;
  private promptCache: Map<string, string> = new Map();

  constructor(promptsDir?: string) {
    this.promptsDir = promptsDir || join(__dirname, '..', 'prompts');
  }

  /**
   * Load a prompt template by name
   */
  loadPrompt(promptName: string): string {
    if (this.promptCache.has(promptName)) {
      return this.promptCache.get(promptName)!;
    }

    const promptPath = join(this.promptsDir, `${promptName}.md`);
    
    try {
      const content = readFileSync(promptPath, 'utf-8');
      this.promptCache.set(promptName, content);
      return content;
    } catch (error) {
      throw new Error(`Failed to load prompt '${promptName}': ${error}`);
    }
  }

  /**
   * Load all available prompts
   */
  loadAllPrompts(): Record<string, string> {
    const prompts = [
      '00_system.core',
      '10_task.classify', 
      '20_task.synthesize_test',
      '30_task.propose_patch',
      '35_task.diff_guard',
      '40_task.critique_patch',
      '50_task.commit_message',
      '60_task.pull_request_body'
    ];

    const result: Record<string, string> = {};
    
    for (const prompt of prompts) {
      result[prompt] = this.loadPrompt(prompt);
    }

    return result;
  }

  /**
   * Process a prompt template with variables
   */
  processTemplate(template: string, variables: Record<string, any>): string {
    let processed = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      processed = processed.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return processed;
  }

  /**
   * Clear the prompt cache
   */
  clearCache(): void {
    this.promptCache.clear();
  }
}
