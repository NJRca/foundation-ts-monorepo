# Task: Pull Request Body

Create a standardized PR body.

## Sections

1. Summary
2. Change Detail
3. Validation
4. Risks & Mitigations
5. Checklist

## Output Markdown Template

```markdown
## Summary

<one-two sentences>

## Change Detail

- Files: <list>
- Added lines: <n>
- DbC: <assertions / none>

## Validation

- [ ] Unit tests pass
- [ ] New/updated tests added
- [ ] No new high analyzer findings

## Risks & Mitigations

- Risk: <desc> -> Mitigation: <desc>

## Checklist

- [ ] Follows playbook rules
- [ ] Commit conventional
- [ ] Docs updated (if needed)
```
