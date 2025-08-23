import * as fs from 'fs';
import * as path from 'path';

interface SarifResult {
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

interface SarifReport {
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
  private rules: Map<string, {
    name: string;
    shortDescription: string;
    fullDescription: string;
    help: string;
    check: (content: string, filePath: string) => SarifResult[];
  }> = new Map();

  constructor() {
    this.initializeRules();
  }

  private initializeRules(): void {
    // Example rule: detect TODO comments
    this.rules.set('todo-comment', {
      name: 'TODO Comment Detection',
      shortDescription: 'Detects TODO comments in code',
      fullDescription: 'This rule identifies TODO comments that may indicate incomplete work',
      help: 'Consider addressing or documenting TODO items before production deployment',
      check: (content: string, filePath: string): SarifResult[] => {
        const results: SarifResult[] = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          const todoMatch = line.match(/(\/\/|\/\*|\*|#)\s*TODO:?\s*(.*)/i);
          if (todoMatch) {
            results.push({
              ruleId: 'todo-comment',
              level: 'note',
              message: {
                text: `TODO comment found: ${todoMatch[2] || 'No description'}`
              },
              locations: [{
                physicalLocation: {
                  artifactLocation: {
                    uri: filePath
                  },
                  region: {
                    startLine: index + 1,
                    startColumn: 1,
                    endLine: index + 1,
                    endColumn: line.length + 1
                  }
                }
              }]
            });
          }
        });
        
        return results;
      }
    });

    // Example rule: detect console.log statements
    this.rules.set('console-usage', {
      name: 'Console Usage Detection',
      shortDescription: 'Detects console.log statements',
      fullDescription: 'This rule identifies console.log statements that should be replaced with proper logging',
      help: 'Use the logging framework instead of console.log for better observability',
      check: (content: string, filePath: string): SarifResult[] => {
        const results: SarifResult[] = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          const consoleMatch = line.match(/console\.(log|warn|error|info|debug)/);
          if (consoleMatch) {
            results.push({
              ruleId: 'console-usage',
              level: 'warning',
              message: {
                text: `Direct console usage found: ${consoleMatch[0]}`
              },
              locations: [{
                physicalLocation: {
                  artifactLocation: {
                    uri: filePath
                  },
                  region: {
                    startLine: index + 1,
                    startColumn: line.indexOf(consoleMatch[0]) + 1,
                    endLine: index + 1,
                    endColumn: line.indexOf(consoleMatch[0]) + consoleMatch[0].length + 1
                  }
                }
              }]
            });
          }
        });
        
        return results;
      }
    });
  }

  analyze(directoryPath: string): SarifReport {
    const results: SarifResult[] = [];
    
    this.scanDirectory(directoryPath, results);
    
    return {
      version: '2.1.0',
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      runs: [{
        tool: {
          driver: {
            name: 'Foundation Static Analyzer',
            version: '1.0.0',
            rules: Array.from(this.rules.entries()).map(([id, rule]) => ({
              id,
              name: rule.name,
              shortDescription: {
                text: rule.shortDescription
              },
              fullDescription: {
                text: rule.fullDescription
              },
              help: {
                text: rule.help
              }
            }))
          }
        },
        results
      }]
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
      
      for (const [, rule] of this.rules) {
        const ruleResults = rule.check(content, filePath);
        results.push(...ruleResults);
      }
    } catch (error) {
      // Silently skip files that can't be read
    }
  }
}

export function generateSarifReport(directoryPath: string): SarifReport {
  const analyzer = new StaticAnalyzer();
  return analyzer.analyze(directoryPath);
}