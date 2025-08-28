const { loadRules } = require('../dist/rule-loader');

describe('rule-loader (compiled)', () => {
  test('loads rules and detects TODO and console usage', () => {
    const rules = new Map();
    loadRules(rules);

    if (!rules.has('todo-comment')) throw new Error('todo-comment missing');
    if (!rules.has('console-usage')) throw new Error('console-usage missing');

    const todoRule = rules.get('todo-comment');
    const consoleRule = rules.get('console-usage');

    const sample = '// TODO: fix this later\nconsole.log(\'hello world\');\nconst x = 1;';

    const todoResults = todoRule.check(sample, 'sample.ts');
    const consoleResults = consoleRule.check(sample, 'sample.ts');

    if (!Array.isArray(todoResults) || todoResults.length === 0)
      throw new Error('todo not detected');
    if (!Array.isArray(consoleResults) || consoleResults.length === 0)
      throw new Error('console not detected');
  });
});
