// Golden example for Foundation Static Analyzer
// This file contains various patterns that should trigger our custom rules

import { Client } from 'pg';

export class BadExample {
  private client: Client;

  constructor() {
    // RULE: hardcoded-secrets - This should trigger the hardcoded secrets rule
    this.client = new Client({
      password: 'hardcoded-password-123',
      api_key: 'sk-hardcoded-api-key-xyz',
    });
  }

  async fetchUserData(userId: string) {
    // RULE: direct-db-access - This should trigger direct database access rule
    const result = await this.client.query('SELECT * FROM users WHERE id = $1', [userId]);

    // RULE: console-usage - This should trigger console usage rule
    console.log('Fetched user data:', result.rows);

    return result.rows;
  }

  async updateUser(userId: string, data: any) {
    // RULE: missing-error-handling - This await has no try-catch or .catch()
    await this.client.query('UPDATE users SET data = $1 WHERE id = $2', [data, userId]);

    // Another console usage
    console.warn('User updated successfully');
  }

  async deleteUser(userId: string) {
    try {
      // This await IS properly handled with try-catch, so should NOT trigger the rule
      await this.client.query('DELETE FROM users WHERE id = $1', [userId]);
      console.info('User deleted');
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  }

  processData() {
    // RULE: todo-comment - This should trigger the TODO comment rule
    // TODO: Implement proper data validation

    const config = {
      // Another hardcoded secret
      secret: 'another-hardcoded-secret',
      token: 'hardcoded-token-value',
    };

    return config;
  }

  async chainedOperations() {
    // RULE: missing-error-handling - Multiple awaits without proper error handling
    await this.fetchUserData('123');
    await this.updateUser('123', { name: 'Updated' });

    // This one uses .catch() so should NOT trigger the rule
    await this.deleteUser('456').catch(err => console.log('Error:', err));
  }
}

// More TODO comments to find
// TODO: Add input validation
/* TODO: Implement caching mechanism */

export default BadExample;
