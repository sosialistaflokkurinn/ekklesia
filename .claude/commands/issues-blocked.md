---
description: List all blocked issues that need attention
---

List all issues with the "Blocked" label to identify what needs unblocking.

**Use the API endpoint:**

```bash
gh api repos/sosialistaflokkurinn/ekklesia/issues -X GET --paginate --jq '.[] | select(.labels[].name == "Blocked" and .state == "open") | {number, title, labels: [.labels[].name] | join(", "), comments: .comments, updated: .updated_at}' | jq -s 'unique_by(.number) | sort_by(.number) | reverse | .[]'
```

For each blocked issue:
- Show the blocker (check comments)
- Identify if blocker can be resolved
- Suggest next actions

Help prioritize unblocking work.
