#!/usr/bin/env bash
# Weekly security hygiene automation shared by GitHub Actions workflow.

set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "❌ GitHub CLI (gh) is not installed" >&2
  exit 1
fi

if [ -z "${GH_TOKEN:-}" ]; then
  echo "❌ GH_TOKEN environment variable is required" >&2
  exit 1
fi

echo "🔐 Checking critical security issues..."
CRITICAL_ISSUES=$(gh issue list \
  --label "Priority: Critical" \
  --label "Security" \
  --state open \
  --json number,title,createdAt \
  --jq '.[] | select((.createdAt | fromdateiso8601) < (now - 172800)) | .number')

if [ -n "$CRITICAL_ISSUES" ]; then
  echo "⚠️ Found critical security issues open >48 hours:"
  while IFS= read -r issue && [ -n "$issue" ]; do
    echo "  - Issue #$issue"
    gh issue comment "$issue" --body "$(cat <<'EOF'
⚠️ **Automated Security Alert**

This critical security issue has been open for over 48 hours.

**Required Actions:**
- [ ] Immediate triage and assignment
- [ ] Set timeline for resolution
- [ ] Update stakeholders on status

**Escalation:** Critical security issues should be resolved within 48 hours per security policy.

---
_Automated weekly security hygiene check_
EOF
)"
  done <<< "$CRITICAL_ISSUES"
else
  echo "✅ No critical security issues open >48 hours"
fi

echo "🚧 Checking blocked issues..."
BLOCKED_ISSUES=$(gh issue list \
  --label "Blocked" \
  --state open \
  --json number,comments \
  --jq '.[] | select(.comments | length == 0) | .number')

if [ -n "$BLOCKED_ISSUES" ]; then
  echo "⚠️ Found blocked issues without explanation:"
  while IFS= read -r issue && [ -n "$issue" ]; do
    echo "  - Issue #$issue"
    gh issue comment "$issue" --body "$(cat <<'EOF'
⚠️ **Issue Hygiene Check**

This issue is marked as "Blocked" but has no comments explaining what is blocking progress.

**Please document:**
- What dependency/decision/resource is blocking this?
- Who can unblock it?
- Expected timeline for unblocking?

If no longer blocked, please remove the "Blocked" label.

---
_Automated weekly security hygiene check_
EOF
)"
  done <<< "$BLOCKED_ISSUES"
else
  echo "✅ All blocked issues have explanations"
fi

echo "📊 Checking security issues without priority..."
NO_PRIORITY=$(gh issue list \
  --label "Security" \
  --state open \
  --json number,title,labels \
  --jq '.[] | select([.labels[].name | select(startswith("Priority:"))] | length == 0) | .number')

if [ -n "$NO_PRIORITY" ]; then
  echo "⚠️ Found security issues without priority:"
  while IFS= read -r issue && [ -n "$issue" ]; do
    echo "  - Issue #$issue"
    gh issue comment "$issue" --body "$(cat <<'EOF'
⚠️ **Missing Priority Label**

This security issue is missing a priority label.

**Please add one of:**
- `Priority: Critical` - Exploitable vulnerability, must fix before production
- `Priority: High` - Significant security risk, fix soon
- `Priority: Medium` - Security improvement, should fix
- `Priority: Low` - Security hardening, nice to have

Without priority, this issue may be overlooked in triage.

---
_Automated weekly security hygiene check_
EOF
)"
  done <<< "$NO_PRIORITY"
else
  echo "✅ All security issues have priority labels"
fi

echo "✔️ Checking closed security issues..."
UNVERIFIED=$(gh issue list \
  --label "Security" \
  --state closed \
  --json number,title,labels,closedAt \
  --jq '.[] | select((.closedAt | fromdateiso8601) > (now - 2592000) and ([.labels[].name] | contains(["Verified"]) | not)) | .number')

if [ -n "$UNVERIFIED" ]; then
  echo "⚠️ Found closed security issues without verification:"
  while IFS= read -r issue && [ -n "$issue" ]; do
    echo "  - Issue #$issue"
    gh issue comment "$issue" --body "$(cat <<'EOF'
⚠️ **Security Verification Missing**

This security issue was closed but has not been verified with test evidence.

**Required for security fixes:**
- [ ] Add test demonstrating the fix
- [ ] Verify in production (if deployed)
- [ ] Add `Verified` label once confirmed

**Documentation:**
- Test evidence can be: automated test, manual test report, production logs
- See: `tests/security/` for examples

---
_Automated weekly security hygiene check_
EOF
)"
  done <<< "$UNVERIFIED"
else
  echo "✅ All closed security issues are verified or recently closed"
fi

echo ""
echo "=================================================="
echo "Weekly Security Hygiene Report"
echo "=================================================="
echo ""

CRITICAL_COUNT=$(gh issue list --label "Priority: Critical" --label "Security" --state open --json number --jq 'length')
HIGH_COUNT=$(gh issue list --label "Priority: High" --label "Security" --state open --json number --jq 'length')
BLOCKED_COUNT=$(gh issue list --label "Blocked" --state open --json number --jq 'length')

echo "📊 Security Issue Status:"
echo "  - Critical (open): $CRITICAL_COUNT"
echo "  - High (open): $HIGH_COUNT"
echo "  - Blocked: $BLOCKED_COUNT"
echo ""

if [ "$CRITICAL_COUNT" -gt 0 ]; then
  echo "⚠️ Action required: $CRITICAL_COUNT critical security issues"
else
  echo "✅ No critical security issues"
fi

echo ""
echo "Full report: https://github.com/${GITHUB_REPOSITORY}/issues?q=is:issue+label:Security"
