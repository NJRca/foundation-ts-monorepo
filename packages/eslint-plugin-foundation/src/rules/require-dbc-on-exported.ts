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
      FunctionDeclaration(node: any) {
        if (!node.id || !node.id.name) return;
        // Find if exported
        const scopeBody: any = (node as any).parent;
        const sourceText = context.getSourceCode().getText();
        const funcStart = node.body && node.body.body ? node.body.body : [];
        const hasAssertion = funcStart.slice(0, 3).some(isAssertionCall);
        // simplistic export detection
        const exported = /export\s+function\s+/.test(
          sourceText.slice(node.range[0] - 15, node.range[0] + 30)
        );
        if (exported && !hasAssertion) {
          context.report({ node, messageId: 'missing' });
        }
      },
    };
  },
};

export = rule;
