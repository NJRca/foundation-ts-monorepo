import * as fs from 'fs';
import * as path from 'path';

export interface SarifResult {
  ruleId: string;
  level: 'note' | 'warning' | 'error';
  message: {
    text: string;
  };
  locations: Array<{
    physicalLocation: {
      artifactLocation: {
        uri: string;
      };
      region: {
        startLine: number;
        startColumn: number;
        endLine: number;
        endColumn: number;
      };
    };
  }>;
}

export interface SarifReport {
  version: string;
  $schema: string;
  runs: Array<{
    tool: {
      driver: {
        name: string;
        version: string;
        rules: Array<{
          id: string;
          name: string;
          shortDescription: {
            text: string;
          };
          fullDescription: {
            text: string;
          };
          help: {
            text: string;
          };
        }>;
      };
    };
    results: SarifResult[];
  }>;
}

export class StaticAnalyzer {
  private readonly rules: Map<
    string,
    {
      name: string;
      shortDescription: string;
      fullDescription: string;
      help: string;
      check: (content: string, filePath: string) => SarifResult[];
    }
  > = new Map();

  constructor() {
    this.initializeRules();
  }

  private initializeRules(): void {
    // Rule implementation: detect pending work comments in source code
    this.rules.set('todo-comment', {
      name: 'TODO Comment Detection',
      shortDescription: 'Detects TODO comments in code',
      fullDescription: 'This rule identifies TODO comments that may indicate incomplete work',
      help: 'Consider addressing or documenting TODO items before production deployment',
      check: (content: string, filePath: string): SarifResult[] => {
        const results: SarifResult[] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          const todoRegex = /(\/\/|\/\*|\*|#)\s*TODO:?\s*(.*)/i;
          const todoMatch = todoRegex.exec(line);
          if (todoMatch) {
            results.push({
              ruleId: 'todo-comment',
              level: 'note',
              message: {
                text: `TODO comment found: ${todoMatch[2] || 'No description'}`,
              },
              locations: [
                {
                  physicalLocation: {
                    artifactLocation: {
                      uri: filePath,
                    },
                    region: {
                      startLine: index + 1,
                      startColumn: 1,
                      endLine: index + 1,
                      endColumn: line.length + 1,
                    },
                  },
                },
              ],
            });
          }
        });

        return results;
      },
    });

    // Domain-specific rule: detect direct database access
    this.rules.set('direct-db-access', {
      name: 'Direct Database Access Detection',
      shortDescription: 'Detects direct database access outside repositories',
      fullDescription:
        'This rule identifies potential violations of repository pattern by detecting direct database calls',
      help: 'Use repository interfaces instead of direct database access for better testability and separation of concerns',
      check: (content: string, filePath: string): SarifResult[] => {
        const results: SarifResult[] = [];
        const lines = content.split('\n');

        // Skip repository implementations
        if (filePath.includes('repository') || filePath.includes('Repository')) {
          return results;
        }

        lines.forEach((line, index) => {
          const dbRegex = /(client\.query|db\.query|\.execute\(|\.findOne\(|\.save\(|\.delete\()/;
          const dbMatch = dbRegex.exec(line);
          if (dbMatch && !line.includes('repository') && !line.includes('Repository')) {
            results.push({
              ruleId: 'direct-db-access',
              level: 'warning',
              message: {
                text: `Direct database access detected: ${dbMatch[0]}`,
              },
              locations: [
                {
                  physicalLocation: {
                    artifactLocation: {
                      uri: filePath,
                    },
                    region: {
                      startLine: index + 1,
                      startColumn: line.indexOf(dbMatch[0]) + 1,
                      endLine: index + 1,
                      endColumn: line.indexOf(dbMatch[0]) + dbMatch[0].length + 1,
                    },
                  },
                },
              ],
            });
          }
        });

        return results;
      },
    });

    // Domain-specific rule: detect missing error handling
    this.rules.set('missing-error-handling', {
      name: 'Missing Error Handling Detection',
      shortDescription: 'Detects async operations without proper error handling',
      fullDescription:
        'This rule identifies async operations that may not have proper error handling',
      help: 'Use try-catch blocks or proper error handling for async operations',
      check: (content: string, filePath: string): SarifResult[] => {
        const results: SarifResult[] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          const awaitRegex = /await\s+/;
          const awaitMatch = awaitRegex.exec(line);
          if (awaitMatch) {
            // Check if this await is within a try-catch block
            const beforeLines = lines.slice(Math.max(0, index - 10), index);
            const afterLines = lines.slice(index + 1, Math.min(lines.length, index + 10));

            const hasTryCatch =
              beforeLines.some(l => l.includes('try')) && afterLines.some(l => l.includes('catch'));

            if (!hasTryCatch && !line.includes('.catch(')) {
              results.push({
                ruleId: 'missing-error-handling',
                level: 'warning',
                message: {
                  text: 'Async operation without proper error handling',
                },
                locations: [
                  {
                    physicalLocation: {
                      artifactLocation: {
                        uri: filePath,
                      },
                      region: {
                        startLine: index + 1,
                        startColumn: line.indexOf('await') + 1,
                        endLine: index + 1,
                        endColumn: line.indexOf('await') + 5,
                      },
                    },
                  },
                ],
              });
            }
          }
        });

        return results;
      },
    });

    // Domain-specific rule: detect hardcoded secrets
    this.rules.set('hardcoded-secrets', {
      name: 'Hardcoded Secrets Detection',
      shortDescription: 'Detects potential hardcoded secrets',
      fullDescription:
        'This rule identifies potential hardcoded passwords, API keys, and other secrets',
      help: 'Use environment variables or secure configuration management for secrets',
      check: (content: string, filePath: string): SarifResult[] => {
        const results: SarifResult[] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          const secretPatterns = [
            /password\s*[:=]\s*['"][^'"]+['"]/i,
            /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i,
            /secret\s*[:=]\s*['"][^'"]+['"]/i,
            /token\s*[:=]\s*['"][^'"]+['"]/i,
          ];

          secretPatterns.forEach(pattern => {
            const match = pattern.exec(line);
            if (match) {
              results.push({
                ruleId: 'hardcoded-secrets',
                level: 'error',
                message: {
                  text: `Potential hardcoded secret detected: ${match[0].split(':')[0]}`,
                },
                locations: [
                  {
                    physicalLocation: {
                      artifactLocation: {
                        uri: filePath,
                      },
                      region: {
                        startLine: index + 1,
                        startColumn: line.indexOf(match[0]) + 1,
                        endLine: index + 1,
                        endColumn: line.indexOf(match[0]) + match[0].length + 1,
                      },
                    },
                  },
                ],
              });
            }
          });
        });

        return results;
      },
    });

    // Example rule: detect console.log statements
    this.rules.set('console-usage', {
      name: 'Console Usage Detection',
      shortDescription: 'Detects console.log statements',
      fullDescription:
        'This rule identifies console.log statements that should be replaced with proper logging',
      help: 'Use the logging framework instead of console.log for better observability',
      check: (content: string, filePath: string): SarifResult[] => {
        const results: SarifResult[] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          const consoleRegex = /console\.(log|warn|error|info|debug)/;
          const consoleMatch = consoleRegex.exec(line);
          if (consoleMatch) {
            results.push({
              ruleId: 'console-usage',
              level: 'warning',
              message: {
                text: `Direct console usage found: ${consoleMatch[0]}`,
              },
              locations: [
                {
                  physicalLocation: {
                    artifactLocation: {
                      uri: filePath,
                    },
                    region: {
                      startLine: index + 1,
                      startColumn: line.indexOf(consoleMatch[0]) + 1,
                      endLine: index + 1,
                      endColumn: line.indexOf(consoleMatch[0]) + consoleMatch[0].length + 1,
                    },
                  },
                },
              ],
            });
          }
        });

        return results;
      },
    });
  }

  analyze(directoryPath: string): SarifReport {
    const results: SarifResult[] = [];

    this.scanDirectory(directoryPath, results);

    return {
      version: '2.1.0',
      $schema:
        'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      runs: [
        {
          tool: {
            driver: {
              name: 'Foundation Static Analyzer',
              version: '1.0.0',
              rules: Array.from(this.rules.entries()).map(([id, rule]) => ({
                id,
                name: rule.name,
                shortDescription: {
                  text: rule.shortDescription,
                },
                fullDescription: {
                  text: rule.fullDescription,
                },
                help: {
                  text: rule.help,
                },
              })),
            },
          },
          results,
        },
      ],
    };
  }

  private scanDirectory(dirPath: string, results: SarifResult[]): void {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
        this.scanDirectory(fullPath, results);
      } else if (entry.isFile() && this.shouldAnalyzeFile(entry.name)) {
        this.analyzeFile(fullPath, results);
      }
    }
  }

  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = ['node_modules', 'dist', '.git', 'coverage'];
    return skipDirs.includes(dirName);
  }

  private shouldAnalyzeFile(fileName: string): boolean {
    const extensions = ['.ts', '.js', '.tsx', '.jsx'];
    return extensions.some(ext => fileName.endsWith(ext));
  }

  private analyzeFile(filePath: string, results: SarifResult[]): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      Array.from(this.rules.values()).forEach(rule => {
        const ruleResults = rule.check(content, filePath);
        results.push(...ruleResults);
      });
    } catch (error) {
      // Log error but continue processing other files
      console.warn(
        `Warning: Could not analyze file ${filePath}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

export function generateSarifReport(directoryPath: string): SarifReport {
  const analyzer = new StaticAnalyzer();
  return analyzer.analyze(directoryPath);
}
