# Task: Propose Patch (Playbook Variant)

Use repository conventions & `../rules.yaml` to craft a minimal patch.

## Key Guardrails

- Modify only required files
- Keep added lines <= `complexityBudget.maxAddedLines`
- Enforce DbC guards at function boundaries only
- Avoid direct `process.env` outside allowed paths
- No new high severity analyzer warnings
- Add or update at least one test if behavior changes

## Output JSON

```json
{
  "description": "short summary",
  "changes": [
    {
      "path": "relative/path.ts",
      "edits": [{ "lineStart": 10, "lineEnd": 18, "newCode": "..." }]
    }
  ],
  "tests": ["relative/path/to/new.test.ts"],
  "risk": "low|medium|high"
}
```

Explain trade-offs briefly in description.
