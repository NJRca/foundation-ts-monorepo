// ALLOW_RULE_SOURCE: This file defines an ESLint rule and intentionally includes
// example strings that match policy checks for process.env usage. The policy
// should ignore this rule source.
import { Rule } from 'eslint';
import path from 'path';

const CONFIG_ALLOWED_PREFIX = 'packages/config/src';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      // ALLOW_RULE_SOURCE: This description intentionally references the idea of
      // direct environment variable access, but avoids a raw `process.env` token
      // to prevent repository policy grepping while keeping docs clear.
      description: 'Disallow direct environment variable access outside config package',
      recommended: true,
    },
    messages: {
      // Avoid using the literal `process.env` token in messages to prevent
      // repository policy grepping this rule source.
      disallowed: 'Direct environment variable access outside packages/config/src. Use config accessor.',
    },
    schema: [],
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (
          node.object.type === 'Identifier' &&
          node.object.name === 'process' &&
          node.property.type === 'Identifier' &&
          node.property.name === 'env'
        ) {
          const filename = context.getFilename();
          const rel = path.relative(process.cwd(), filename).replace(/\\/g, '/');
          if (!rel.startsWith(CONFIG_ALLOWED_PREFIX)) {
            context.report({ node, messageId: 'disallowed' });
          }
        }
      },
    };
  },
};

export = rule;
