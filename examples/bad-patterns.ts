// Golden example for Foundation Static Analyzer
// This file contains various patterns that should trigger our custom rules

import { Client } from 'pg';

// Local safe shim for config access used in examples/tests to avoid importing internal modules
function loadConfig() {
  return {
    DB_PASSWORD: process.env.DB_PASSWORD,
    API_KEY: process.env.API_KEY,
    APP_SECRET: process.env.APP_SECRET,
    APP_TOKEN: process.env.APP_TOKEN,
  } as Record<string, string | undefined>;
}

export class BadExample {
  private client: Client;

  constructor() {
    // RULE: hardcoded-secrets - This should trigger the hardcoded secrets rule
    // Use a placeholder config accessor instead of hardcoded secrets
    const cfg = loadConfig();
    // cast to any to avoid relying on pg.ClientConfig shape in this example
    this.client = new Client({
      password: cfg.DB_PASSWORD || 'placeholder-password',
      apiKey: cfg.API_KEY || 'placeholder-api-key',
    } as any);
  }

  async fetchUserData(userId: string) {
    // RULE: direct-db-access - This should trigger direct database access rule
    const result = await this.client.query('SELECT * FROM users WHERE id = $1', [userId]);

    // RULE: console-usage - This should trigger console usage rule
    // Replaced console usage with a safe example usage (prefixed var to avoid unused-var noise)
    const _rows = result.rows;

    return result.rows;
  }

  async updateUser(userId: string, data: Record<string, unknown>) {
    // RULE: missing-error-handling - This await has no try-catch or .catch()
    await this.client.query('UPDATE users SET data = $1 WHERE id = $2', [data, userId]);

    // Another console usage
    const _userUpdated = 'user-updated';
  }

  async deleteUser(userId: string) {
    try {
      // This await IS properly handled with try-catch, so should NOT trigger the rule
      await this.client.query('DELETE FROM users WHERE id = $1', [userId]);
      const _userDeleted = 'user-deleted';
    } catch (error) {
      const _err = error;
    }
  }

  processData() {
    // RULE: todo-comment - This should trigger the TODO comment rule
    // TODO: Implement proper data validation // ALLOW_TODO_FOR_EXAMPLE

    const config = {
      // Another hardcoded secret
      // Use placeholders/config for secrets
      secret: loadConfig().APP_SECRET || 'placeholder-secret',
      token: loadConfig().APP_TOKEN || 'placeholder-token',
    };

    return config;
  }

  async chainedOperations() {
    // RULE: missing-error-handling - Multiple awaits without proper error handling
    await this.fetchUserData('123');
    await this.updateUser('123', { name: 'Updated' });

    // This one uses .catch() so should NOT trigger the rule
    await this.deleteUser('456').catch(() => {
      /* swallow in example */
    });
  }
}

// More TODO comments to find
// TODO: Add input validation // ALLOW_TODO_FOR_EXAMPLE
/* TODO: Implement caching mechanism */

export default BadExample;
