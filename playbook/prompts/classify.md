# Task: Classify Request

Determine which action the assistant should take based on the user input in the context of this repository.

## Output Format

Return a JSON object:

```json
{
  "intent": "patch|test|analysis|refactor|question|unknown",
  "requiresRepo": true,
  "needsCodeLocation": true,
  "confidence": 0.0
}
```

## Classification Cues

- patch: user wants a code change
- test: user wants tests added or modified
- analysis: user asks for root cause, risk, performance, security
- refactor: structural or quality improvement request
- question: general information / explanation
- unknown: insufficient signal

Set `requiresRepo` true if repository files must be inspected. Set `needsCodeLocation` true if a specific file/lines are required to proceed.
