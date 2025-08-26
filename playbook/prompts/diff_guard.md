# Task: Diff Guard

Evaluate a proposed patch diff against `../rules.yaml`.

Return JSON:

```json
{
  "status": "pass|fail|warn",
  "violations": [{ "rule": "envAccess", "detail": "found process.env in packages/foo/src/x.ts" }],
  "metrics": {
    "addedLines": 12,
    "modifiedFiles": 2
  }
}
```

Status semantics:

- fail: any hard policy violated (envAccess.policy=fail, contracts.patchScope exceeded, analyzer severity gate breach)
- warn: soft guidelines exceeded (function length, cyclomatic) but patch still acceptable
- pass: all good
