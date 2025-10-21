---
description: List critical and high-priority security issues
---

List all critical and high-priority security issues using the GitHub API.

**Use the API endpoint:**

```bash
gh api repos/sosialistaflokkurinn/ekklesia/issues -X GET --paginate --jq '.[] | select((.labels[].name == "Priority: Critical" or .labels[].name == "Priority: High" or .labels[].name == "Security") and .state == "open") | {number, title, priority: (.labels[] | select(.name | startswith("Priority:")).name // "No Priority"), labels: [.labels[].name] | join(", "), updated: .updated_at}' | jq -s 'unique_by(.number) | sort_by(.priority) | reverse | .[]'
```

Focus on issues that need immediate attention:
- Priority: Critical
- Priority: High
- Security label
- State: open

Provide analysis of what needs to be addressed ASAP.
