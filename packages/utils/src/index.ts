import { assertNonNull } from '@foundation/contracts';

// @intent: utils
// Purpose: small, reusable utility functions used across the monorepo. Keep functions
// simple, well-documented, and side-effect free where possible.
// NOTE: avoid changing semantics; keep signatures stable.
// Re-exported utility functions used across the monorepo
export function ensureString(v: unknown, name = 'value'): string {
  assertNonNull(v, name);
  if (typeof v !== 'string') throw new Error(`${name} must be a string`);
  return v;
}

export function ensureNumber(v: unknown, name = 'value'): number {
  assertNonNull(v, name);
  if (typeof v !== 'number') throw new Error(`${name} must be a number`);
  return v;
}

export function noop(): void {}
// Utility functions
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const attempt = async (): Promise<void> => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          reject(error);
        } else {
          setTimeout(attempt, delayMs);
        }
      }
    };

    void attempt();
  });
}
