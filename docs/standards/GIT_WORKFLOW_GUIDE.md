# Ekklesia Git Workflow Guide

**Last Updated**: 2025-11-04
**Status**: ✅ Active - Git and Version Control Standards
**Purpose**: Git workflow, branching strategy, and commit conventions

---

## Overview

This guide defines Git workflow standards for the Ekklesia project. We use:
- Feature branch workflow
- Conventional commit messages
- Pull requests for all changes
- Squash merge for clean history

### Core Principles

1. **Main is Always Deployable** - Never break main branch
2. **Feature Branches for All Work** - Never commit directly to main
3. **Clear Commit Messages** - Explain what and why
4. **Small, Focused PRs** - Easier to review and merge
5. **Clean History** - Squash merge to keep main clean

---

## Branching Strategy

### Branch Types

| Branch Type | Naming Convention | Purpose | Example |
|-------------|-------------------|---------|---------|
| **Main** | `main` | Production-ready code | `main` |
| **Feature** | `feature/epic-N-description` | New features | `feature/epic-24-admin-lifecycle` |
| **Bugfix** | `fix/issue-N-description` | Bug fixes | `fix/issue-42-csrf-validation` |
| **Hotfix** | `hotfix/critical-description` | Emergency prod fixes | `hotfix/security-token-leak` |
| **Docs** | `docs/description` | Documentation only | `docs/update-api-guide` |

### Branch Naming Rules

**Format**: `type/scope-description`

✅ **Good**:
```
feature/epic-24-admin-lifecycle
fix/issue-42-csrf-validation
hotfix/security-token-leak
docs/update-deployment-guide
```

❌ **Bad**:
```
my-work                  # Too vague
feature_admin            # Use hyphen, not underscore
fix                      # No description
admin-lifecycle          # Missing type prefix
```

**Rules**:
- Lowercase only
- Use hyphens, not underscores
- Include epic/issue number if applicable
- Be descriptive but concise (max 50 chars)

---

## Conventional Commit Messages

### Format

```
type(scope): short description

Optional body with more details.

Optional footer with issue references.
```

### Commit Types

| Type | Use For | Example |
|------|---------|---------|
| `feat` | New feature | `feat(auth): add Kenni.is OAuth login` |
| `fix` | Bug fix | `fix(profile): prevent duplicate phone numbers` |
| `refactor` | Code restructuring (no behavior change) | `refactor(elections): extract vote validation logic` |
| `docs` | Documentation only | `docs(api): update elections API examples` |
| `style` | Formatting (no code change) | `style(css): convert to BEM methodology` |
| `test` | Adding tests | `test(auth): add token validation tests` |
| `chore` | Maintenance (dependencies, config) | `chore(deps): upgrade firebase to v10.5` |
| `perf` | Performance improvement | `perf(db): add index on voting_tokens.hash` |
| `ci` | CI/CD changes | `ci(github): add security scanning workflow` |
| `build` | Build system changes | `build(webpack): optimize production bundle` |
| `revert` | Revert previous commit | `revert: feat(auth): add OAuth (breaks prod)` |

### Scope (Optional but Recommended)

Scope indicates what part of the codebase is affected:

**Frontend**:
- `auth` - Authentication
- `profile` - Profile page
- `dashboard` - Dashboard page
- `elections` - Elections/voting UI
- `admin` - Admin pages
- `i18n` - Internationalization
- `css` - Styles

**Backend**:
- `api` - API endpoints
- `db` - Database
- `auth` - Authentication service
- `elections` - Elections service
- `events` - Events service
- `members` - Members service

**Infrastructure**:
- `deploy` - Deployment scripts
- `config` - Configuration
- `ci` - CI/CD
- `deps` - Dependencies

### Short Description

- Use imperative mood ("add" not "added" or "adds")
- Lowercase first letter
- No period at end
- Max 50 characters
- Be specific but concise

✅ **Good**:
```
feat(auth): add Kenni.is OAuth login
fix(profile): prevent duplicate phone numbers
docs(api): update elections API examples
```

❌ **Bad**:
```
Added auth feature                  # Past tense, vague
Fix bug                              # Not specific
Updated stuff.                       # Period at end, vague
feat: authentication with Kenni.is OAuth flow including token refresh  # Too long (>50 chars)
```

### Body (Optional)

Add body for complex changes:
- Explain WHY, not just WHAT
- Wrap at 72 characters
- Separate from description with blank line

```
feat(auth): add Kenni.is OAuth login

Integrates government Kenni.is OAuth for authentication.
Replaces manual username/password system with secure eID.

- Adds OAuth flow with CSRF protection
- Stores tokens securely in session
- Auto-refreshes access tokens
```

### Footer (Optional)

Link to issues, breaking changes:

**Close issues**:
```
Closes #42
Fixes #87, #90
Resolves #123
```

**Breaking changes**:
```
BREAKING CHANGE: Auth API now requires OAuth tokens instead of API keys.
Clients must update to use OAuth flow.
```

**Related issues** (not closed):
```
Related to #87
See also #90
```

---

## Complete Commit Examples

### Simple Bug Fix

```
fix(profile): prevent duplicate phone numbers

Closes #87
```

### Feature with Context

```
feat(elections): add status feedback to vote button

Shows loading spinner while vote is being submitted,
then checkmark on success. Auto-clears after 2 seconds.

Implements the status feedback pattern from Epic #87.

Closes #92
```

### Refactoring

```
refactor(css): convert profile page to BEM methodology

Renamed all CSS classes to follow BEM standard:
- .name-input → .profile-field__input
- .save-btn → .btn--save
- .error-msg → .profile-field__error

No visual or behavioral changes.

Related to #59
```

### Documentation

```
docs(standards): add git workflow guide

Comprehensive guide covering:
- Branch naming conventions
- Conventional commit format
- Pull request process
- Code review guidelines

Part of code standards reorganization (Epic #159).
```

### Breaking Change

```
feat(api): migrate elections API to v2

BREAKING CHANGE: Elections API v1 endpoints removed.
All clients must migrate to /api/v2/elections endpoints.

Migration guide: docs/api/MIGRATION_V1_TO_V2.md

Closes #120
```

---

## Git Workflow

### 1. Start New Work

```bash
# Update main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/epic-24-admin-api

# Verify branch
git branch
```

### 2. Make Changes and Commit

```bash
# Stage changes
git add src/api/elections.js
git add tests/api/elections.test.js

# Commit with conventional message
git commit -m "feat(api): add GET /api/elections endpoint

Returns list of all elections with metadata.
Includes pagination support (limit/offset).

Related to Epic #24"
```

### 3. Push to Remote

```bash
# First push (set upstream)
git push -u origin feature/epic-24-admin-api

# Subsequent pushes
git push
```

### 4. Keep Branch Updated

```bash
# Update main
git checkout main
git pull origin main

# Rebase feature branch (preferred)
git checkout feature/epic-24-admin-api
git rebase main

# Or merge main into feature (alternative)
git checkout feature/epic-24-admin-api
git merge main
```

### 5. Create Pull Request

```bash
# Use GitHub CLI (recommended)
gh pr create --title "feat(api): add admin elections API" \
  --body "$(cat <<'EOF'
## Summary
Implements admin REST API for managing elections (Epic #24).

## Changes
- GET /api/elections - List all elections
- POST /api/elections - Create election
- PATCH /api/elections/:id - Update election
- POST /api/elections/:id/open - Open voting
- POST /api/elections/:id/close - Close voting

## Testing
- [x] Manual testing with curl
- [x] Unit tests added
- [x] API docs updated

## Related Issues
Closes #91
Part of Epic #24
EOF
)"

# Or create PR via GitHub web UI
```

---

## Pull Request Guidelines

### PR Title Format

Follow conventional commit format:

```
feat(api): add admin elections API
fix(auth): prevent token expiration during vote
docs(standards): add git workflow guide
```

### PR Description Template

Use this template for all PRs:

```markdown
## Summary
[1-2 sentences describing what this PR does]

## Type of Change
- [ ] Feature (new functionality)
- [ ] Bugfix (fixes issue)
- [ ] Refactor (no behavior change)
- [ ] Documentation
- [ ] Other: [describe]

## Changes
- [List key changes]
- [Be specific]

## Testing
- [ ] Manual testing completed
- [ ] Unit tests added/updated
- [ ] Integration tests passing
- [ ] Tested in Chrome and Firefox

## Screenshots (for UI changes)
[Attach screenshots if UI changed]

## Related Issues
Closes #XX
Part of Epic #YY

## Checklist
- [ ] Code follows style guidelines
- [ ] JSDoc added for new functions
- [ ] No console.log statements
- [ ] Documentation updated
- [ ] Tests passing
```

### PR Size Guidelines

**Small PRs are better**:
- **Ideal**: <300 lines changed
- **Maximum**: <800 lines changed
- **Too large**: >800 lines (split into multiple PRs)

**Why**: Easier to review, faster to merge, less likely to introduce bugs.

**How to keep PRs small**:
- One feature per PR
- Refactoring separate from new features
- Split large features into multiple PRs (Part 1, Part 2, etc.)

---

## Code Review Process

### For Reviewers

**Review Checklist**:
- [ ] Code follows style guidelines
- [ ] Tests exist and pass
- [ ] Documentation updated
- [ ] No security issues
- [ ] No performance regressions
- [ ] Commit messages follow conventions

**Review Comments**:
- Be respectful and constructive
- Explain WHY, not just WHAT
- Suggest alternatives
- Mark severity (blocking vs non-blocking)

**Comment Tags**:
- `[blocking]` - Must fix before merge
- `[nit]` - Optional nitpick
- `[question]` - Need clarification
- `[suggestion]` - Consider this alternative

**Example Review Comments**:

```markdown
[blocking] Security: This endpoint is missing authentication check.
Add `requireAuth()` middleware.

[nit] Consider extracting this validation logic into a separate function
for reusability.

[question] Why did we choose async/await instead of promises here?

[suggestion] You could use destructuring here to simplify:
const { email, name } = user.profile;

```

### For PR Authors

**Responding to Review**:
- Address all comments
- Mark resolved when fixed
- Explain if you disagree
- Push fixes as new commits (don't force push during review)

**After Approval**:
- Squash commits if needed (use "Squash and merge" on GitHub)
- Delete branch after merge

---

## Merging Strategy

### Squash and Merge (Preferred)

**When**: Most PRs (features, bug fixes)

**Why**: Keeps main history clean (one commit per PR)

**How**:
```bash
# On GitHub, use "Squash and merge" button
# Or via command line:
git checkout main
git merge --squash feature/epic-24-admin-api
git commit -m "feat(api): add admin elections API

Implements full CRUD API for elections management.
Includes authentication and audit logging.

Closes #91"
git push origin main
```

### Rebase and Merge (Alternative)

**When**: Small PRs with well-crafted commits

**Why**: Preserves individual commit history

**How**:
```bash
# On GitHub, use "Rebase and merge" button
```

### Regular Merge (Avoid)

**When**: Never (creates merge commits that clutter history)

**Why not**: Pollutes history with unnecessary merge commits

---

## Release Tagging

### Semantic Versioning

Follow semver: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (v1.0.0 → v2.0.0)
- **MINOR**: New features (v1.0.0 → v1.1.0)
- **PATCH**: Bug fixes (v1.0.0 → v1.0.1)

### Creating a Release

```bash
# Update main
git checkout main
git pull origin main

# Create annotated tag
git tag -a v1.2.0 -m "Release v1.2.0

New Features:
- Admin elections API (Epic #24)
- Member voting interface (Epic #87)
- Status feedback pattern

Bug Fixes:
- Fixed CSRF validation (#42)
- Fixed token caching vulnerability (#35)

BREAKING CHANGES:
- None
"

# Push tag
git push origin v1.2.0

# Create GitHub release
gh release create v1.2.0 \
  --title "v1.2.0 - Admin API & Voting UI" \
  --notes "See tag message for details"
```

---

## Common Git Tasks

### Undo Last Commit (Not Pushed)

```bash
# Keep changes, undo commit
git reset --soft HEAD~1

# Discard changes, undo commit
git reset --hard HEAD~1
```

### Amend Last Commit Message

```bash
# Edit last commit message
git commit --amend

# Add files to last commit
git add forgotten-file.js
git commit --amend --no-edit
```

### Cherry-Pick Commit

```bash
# Apply specific commit to current branch
git cherry-pick abc1234
```

### Revert Commit (Already Pushed)

```bash
# Create new commit that undoes changes
git revert abc1234
git push origin main
```

### Stash Changes

```bash
# Save work-in-progress
git stash

# Apply stashed changes
git stash pop

# List stashes
git stash list
```

### Interactive Rebase (Clean Up Commits)

```bash
# Rebase last 3 commits
git rebase -i HEAD~3

# Choose actions:
# pick = keep commit
# squash = merge with previous
# reword = edit message
# drop = delete commit
```

---

## Git Configuration

### Recommended Settings

```bash
# Set name and email
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Use main as default branch
git config --global init.defaultBranch main

# Enable color output
git config --global color.ui auto

# Set default editor
git config --global core.editor "nano"  # or vim, code, etc.

# Auto-rebase on pull
git config --global pull.rebase true

# Auto-stash before rebase
git config --global rebase.autoStash true
```

### Git Aliases (Optional)

Add to `~/.gitconfig`:

```ini
[alias]
    # Short status
    s = status -s

    # Pretty log
    lg = log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit

    # Undo last commit (keep changes)
    undo = reset --soft HEAD~1

    # Amend last commit
    amend = commit --amend --no-edit

    # List branches sorted by last commit
    branches = branch --sort=-committerdate
```

**Usage**:
```bash
git s             # Short status
git lg            # Pretty log
git undo          # Undo last commit
git amend         # Amend last commit
git branches      # List branches
```

---

## Best Practices

### ✅ Do

- Commit often (small, logical commits)
- Write clear commit messages
- Pull before you push
- Keep feature branches up to date
- Delete merged branches
- Use `git status` before committing
- Review your own changes before creating PR
- Test before pushing
- Use `.gitignore` for generated files

### ❌ Don't

- Commit directly to main
- Force push to shared branches
- Commit secrets or credentials
- Commit commented-out code
- Use vague commit messages ("fix stuff")
- Push broken code
- Leave branches unmerged for months
- Commit without testing

---

## Troubleshooting

### Accidentally Committed to Main

```bash
# Create feature branch from current state
git checkout -b feature/my-work

# Reset main to remote
git checkout main
git reset --hard origin/main

# Continue work on feature branch
git checkout feature/my-work
```

### Merge Conflict

```bash
# During rebase or merge:
# 1. Fix conflicts in files
# 2. Mark resolved
git add conflicted-file.js

# 3. Continue rebase
git rebase --continue

# Or if merging:
git commit
```

### Wrong Commit Message

```bash
# If not pushed yet:
git commit --amend

# If already pushed (DON'T force push if others are working on branch):
# Create new commit with correct message
git revert abc1234
git commit -m "fix: correct commit with right message"
```

---

## Related Documentation

- **Documentation Guide**: [/docs/standards/DOCUMENTATION_GUIDE.md](/docs/standards/DOCUMENTATION_GUIDE.md) - How to write docs
- **Pull Request Template**: `.github/pull_request_template.md` - PR format
- **Master Code Standards**: [/docs/CODE_STANDARDS.md](/docs/CODE_STANDARDS.md)

**External Resources**:
- **Conventional Commits**: https://www.conventionalcommits.org/
- **Git Best Practices**: https://git-scm.com/book/en/v2
- **Semantic Versioning**: https://semver.org/

---

**Last Updated**: 2025-11-04
**Maintained By**: All developers
**Status**: ✅ Active - Required for all Git operations
