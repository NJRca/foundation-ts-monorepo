import { Rule } from 'eslint';
import path from 'path';

const CONFIG_ALLOWED_PREFIX = 'packages/config/src';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow direct process.env access outside config package',
      recommended: true,
    },
    messages: {
      disallowed: 'Direct process.env usage outside packages/config/src. Use config accessor.',
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
