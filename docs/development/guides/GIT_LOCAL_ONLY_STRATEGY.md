# Git Strategy: Track All, Push Selectively

**Created**: 2025-12-03
**Status**: Active

---

## Overview

This project uses a "Track All, Push Selectively" git strategy:

- **All files are tracked locally** - AI assistants can see and help with everything
- **Sensitive files are blocked from push** - The pre-push hook prevents them from going to remote
- **Remote repository stays clean** - No credentials, PII, or sensitive data

---

## Why This Strategy?

### The Problem with .gitignore

Traditional `.gitignore` prevents files from being tracked at all:
- AI assistants (Claude, Copilot, etc.) can't see gitignored files
- Developers can't get AI help with configuration, policy docs, or audit files
- Context is lost when debugging PII-related issues

### The Solution

Track everything locally, but use a pre-push hook to block sensitive files:

```
┌─────────────────────────────────────────────────────────────────┐
│                        LOCAL REPOSITORY                         │
│                                                                 │
│  All files tracked:                                             │
│  ✅ Source code                                                 │
│  ✅ Documentation                                               │
│  ✅ .env files (credentials)                                    │
│  ✅ Policy docs (meeting notes)                                 │
│  ✅ Audit files (may contain PII)                               │
│  ✅ tmp/ (working files)                                        │
│                                                                 │
│  AI assistants can see EVERYTHING                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ git push
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PRE-PUSH HOOK                              │
│                                                                 │
│  Checks commits against .git-local-only patterns                │
│                                                                 │
│  ❌ BLOCKED: .env, *.key.json, *KENNITALA*.md, docs/policy/*    │
│  ✅ ALLOWED: Everything else                                    │
│                                                                 │
│  If blocked files found → PUSH FAILS with clear message         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ (only safe files)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      REMOTE REPOSITORY                          │
│                                                                 │
│  Clean and secure:                                              │
│  ✅ Source code                                                 │
│  ✅ Documentation (non-sensitive)                               │
│  ❌ No credentials                                              │
│  ❌ No PII                                                      │
│  ❌ No policy meeting notes                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `.gitignore` | Only excludes build artifacts (node_modules, dist, etc.) |
| `.git-local-only` | Patterns for files blocked from push |
| `git-hooks/pre-push` | Enforces .git-local-only rules |

---

## .git-local-only Patterns

The `.git-local-only` file contains regex patterns for files that should never be pushed:

```bash
# PII Protection
.*KENNITALA.*\.md$
.*DUPLICATE_SSN.*\.md$
^docs/policy/.*\.md$

# Credentials
^\.env$
^\.env\..*
.*\.key\.json$
.*client_secret.*

# Audit logs
.*\.audit\.json$
^scripts/logs/.*\.jsonl$

# Admin scripts
^services/svc-members/scripts/check-.*\.js$
```

---

## Workflow

### Normal Development

```bash
# Edit any file, including sensitive ones
vim .env
vim docs/policy/meeting-notes.md

# Commit locally - works fine
git add .
git commit -m "Update configuration"

# Push - hook checks for sensitive files
git push
# If sensitive files in commits → BLOCKED
# If no sensitive files → Push succeeds
```

### When Push is Blocked

If the pre-push hook blocks your push:

```bash
# 1. See what was blocked
git diff --name-only origin/main..HEAD

# 2. Option A: Remove sensitive files from commits
git reset HEAD~1  # Undo last commit
git add <safe-files-only>
git commit -m "Safe changes only"
git push

# 3. Option B: Create separate branch for sensitive changes
git checkout -b local/config-changes
# Keep sensitive commits on this branch (never push)
```

### Emergency Bypass (NOT RECOMMENDED)

```bash
# DANGEROUS - only in emergencies with explicit approval
git push --no-verify
```

---

## For New Developers

1. **Clone the repository**
2. **Install git hooks:**
   ```bash
   ./scripts/setup/install-git-hooks.sh
   ```
3. **Understand the strategy:**
   - You CAN commit any file locally
   - You CANNOT push files matching `.git-local-only` patterns
   - AI assistants CAN help with all files (they're tracked)

---

## Troubleshooting

### "Push blocked" error

The pre-push hook found sensitive files in your commits:

1. Read the error message - it lists blocked files
2. Remove those files from the commits being pushed
3. Keep sensitive changes on a local-only branch

### AI assistant can't see a file

If an AI assistant says it can't see a file:

1. Check if the file is tracked: `git ls-files <file>`
2. If not tracked, add it: `git add <file>`
3. Commit locally: `git commit -m "Track file for AI visibility"`

### Need to share credentials with team

Don't push credentials to the repository. Instead:

1. Use Google Cloud Secret Manager
2. Share via secure channel (1Password, etc.)
3. Document how to obtain credentials in README

---

## Related Documentation

- [SESSION_START_REMINDER.md](../../SESSION_START_REMINDER.md) - Security rules
- [NAMING_CONVENTIONS.md](../../standards/NAMING_CONVENTIONS.md) - File naming
- `.git-local-only` - Full list of blocked patterns
