# Private Ops Repository Setup

Classification: Internal - Operations

Purpose:
Maintain sensitive operational assets outside the public repository, including production runbooks, credentials, and one-off admin scripts.

Create a private Git repository (e.g., GitHub Enterprise, GitLab) named `ekklesia-ops` with restricted access (security admin + SREs).

Recommended Structure:
```
ekklesia-ops/
  README.md
  .gitignore
  runbooks/
    elections/
      reset-election.sql         # Production-only, destructive (guarded)
      maintenance.md
    members/
      rotate-keys.md
  scripts/
    firebase/
      list-elevated-users.js
      enforce-mfa.js
      set-user-roles.js          # Copy of public with stricter logging
    gcp/
      create-alert-policy.sh
  secrets/
    README.md                    # Store in Secret Manager; do not commit
  policies/
    access-controls.md
    two-person-approval.md
```

Best Practices:
- Never commit credentials; use Google Secret Manager and ADC
- Enable branch protection and required reviews
- Limit membership; re-certify access quarterly
- Add CODEOWNERS for runbooks and scripts

Migration Steps:
1) Create repository with private visibility
2) Add owners and reviewers
3) Move sensitive runbooks from public repo
4) Replace public references with pointers to ops repo
5) Set up CI to lint scripts (no secrets), but do not run destructive tasks

Cross-Links:
- See SECURITY.md for disclosure and safety policies
- See ADMIN_ALERTS.md for alerting; consider moving shell automation here
