# Task: Synthesize Focused Test

Generate a minimal test that would fail before the patch and pass after, aligned with the rules in `../rules.yaml`.

## Constraints

- Prefer unit test co-located with target package if possible
- Use existing test frameworks (Jest config already present)
- Follow naming: `<file>.generated.test.ts` for generated tests
- Must assert at least one DbC guard or error condition

## Output JSON

```json
{
  "testPath": "relative/path/to/test.ts",
  "reason": "why this test proves the fix",
  "code": "contents of test file"
}
```

Keep test focused and deterministic.
