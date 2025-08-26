import { Rule } from 'eslint';
import fs from 'fs';
import path from 'path';

interface ComplexityBaseline {
  [file: string]: number; // lines count baseline
}

const BASELINE_FILE = 'playbook/.complexity-baseline.json';

function getBaseline(): ComplexityBaseline {
  try {
    const raw = fs.readFileSync(BASELINE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require justification comment when file line count increases over baseline',
      recommended: true,
    },
    schema: [],
    messages: {
      missingJustification:
        'Complexity delta detected (+{delta} lines). Add ALLOW_COMPLEXITY_DELTA comment with rationale.',
    },
  },
  create(context) {
    const baseline = getBaseline();
    return {
      Program(node) {
        const filename = context.getFilename();
        const rel = path.relative(process.cwd(), filename).replace(/\\/g, '/');
        if (!rel.endsWith('.ts')) return;
        const source = context.getSourceCode().getText();
        const lines = source.split(/\r?\n/).length;
        const base = baseline[rel];
        if (base !== undefined && lines > base) {
          if (!/ALLOW_COMPLEXITY_DELTA/.test(source)) {
            context.report({
              node,
              messageId: 'missingJustification',
              data: { delta: lines - base },
            });
          }
        }
      },
    };
  },
};

export = rule;
