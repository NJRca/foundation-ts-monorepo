# Task: Patch Critique

Provide structured critique of a proposed patch JSON.

Return JSON:

```json
{
  "score": 0-100,
  "strengths": ["..."],
  "risks": ["..."],
  "missingTests": ["relative/path.test.ts"],
  "recommendations": ["..."],
  "dbc": {"applied": true, "notes": "..."}
}
```

Scoring Heuristics:

- Start from 100, subtract for each issue (missing tests -10 each, env misuse -30, complexity exceed -15, unclear description -5)
