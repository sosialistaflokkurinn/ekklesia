# GitHub Issue Creation Checklist

**Purpose:** Ensure all GitHub issues are properly structured, labeled, and linked.
**Last Updated:** 2025-11-06 (Updated with closing workflow, PII protection, and real-world examples)
**Status:** ✅ Active Reference - Battle-tested on Issue #195

---

## 📋 Pre-Creation Checklist

Before creating an issue, verify:

- [ ] **Issue doesn't already exist** - Search existing issues
- [ ] **Clear scope** - Issue is focused and actionable
- [ ] **Epic identified** - Know which Epic this belongs to (or standalone)
- [ ] **Priority assessed** - Critical, High, Medium, or Low
- [ ] **Type determined** - Bug, Enhancement, Task, User Story, or Epic
- [ ] **No PII in examples** - Use placeholder format (DDMMYY-XXXX, example@example.com)

---

## 🆕 Issue Creation Steps

### 1. Create Issue with Title

**Command:**
```bash
gh issue create --repo sosialistaflokkurinn/ekklesia \
  --title "type(scope): brief description" \
  --body "$(cat <<'EOF'
[Issue body - see template below]
EOF
)"
```

**Title Format Examples:**
- `fix(auth): Login redirect fails after session timeout`
- `feat(elections): Add multi-choice voting support`
- `refactor(dashboard): Use reusable modal component`
- `docs(api): Document Elections API endpoints`
- `chore(cleanup): Remove obsolete member-detail files`

**Title Types:**
- `fix` - Bug fix
- `feat` - New feature
- `refactor` - Code improvement (no behavior change)
- `docs` - Documentation only
- `chore` - Maintenance (cleanup, deps, build)
- `test` - Testing
- `perf` - Performance improvement
- `style` - Formatting, CSS

---

### 2. Issue Body Template

```markdown
## Problem / Current State

[Describe what's wrong or what's missing]

**Example:**
- Current behavior: X happens
- Expected behavior: Y should happen
- Impact: Z users affected

## Proposed Solution

[Clear description of what needs to be done]

**Implementation:**
1. Step one
2. Step two
3. Step three

## Files to Modify/Create

- `path/to/file1.js` - What changes
- `path/to/file2.css` - What changes

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Tests pass
- [ ] Documentation updated

## Benefits

1. ✅ Benefit one
2. ✅ Benefit two

---

**Related:** [Epic #XXX | Issue #YYY]
**Priority:** [Critical | High | Medium | Low]
**Estimate:** [X hours / X days]
**Status:** [Planning | In Progress | Blocked | Complete]
```

---

### 3. Add Labels

**Required Labels:**

```bash
# Add type label (choose ONE)
gh issue edit [NUMBER] --add-label "Bug"           # Something broken
gh issue edit [NUMBER] --add-label "Enhancement"   # New feature/improvement
gh issue edit [NUMBER] --add-label "Task"          # Work item
gh issue edit [NUMBER] --add-label "User Story"    # User-facing feature
gh issue edit [NUMBER] --add-label "Epic"          # Collection of stories

# Add area label (choose ONE or MORE)
gh issue edit [NUMBER] --add-label "Frontend"      # UI/JS work
gh issue edit [NUMBER] --add-label "Backend"       # Server/API work
gh issue edit [NUMBER] --add-label "DevOps"        # Infrastructure
gh issue edit [NUMBER] --add-label "Security"      # Security-related
gh issue edit [NUMBER] --add-label "UI"            # Design/CSS

# Add priority label (choose ONE)
gh issue edit [NUMBER] --add-label "Priority: Critical"  # Production blocker
gh issue edit [NUMBER] --add-label "Priority: High"      # Important fix
gh issue edit [NUMBER] --add-label "Priority: Medium"    # Should fix soon
gh issue edit [NUMBER] --add-label "Priority: Low"       # Nice to have
```

**Available Labels:**
| Label | Description | When to Use |
|-------|-------------|-------------|
| `Bug` | Something broken | User-facing issue, error, crash |
| `Enhancement` | New feature/improvement | Adding functionality |
| `Task` | Work item | Part of larger epic |
| `User Story` | User-facing feature | Delivers user value |
| `Epic` | Collection of stories | Multiple related issues |
| `Frontend` | UI/JS work | HTML, CSS, JavaScript |
| `Backend` | Server/API work | Node.js, Python, Cloud Functions |
| `DevOps` | Infrastructure | Deployment, CI/CD, GCP |
| `Security` | Security-related | Auth, vulnerabilities, hardening |
| `UI` | Design/CSS | Visual design, styling |
| `Firebase` | Firebase services | Auth, Firestore, Functions |
| `Blocked` | Cannot proceed | Waiting on dependency |
| `Verified` | Fix verified | Test evidence provided |
| `Partial` | Partially implemented | Simplified or deferred |
| `Superseded` | Replaced by different approach | Architecture change |
| `Won't Do` | Intentional no-implement | Documented decision |

---

### 4. Add Milestone

**Command:**
```bash
gh issue edit [NUMBER] --milestone "Phase 5: Events and Elections Services"
```

**Available Milestones:**
- `Phase 5: Events and Elections Services` - Current phase (Epic #24, #43, #87, #192)
- `Phase 6: Production Readiness` - Future (load testing, monitoring)
- `Backlog` - Future work, not scheduled

**When to Use Milestone:**
- ✅ Issue is part of current/planned work
- ✅ Issue has clear delivery timeline
- ❌ Exploratory/research issues (no milestone until scoped)
- ❌ Won't Do / Superseded issues

---

### 5. Link to Epic

**Method 1: In Issue Body**
```markdown
**Related:** Epic #191 (Component Library)
```

**Method 2: As Comment**
```bash
gh issue comment [NUMBER] --body "**Related:** Epic #191 (Component Library)"
```

**Method 3: In Epic Body**
Update the Epic issue to list sub-issues:
```markdown
## Sub-Issues
- #193 - Dashboard modal refactoring
- #195 - createButton() component
- #196 - Button color fixes ✅
```

**Epic Mapping:**
| Epic | Description | Active Issues |
|------|-------------|---------------|
| #192 | Admin Elections Dashboard | In progress |
| #191 | Component Library | Closed (but ongoing work) |
| #186 | Member Voting Experience | In progress |
| #165 | Production Infrastructure | Blocked |
| #159 | Foreign Address Management | Future |

---

### 6. Add Projects (Optional)

**Current Projects:**
- None active (GitHub Projects not in use)

**Skip this step** unless project board is created.

---

### 7. Assign Owner (Optional)

**Command:**
```bash
gh issue edit [NUMBER] --add-assignee @gudrodur
```

**When to Assign:**
- ✅ Work has started (mark in-progress)
- ✅ Specific person is responsible
- ❌ Issue is in backlog (leave unassigned)

---

### 8. Add Estimate (In Body)

**Format in Issue Body:**
```markdown
**Estimate:** 2-3 hours
**Estimate:** 1-2 days
**Estimate:** 1 week
```

**Guidelines:**
- Small task: < 4 hours
- Medium task: 1-2 days
- Large task: 3-5 days
- Epic: Weeks (break down into smaller issues)

---

### 9. Link Relationships (Optional)

**Blockers:**
```bash
gh issue comment [NUMBER] --body "Blocked by: #XXX"
```

**Dependencies:**
```bash
gh issue comment [NUMBER] --body "Depends on: #XXX, #YYY"
```

**Related Work:**
```bash
gh issue comment [NUMBER] --body "Related: #XXX (similar issue)"
```

**Duplicates:**
```bash
gh issue close [NUMBER] --comment "Duplicate of #XXX"
```

---

## 📊 Complete Example

**Scenario:** Create issue for button component

### Step 1: Create Issue
```bash
gh issue create --repo sosialistaflokkurinn/ekklesia \
  --title "component: Create reusable button component (createButton)" \
  --body "$(cat <<'EOF'
## Problem

Buttons are inconsistently created across the app.

## Proposed Solution

Create `/js/components/button.js` with `createButton()` factory function.

## Files to Create

- `apps/members-portal/js/components/button.js`

## Acceptance Criteria

- [ ] createButton() function created
- [ ] Component documented
- [ ] Loading state works
- [ ] All variants render correctly

**Related:** Epic #191 (Component Library)
**Priority:** Medium
**Estimate:** 2-3 hours
EOF
)" \
  --label "Enhancement,Frontend" \
  --milestone "Phase 5: Events and Elections Services"
```

**Result:** Issue #195 created

### Step 2: Add Epic Reference (if not in body)
```bash
gh issue comment 195 --body "**Related:** Epic #191 (Component Library)"
```

### Step 3: Verify Metadata
```bash
gh issue view 195
```

**Check:**
- [x] Title follows format
- [x] Body has Problem, Solution, Acceptance Criteria
- [x] Labels: Enhancement, Frontend
- [x] Milestone: Phase 5
- [x] Epic reference: #191
- [x] Estimate: 2-3 hours

### Step 4: Close Issue (When Work Complete)

**After implementation is done:**

```bash
# Step 4a: Update issue body with actual implementation
gh issue edit 195 --body "$(cat <<'EOF'
## ✅ Completed Implementation

**What Was Done:**
- Created button component (244 lines)
- Refactored 5 buttons across 3 pages
- Implemented complex toggle pattern

**Commits:**
- 07650b3 - Button component system
- c354a25 - Elections retry buttons
- 131c5da - Events tab buttons

**Files Modified:**
- apps/members-portal/js/components/button.js (created)
- apps/members-portal/js/dashboard.js (modified)
- [... 7 more files]

**Acceptance Criteria Met:**
- [x] createButton() function created ✅
- [x] Component documented ✅
- [x] All variants work ✅

**Estimate:** 2-3 hours → **Actual:** 4 hours

**Related:** Epic #191
EOF
)"

# Step 4b: List and identify WIP comments to delete
gh api repos/sosialistaflokkurinn/ekklesia/issues/195/comments \
  --jq '.[] | {id: .id, body: .body | split("\n")[0]}'

# Step 4c: Delete WIP comments (requires issue to be open)
# Note: Issue #195 was already closed, so reopen first
gh issue reopen 195 --comment "Reopening to clean up comments"
gh api -X DELETE repos/sosialistaflokkurinn/ekklesia/issues/comments/3498998957
gh api -X DELETE repos/sosialistaflokkurinn/ekklesia/issues/comments/3499019489

# Step 4d: Close with final summary
gh issue close 195 --comment "$(cat <<'EOF'
## ✅ Complete

Created reusable button component and refactored 5 functional buttons.
All hardcoded "Loading..." buttons eliminated.

See updated issue body for full details.

**Commits:** 07650b3, c354a25, 131c5da
**Related:** Epic #191
EOF
)"
```

**Result:** Issue #195 properly closed with:
- ✅ Body reflects actual implementation
- ✅ WIP comments deleted
- ✅ Clean final summary
- ✅ Complete audit trail preserved

---

## ✅ Post-Creation Checklist

After creating issue, verify:

- [ ] **Title** - Clear, follows format
- [ ] **Body** - Complete (Problem, Solution, Acceptance Criteria)
- [ ] **Labels** - Type + Area + Priority
- [ ] **Milestone** - Assigned (if applicable)
- [ ] **Epic Link** - Referenced in body or comment
- [ ] **Estimate** - Included in body
- [ ] **Relationships** - Linked (if blockers/dependencies)
- [ ] **Assignee** - Set (if work started)
- [ ] **No PII** - No real kennitalas, names, emails, phone numbers

---

## 🔄 Updating Existing Issues

### Add Labels
```bash
gh issue edit [NUMBER] --add-label "Priority: High"
```

### Change Milestone
```bash
gh issue edit [NUMBER] --milestone "Phase 6: Production Readiness"
```

### Update Body
```bash
gh issue edit [NUMBER] --body "$(cat <<'EOF'
[New body content]
EOF
)"
```

### Close Issue (Proper Workflow)

**IMPORTANT:** When closing an issue, follow these steps:

#### Step 1: Update Issue Body
Update the issue body to reflect what was actually implemented:

```bash
gh issue edit [NUMBER] --body "$(cat <<'EOF'
## ✅ Completed Implementation

**What Was Done:**
- Implemented feature X
- Fixed bug Y
- Refactored component Z

**Commits:**
- abc1234 - Description
- def5678 - Description

**Files Modified:**
- path/to/file1.js
- path/to/file2.css

**Acceptance Criteria Met:**
- [x] Criterion 1 ✅
- [x] Criterion 2 ✅
- [x] Tests pass ✅

**Related:**
- Epic #XXX
- Issue #YYY (dependency)

**Original Estimate:** 2-3 hours
**Actual Time:** 3 hours
EOF
)"
```

#### Step 2: Delete Implementation Comments
Remove work-in-progress comments that are no longer relevant:

**IMPORTANT:** Comment deletion only works when issue is **OPEN**. If issue is already closed:

```bash
# 1. Reopen issue first
gh issue reopen [NUMBER] --comment "Reopening to clean up comments per checklist"

# 2. List all comments and their IDs
gh api repos/sosialistaflokkurinn/ekklesia/issues/[NUMBER]/comments \
  --jq '.[] | {id: .id, created: .created_at, body: .body | split("\n")[0:2] | join(" ")}'

# 3. Delete specific WIP comments by ID
gh api -X DELETE repos/sosialistaflokkurinn/ekklesia/issues/comments/[COMMENT_ID]

# 4. Verify deletion
gh issue view [NUMBER] --comments
```

**Comments to Delete:**
- ❌ "Starting work on this"
- ❌ "WIP: First attempt"
- ❌ "Need to test X before continuing"
- ❌ Progress updates during implementation ("Progress Update - X Complete")

**Comments to Keep:**
- ✅ Final summary/completion comment
- ✅ Important decisions or discoveries
- ✅ Links to related issues or discussions
- ✅ Known limitations or future work
- ✅ Epic references

#### Step 3: Close with Summary

**Note:** If you reopened the issue in Step 2 to delete comments, this will close it again with proper summary.

```bash
gh issue close [NUMBER] --comment "$(cat <<'EOF'
## ✅ Complete

[Brief 1-2 sentence summary of what was accomplished]

See updated issue body for full details.

**Commits:** abc1234, def5678
**Related:** Epic #XXX
EOF
)"
```

**Example Summary Format:**
```markdown
## ✅ Complete

Created reusable button component and refactored 5 functional buttons
across dashboard, elections, and events pages. All hardcoded "Loading..."
buttons eliminated.

**See updated issue body for full implementation details.**

**Commits:** 07650b3, c354a25, 131c5da
**Related:** Epic #191
```

### Reopen Issue
```bash
gh issue reopen [NUMBER] --comment "Reopening - [reason]"
```

---

## 🏷️ Label Quick Reference

**Copy-paste commands:**

```bash
# Type (choose ONE)
--add-label "Bug"
--add-label "Enhancement"
--add-label "Task"
--add-label "User Story"
--add-label "Epic"

# Area (choose ONE or MORE)
--add-label "Frontend"
--add-label "Backend"
--add-label "DevOps"
--add-label "Security"
--add-label "UI"
--add-label "Firebase"

# Priority (choose ONE)
--add-label "Priority: Critical"
--add-label "Priority: High"
--add-label "Priority: Medium"
--add-label "Priority: Low"

# Status (optional)
--add-label "Blocked"
--add-label "Verified"
--add-label "Partial"
```

---

## 📝 Issue Templates

### Bug Report
```markdown
## Problem

**What's broken:**
[Description]

**Steps to reproduce:**
1. Step 1
2. Step 2
3. See error

**Expected behavior:**
[What should happen]

**Actual behavior:**
[What actually happens]

**Environment:**
- Browser: Chrome 120
- Device: Desktop
- URL: /members-area/dashboard.html

## Solution

[How to fix]

## Files to Modify

- `path/to/file.js` - Fix X

**Priority:** High
**Estimate:** 2 hours
```

### Feature Request
```markdown
## User Story

As a [user type], I want [goal] so that [benefit].

## Current State

[What exists now]

## Proposed Solution

[What to build]

## Acceptance Criteria

- [ ] Feature works as described
- [ ] Tests added
- [ ] Documentation updated

**Related:** Epic #XXX
**Priority:** Medium
**Estimate:** 1 week
```

### Refactoring Task
```markdown
## Problem

[Why code needs refactoring]

## Proposed Solution

[What to refactor]

**Before:**
```javascript
// Old code
```

**After:**
```javascript
// New code
```

## Benefits

1. ✅ Benefit 1
2. ✅ Benefit 2

**Related:** Epic #191
**Estimate:** 3 hours
```

---

## 🔒 PII Protection Guidelines

**CRITICAL:** Never include Personally Identifiable Information (PII) in GitHub issues.

### What is PII?

**Personal Information to NEVER include:**
- ❌ Real Icelandic kennitalas (SSN)
- ❌ Real names of members
- ❌ Real email addresses
- ❌ Real phone numbers
- ❌ Real physical addresses
- ❌ Real Firebase UIDs
- ❌ Screenshots containing personal data

### Safe Examples to Use

**Always use placeholder format in examples:**

```markdown
# ✅ GOOD - Placeholder format
- Kennitala: DDMMYY-XXXX (generic placeholder)
- Name: Jón Jónsson (generic name)
- Email: example@example.com
- Phone: 555-XXXX or NNN-NNNN
- Address: Austurstræti 1, 101 Reykjavík (generic location)
- Firebase UID: abc123ExampleUserUID456

# ❌ BAD - Real data
- Kennitala: 000000-0000 (looks too real)
- Name: [Real member name]
- Email: real.person@gmail.com
```

### Before Creating/Updating Issue

**Checklist:**
- [ ] No real kennitalas (use DDMMYY-XXXX placeholder format)
- [ ] No real names (use Jón Jónsson, Anna Önnudóttir)
- [ ] No real emails (use example@example.com)
- [ ] No real phone numbers (use 555-XXXX or NNN-NNNN)
- [ ] No real addresses (use generic locations)
- [ ] No screenshots with personal data visible
- [ ] Code examples use placeholder data

### Pre-commit Hook Protection

The repository has a pre-commit hook that scans for PII:

```bash
# Hook checks for:
- Icelandic kennitala patterns (DDMMYY-NNNN)
- Real email addresses (excludes example.com)
- Phone number patterns
- Long alphanumeric UIDs

# If blocked:
git commit --no-verify  # ONLY if you're sure it's safe
```

**When Hook Blocks:**
1. Review the detected pattern
2. Replace with fake example data
3. Commit normally (without --no-verify)

### Reporting PII Exposure

If you accidentally commit PII:

1. **Immediate:** Delete the commit/comment
2. **Notify:** File urgent issue with "Security" label
3. **Scrub:** Use `git filter-branch` or BFG to remove from history
4. **Rotate:** Change any exposed credentials

**Related:**
- Pre-commit hook: `.git/hooks/pre-commit`
- Security incidents: Label "Security"

---

## 🚫 Common Mistakes

### ❌ Don't Do

1. **Vague titles**
   - Bad: "Fix bug"
   - Good: "fix(auth): Login redirect fails after session timeout"

2. **Missing labels**
   - Every issue needs: Type + Area + Priority

3. **No Epic link**
   - Always link to Epic (if applicable)

4. **No acceptance criteria**
   - How do you know it's done?

5. **No estimate**
   - Helps with planning and prioritization

6. **Creating duplicate issues**
   - Search first!

7. **Including PII (Personal Information)**
   - Never include real kennitalas, names, emails, phone numbers
   - Use placeholder format: DDMMYY-XXXX, example@example.com

---

## 📚 Related Documentation

- [Git Workflow Examples](./git/GIT_WORKFLOW_EXAMPLES.md)
- [GitHub Automation Guide](../../../.github/GITHUB_AUTOMATION_GUIDE.md)
- [Pull Request Template](../../../.github/pull_request_template.md)

---

**Created:** 2025-11-06
**Maintained By:** Development team
**Questions:** See GitHub Issues or team documentation
