---
description: List GitHub issues using the API endpoint
---

List all GitHub issues for this repository using the GitHub API endpoint.

**ALWAYS use this approach instead of `gh issue list`:**

```bash
gh api repos/sosialistaflokkurinn/ekklesia/issues -X GET --paginate --jq '.[] | select(.state == "open") | {number, title, state, labels: [.labels[].name] | join(", "), updated: .updated_at}' | jq -s 'unique_by(.number) | sort_by(.number) | reverse | .[]'
```

Show results filtered by:
- State (open/closed)
- Labels (Priority: Critical, Security, etc.)
- Updated date
- Assignees

Provide a clean, formatted summary of the issues.
