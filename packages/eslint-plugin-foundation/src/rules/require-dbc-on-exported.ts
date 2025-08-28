import * as ESTree from 'estree';

import { Rule } from 'eslint';

const ALLOWED_ASSERTIONS = new Set([
  'assertNonNull',
  'assertNumberFinite',
  'assertIndexInRange',
  'fail',
]);

function isAssertionCall(node: ESTree.Node): boolean {
  if (node.type !== 'ExpressionStatement') return false;
  const expr = node.expression;
  if (expr.type !== 'CallExpression') return false;
  if (expr.callee.type === 'Identifier' && ALLOWED_ASSERTIONS.has(expr.callee.name)) return true;
  return false;
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require at least one DbC assertion at start of exported function',
      recommended: true,
    },
    schema: [],
    messages: {
      missing:
        'Exported function should begin with a Design-by-Contract assertion (e.g., assertNonNull).',
    },
  },
  create(context) {
    return {
      FunctionDeclaration(node: ESTree.FunctionDeclaration) {
        if (!node.id || !node.id.name) return;
        const sourceText = context.getSourceCode().getText();
        const funcStart = node.body && node.body.type === 'BlockStatement' ? node.body.body : [];
        const hasAssertion = (funcStart as ESTree.Node[]).slice(0, 3).some(isAssertionCall);
        // simplistic export detection (guard range)
        const exported = Array.isArray(node.range)
          ? /export\s+function\s+/.test(sourceText.slice(node.range[0] - 15, node.range[0] + 30))
          : false;
        if (exported && !hasAssertion) {
          context.report({ node, messageId: 'missing' });
        }
      },
    };
  },
};

export = rule;
