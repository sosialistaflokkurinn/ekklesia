# Branch Diff Documentation Audit Task

**Task**: Review changes between `feature/security-hardening` branch and `main` branch, evaluate documentation usefulness, and archive obsolete documentation.

**Project**: Ekklesia e-democracy platform (GCP project: ekklesia-prod-10-2025)

---

## Your Mission

You will:
1. Generate a complete diff between the current branch and main
2. Analyze all documentation files (.md, .txt, README files)
3. Evaluate which documentation is still relevant vs obsolete
4. Move obsolete documentation to appropriate archive directories
5. Update the documentation map if needed

---

## Step 1: Generate Branch Diff

### Get Current Branch Name

```bash
# Check current branch
git branch --show-current
```

**Expected Output**: `feature/security-hardening`

### Get Main Branch Name

```bash
# Check available branches
git branch -a
```

**Expected**: `main` or `master` (use whichever exists)

### Generate Complete Diff

```bash
# Get diff summary (files changed)
git diff main --stat

# Get full diff (all changes)
git diff main > /tmp/branch-diff.txt

# Count lines changed
wc -l /tmp/branch-diff.txt
```

### Get Commit Log Difference

```bash
# See all commits on this branch not in main
git log main..HEAD --oneline

# See detailed commit messages
git log main..HEAD --pretty=format:"%h - %an, %ar : %s"

# Count commits
git log main..HEAD --oneline | wc -l
```

### List Only Documentation Files Changed

```bash
# Find all .md files changed
git diff main --name-only | grep '\.md$'

# Find all documentation-related changes
git diff main --name-only | grep -E '\.(md|txt|rst|adoc)$'

# See which docs were added vs modified vs deleted
git diff main --name-status | grep -E '\.(md|txt)$'
```

**Output Format**:
- `A` = Added (new file)
- `M` = Modified (changed file)
- `D` = Deleted (removed file)
- `R` = Renamed (moved file)

---

## Step 2: Analyze Documentation Changes

### Read Changed Documentation Files

For each `.md` file in the diff:

```bash
# Get the diff for specific file
git diff main docs/status/CURRENT_PRODUCTION_STATUS.md

# See the file content on main branch
git show main:docs/status/CURRENT_PRODUCTION_STATUS.md

# See the file content on current branch (feature/security-hardening)
git show HEAD:docs/status/CURRENT_PRODUCTION_STATUS.md

# Compare side by side (if difftool installed)
git difftool main HEAD -- docs/status/CURRENT_PRODUCTION_STATUS.md
```

### Identify Documentation Categories

**Active Documentation** (keep in main repository):
- Production status documents (CURRENT_PRODUCTION_STATUS.md)
- Architecture overviews (SYSTEM_ARCHITECTURE_OVERVIEW.md)
- Operational procedures (OPERATIONAL_PROCEDURES.md)
- Usage context (USAGE_CONTEXT.md)
- Design documents for current services
- Security documentation for active measures
- Testing guides for current architecture

**Archival Documentation** (move to `/archive`):
- Historical testing logs (completed migrations)
- Deprecated service documentation (ZITADEL, old Members service)
- Legacy design proposals (superseded)
- Old migration guides (completed)
- Temporary investigation notes (resolved)
- Infrastructure setup guides (no longer relevant)

### Evaluation Criteria

Ask these questions for each document:

1. **Timeliness**: Is this about current or past state?
   - Current → Keep
   - Past/historical → Archive

2. **Actionability**: Does someone need this to operate the system?
   - Yes → Keep
   - No (historical reference only) → Archive

3. **Maintenance**: Will this document need regular updates?
   - Yes → Keep
   - No (one-time, completed) → Archive

4. **Context**: Is this about active services or decommissioned ones?
   - Active → Keep
   - Decommissioned → Archive

---

## Step 3: Check Existing Archive Structure

### Explore Current Archive

```bash
# List archive directory structure
tree /home/gudro/Development/projects/ekklesia/archive -L 3

# Or without tree command:
find /home/gudro/Development/projects/ekklesia/archive -type d | head -20

# See what types of files are already archived
find /home/gudro/Development/projects/ekklesia/archive -name "*.md" | head -20
```

### Understand Archive Organization

**Current Archive Structure** (as of Oct 15, 2025):

```
archive/
├── docs/                          # Obsolete documentation
│   ├── docs-2025-10-13/          # Documentation consolidated Oct 13
│   │   ├── claude/               # Old .claude/ directory
│   │   └── docs/                 # Old docs structure
│   └── reviews/                  # PR review responses
│       ├── pr28/
│       └── pr29-drafts/
├── ops/                          # Operational history
│   └── testing-logs/             # Completed testing logs
│       └── EVENTS_SERVICE_TESTING_LOG.md
├── projects/                     # Abandoned/evaluated projects
│   ├── ekklesia-platform-evaluation/
│   └── zitadel-legacy/
└── tools/                        # Deprecated scripts/utilities
    └── legacy/
```

**Archive Naming Convention**:
- Use date-based directories for time-based archives: `docs-YYYY-MM-DD/`
- Use descriptive names for project archives: `zitadel-legacy/`, `portal-evaluation/`
- Include README.md in each archive explaining what was archived and why

---

## Step 4: Use GCP Tools to Verify Service Status

Before archiving service-related documentation, verify the service is truly decommissioned.

### Check Cloud Run Services

```bash
# List all Cloud Run services
gcloud run services list \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025 \
  --format="table(SERVICE,URL,LAST_MODIFIED)"

# Check if specific service exists (example: old members service)
gcloud run services describe members \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025 2>&1
```

**Expected Output**:
- If service exists: Service details JSON
- If deleted: `ERROR: (gcloud.run.services.describe) Cannot find service [members]`

### Check Firebase Hosting Deployments

```bash
# Check current Firebase project
firebase projects:list

# List hosting sites
firebase hosting:sites:list --project=ekklesia-prod-10-2025

# Get current hosting version
firebase hosting:channel:list --project=ekklesia-prod-10-2025
```

### Check Cloud Functions (Gen 2)

```bash
# List all Cloud Functions
gcloud functions list \
  --gen2 \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025 \
  --format="table(NAME,STATE,UPDATE_TIME)"

# Check specific function
gcloud functions describe handleKenniAuth \
  --gen2 \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025
```

### Check Cloud SQL Instances

```bash
# List all Cloud SQL instances
gcloud sql instances list \
  --project=ekklesia-prod-10-2025 \
  --format="table(NAME,DATABASE_VERSION,TIER,STATE)"

# Check specific database
gcloud sql instances describe ekklesia-db \
  --project=ekklesia-prod-10-2025
```

### Check Firestore Collections

```bash
# List Firestore databases
gcloud firestore databases list \
  --project=ekklesia-prod-10-2025

# Use Firebase CLI to check collections (requires authentication)
firebase firestore:indexes --project=ekklesia-prod-10-2025
```

**Note**: To query actual Firestore data, you need to use Firebase Console or a script.

### Check Secret Manager Secrets

```bash
# List all secrets
gcloud secrets list \
  --project=ekklesia-prod-10-2025 \
  --format="table(NAME,CREATED,REPLICATION)"

# Check if specific secret exists (example: old zitadel secrets)
gcloud secrets describe zitadel-db-password \
  --project=ekklesia-prod-10-2025 2>&1
```

**Expected**: Error if secret was deleted (means documentation can be archived)

---

## Step 5: GraphQL API (If Applicable)

**Note**: Ekklesia does not currently use GraphQL, but if you encounter GraphQL-related documentation:

### Check for GraphQL Endpoints

```bash
# Check if any Cloud Run service exposes GraphQL
gcloud run services list \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025 \
  --format="value(url)"

# Test each URL for GraphQL endpoint
curl -X POST https://SERVICE-URL.run.app/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __schema { queryType { name } } }"}'
```

**Expected**: 404 Not Found (no GraphQL in Ekklesia)

If GraphQL documentation exists → Archive it (not used in current architecture)

---

## Step 6: Archive Obsolete Documentation

### Create Archive Directory (If Needed)

```bash
# Create dated archive directory
mkdir -p /home/gudro/Development/projects/ekklesia/archive/docs/docs-2025-10-15

# Or create service-specific archive
mkdir -p /home/gudro/Development/projects/ekklesia/archive/projects/old-members-service
```

### Move Files to Archive

```bash
# Example: Archive old Members service documentation
git mv docs/services/OLD_MEMBERS_SERVICE.md \
  archive/projects/old-members-service/

# Archive completed testing logs
git mv docs/testing/EVENTS_SERVICE_TESTING_LOG.md \
  archive/ops/testing-logs/

# Archive deprecated design proposals
git mv docs/design/ZITADEL_INTEGRATION.md \
  archive/docs/docs-2025-10-15/design/
```

**Important**: Use `git mv` instead of `mv` to preserve Git history!

### Create Archive README

For each archive directory, create a README explaining what was archived:

```bash
cat > /home/gudro/Development/projects/ekklesia/archive/docs/docs-2025-10-15/README.md <<'EOF'
# Documentation Archive - October 15, 2025

**Archived Date**: 2025-10-15
**Reason**: Documentation superseded by frontend architecture refactor

## What Was Archived

- Old frontend architecture docs (pre-ES6 modules)
- Legacy Firebase global scope patterns
- Temporary investigation notes (resolved)

## Why Archived

The frontend architecture was completely refactored on Oct 15, 2025:
- ES6 modules replaced global scope
- Modular Firebase SDK v10.7.1
- Centralized i18n (no hardcoded strings)

These documents describe the old architecture and are no longer relevant.

## Related Active Documentation

See current architecture:
- `/docs/status/CURRENT_PRODUCTION_STATUS.md`
- `/members/public/firebase/app.js` (new Firebase layer)
- `/members/public/ui/dom.js` (new UI utilities)

**Last Updated**: 2025-10-15
EOF
```

### Commit Archive Changes

```bash
# Stage all archive moves
git add archive/

# Stage any deletions
git add -u

# Commit with descriptive message
git commit -m "docs: archive obsolete documentation from security-hardening branch

- Move legacy frontend docs to archive/docs/docs-2025-10-15/
- Move completed testing logs to archive/ops/testing-logs/
- Add archive README explaining what was moved and why

Related to frontend architecture refactor (Oct 15, 2025)"
```

---

## Step 7: Update Documentation Map (If Exists)

### Check for Documentation Index

```bash
# Look for documentation map/index
find /home/gudro/Development/projects/ekklesia -name "*MAP*.md" -o -name "*INDEX*.md" | grep -i doc

# Or check common locations
ls -la /home/gudro/Development/projects/ekklesia/docs/DOCUMENTATION_MAP.md
ls -la /home/gudro/Development/projects/ekklesia/docs/INDEX.md
ls -la /home/gudro/Development/projects/ekklesia/docs/README.md
```

### Update the Map

If a documentation map exists, update it to:
1. Remove archived documents from active list
2. Add note about archive location
3. Update "Last Updated" date

Example update:

```markdown
## Archived Documentation

Obsolete documentation is moved to `/archive/` with README explaining context.

**Recent Archives**:
- **Oct 15, 2025**: Legacy frontend docs → `archive/docs/docs-2025-10-15/`
- **Oct 13, 2025**: Documentation consolidation → `archive/docs/docs-2025-10-13/`
- **Oct 11, 2025**: Testing logs → `archive/ops/testing-logs/`
```

---

## Step 8: Validation Checklist

Before completing the task, verify:

### Git Validation

```bash
# Check no untracked files left behind
git status

# Verify archive directory is tracked
git ls-files archive/ | head -10

# Verify old file locations are deleted (if moved)
git ls-files docs/ | grep -i "legacy\|old\|deprecated"

# Check commit history is preserved
git log --follow archive/docs/docs-2025-10-15/SOME_FILE.md
```

### Archive Structure Validation

```bash
# Every archive directory should have README.md
find archive/ -type d -mindepth 2 -maxdepth 2 -exec test ! -f {}/README.md \; -print

# Check archive dates are consistent
find archive/ -type d -name "*2025*" | sort
```

### Documentation Links Validation

```bash
# Find broken links (files that link to archived docs)
grep -r "docs/.*\.md" docs/ | grep -v "archive/" | grep -E "(ZITADEL|legacy|old)"

# Find links that should be updated to archive/
grep -r "\[.*\](.*docs/design/ZITADEL" docs/
```

**Action**: Update any links that now point to archived files.

---

## Step 9: Generate Summary Report

Create a summary document:

```bash
cat > /tmp/archive-summary-$(date +%Y-%m-%d).md <<EOF
# Documentation Archive Summary

**Date**: $(date +%Y-%m-%d)
**Branch**: $(git branch --show-current)
**Commits Reviewed**: $(git log main..HEAD --oneline | wc -l)

## Files Archived

$(git diff main --name-status | grep '^R.*archive/' | wc -l) files moved to archive

### Breakdown by Category

**Obsolete Service Documentation**:
$(git diff main --name-status | grep '^R.*archive/projects' | cut -f2)

**Completed Testing Logs**:
$(git diff main --name-status | grep '^R.*archive/ops' | cut -f2)

**Historical Documentation**:
$(git diff main --name-status | grep '^R.*archive/docs' | cut -f2)

## Active Documentation (Kept in /docs)

$(git ls-files docs/*.md | wc -l) active documentation files

### Categories

**Status**:
$(git ls-files docs/status/*.md)

**Design**:
$(git ls-files docs/design/*.md | head -5)

**Testing**:
$(git ls-files docs/testing/*.md)

## Archive Locations

$(find archive/ -type d -mindepth 1 -maxdepth 1)

## Validation

- [x] All archived files moved with \`git mv\` (history preserved)
- [x] Archive README files created
- [x] Documentation map updated
- [x] No broken links in active docs
- [x] Git status clean

## Next Steps

1. Review this summary
2. Merge branch to main if approved
3. Delete feature branch after merge

**Generated**: $(date)
EOF

cat /tmp/archive-summary-$(date +%Y-%m-%d).md
```

---

## Tool Reference Quick Guide

### gcloud (Google Cloud CLI)

**Authentication**:
```bash
# Check current account
gcloud auth list

# Login if needed
gcloud auth login

# Set project
gcloud config set project ekklesia-prod-10-2025
```

**Common Commands**:
```bash
# List resources
gcloud run services list --region=europe-west2
gcloud functions list --gen2 --region=europe-west2
gcloud sql instances list
gcloud secrets list

# Describe specific resource
gcloud run services describe SERVICE_NAME --region=europe-west2
gcloud sql instances describe INSTANCE_NAME

# Check service health
gcloud run services describe elections-service \
  --region=europe-west2 \
  --format="value(status.conditions[0].message)"
```

**Output Formatting**:
```bash
# Table format
--format="table(NAME,STATE,UPDATE_TIME)"

# JSON format
--format=json

# Get specific value
--format="value(status.url)"
```

### firebase (Firebase CLI)

**Authentication**:
```bash
# Login to Firebase
firebase login

# List projects
firebase projects:list

# Use specific project
firebase use ekklesia-prod-10-2025
```

**Common Commands**:
```bash
# List hosting sites
firebase hosting:sites:list

# List deployed functions
firebase functions:list

# Check Firestore indexes
firebase firestore:indexes

# Get project info
firebase projects:list
```

### git

**Branch Comparison**:
```bash
# Compare branches
git diff main..feature-branch

# List files changed
git diff main --name-only

# Show file status (A/M/D/R)
git diff main --name-status

# See commits difference
git log main..HEAD --oneline
```

**File History**:
```bash
# See file history (even if renamed)
git log --follow -- path/to/file.md

# See who changed file
git blame path/to/file.md

# See file content from different branch
git show main:path/to/file.md
```

**Moving Files**:
```bash
# Move file (preserves history)
git mv old/path/file.md new/path/file.md

# Stage deletions
git add -u

# Stage everything
git add .
```

### find (File Search)

```bash
# Find all .md files
find /path -name "*.md"

# Find directories
find /path -type d

# Find files modified in last 7 days
find /path -mtime -7 -name "*.md"

# Execute command on results
find /path -name "*.md" -exec wc -l {} \;
```

### grep (Text Search)

```bash
# Search in files
grep -r "pattern" /path

# Case insensitive
grep -ri "pattern" /path

# Show line numbers
grep -rn "pattern" /path

# Search specific file types
grep -r "pattern" --include="*.md" /path

# Exclude directories
grep -r "pattern" --exclude-dir="archive" /path
```

### jq (JSON Processing)

```bash
# Pretty print JSON
curl https://api.example.com | jq

# Extract field
curl https://api.example.com | jq '.status'

# Filter array
curl https://api.example.com | jq '.items[] | select(.name == "foo")'
```

---

## Recommended Workflow

1. **Understand the changes**:
   ```bash
   git log main..HEAD --oneline
   git diff main --stat
   ```

2. **Review documentation changes**:
   ```bash
   git diff main --name-only | grep '\.md$'
   ```

3. **Verify service status** (for each service mentioned in docs):
   ```bash
   gcloud run services list --region=europe-west2
   firebase hosting:sites:list
   ```

4. **Categorize documentation**:
   - Active (current architecture)
   - Archival (obsolete/historical)

5. **Create archive structure**:
   ```bash
   mkdir -p archive/docs/docs-2025-10-15
   ```

6. **Move obsolete docs**:
   ```bash
   git mv old/file.md archive/docs/docs-2025-10-15/
   ```

7. **Add archive README**:
   ```bash
   vim archive/docs/docs-2025-10-15/README.md
   ```

8. **Commit changes**:
   ```bash
   git add archive/
   git commit -m "docs: archive obsolete documentation"
   ```

9. **Validate**:
   ```bash
   git status
   find archive/ -name "README.md"
   grep -r "archive/" docs/
   ```

10. **Generate summary**:
    ```bash
    # Use Step 9 template above
    ```

---

## Example: Archiving ZITADEL Documentation

**Scenario**: ZITADEL was replaced by Firebase Auth on Oct 7, 2025. Archive all ZITADEL-related documentation.

### Step 1: Find ZITADEL References

```bash
# Find all ZITADEL mentions
grep -r "ZITADEL" docs/ --include="*.md" -l

# Check if ZITADEL service still exists
gcloud run services describe zitadel \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025 2>&1
```

**Result**: Service deleted → safe to archive docs

### Step 2: Create Archive

```bash
# Create archive directory
mkdir -p archive/projects/zitadel-legacy/docs

# Move docs
git mv docs/auth/ZITADEL_SETUP.md archive/projects/zitadel-legacy/docs/
git mv docs/migration/ZITADEL_TO_FIREBASE.md archive/projects/zitadel-legacy/docs/

# Create README
cat > archive/projects/zitadel-legacy/README.md <<'EOF'
# ZITADEL Legacy Authentication Service

**Decommissioned**: 2025-10-07
**Replaced By**: Firebase Authentication

## What Was ZITADEL?

ZITADEL was an identity management service used for authentication before migration to Firebase Auth.

## Why Archived?

- ZITADEL service deleted from Cloud Run (Oct 7, 2025)
- All users migrated to Firebase Authentication
- Cost savings: $135/month → $0/month
- Simpler architecture with Firebase + Kenni.is direct PKCE

## Related Active Documentation

See current auth implementation:
- `/docs/status/CURRENT_PRODUCTION_STATUS.md` (Members Service section)
- `/members/public/js/login.new.js` (Firebase auth code)

**Archived**: 2025-10-15
EOF

# Commit
git add archive/projects/zitadel-legacy/
git commit -m "docs: archive ZITADEL legacy authentication docs

ZITADEL service was decommissioned on Oct 7, 2025 and replaced
with Firebase Authentication. All related documentation moved
to archive/projects/zitadel-legacy/ for historical reference.

Related: Migration to Firebase Auth (PR #28)"
```

### Step 3: Update Documentation Map

```bash
# Remove ZITADEL from active docs list
# Add to archive section
```

---

## Final Deliverable

Provide a summary report with:

1. **Branch Comparison**:
   - Number of commits: `X commits`
   - Files changed: `Y files`
   - Documentation files changed: `Z .md files`

2. **Archive Actions**:
   - Files moved to archive: `N files`
   - Archive locations: `archive/docs/..., archive/projects/...`
   - Archive READMEs created: `M directories`

3. **Active Documentation**:
   - Files kept in `/docs`: `P files`
   - Categories: Status, Design, Testing, Security, etc.

4. **Validation**:
   - Git history preserved: ✅/❌
   - Archive READMEs present: ✅/❌
   - No broken links: ✅/❌
   - Git status clean: ✅/❌

5. **Recommendations**:
   - Ready to merge: Yes/No
   - Additional actions needed: List any issues

---

## Questions to Answer

Your final report should answer:

1. What documentation was created/modified in this branch?
2. Which documents are still relevant (keep in `/docs`)?
3. Which documents are obsolete (move to `/archive`)?
4. What services were decommissioned (verify with `gcloud`)?
5. Are there any broken links that need updating?
6. Is the archive well-organized with READMEs?
7. Is the branch ready to merge to main?

---

**Estimated Time**: 1-2 hours
**Priority**: Medium
**Complexity**: Moderate (requires understanding of Git, GCP services, and project history)

**Good luck!** 🚀
