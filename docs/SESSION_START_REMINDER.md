# Session Start Reminder

## Security & Git Rules

1. **NEVER BYPASS GIT HOOKS (--no-verify):**
   - Pre-commit hooks detect secrets, PII, security issues
   - If hook fails: INVESTIGATE → UNDERSTAND → FIX
   - Fixed Nov 7, 2025: Timeouts (5s total, 1s per grep) prevent hanging
   - Example: Hook detected exposed CF_API_TOKEN (we were removing it - GOOD)

2. **GITIGNORED FILES (see docs/development/LOCAL_ONLY_FILES.md):**
   - Policy docs: docs/policy/ (meeting notes, draft policies)
   - PII patterns: *KENNITALA*.md, *kennitala*.md, *DUPLICATE_SSN*.md
   - Admin scripts: services/members/scripts/check-*.js (queries production with PII)
   - .claude/ directory (personal workflow config)

3. **PRE-COMMIT SAFETY CHECK:**
   ```bash
   # Before 'git add' or 'git commit', check if file is gitignored
   git check-ignore -v path/to/file

   # List staged files that match gitignore patterns
   git diff --cached --name-only | while read f; do
     git check-ignore -q "$f" && echo "WARNING: $f matches .gitignore"
   done
   ```

   IF YOU SEE A MATCH:
   - STOP immediately
   - Check LOCAL_ONLY_FILES.md for why it's ignored
   - Verify: Adding secrets? STOP. Removing secrets? OK.
   - If unsure, ASK USER

4. **CRITICAL RULES:**
   - NEVER use 'git add -f' (force add) without user approval
   - NEVER commit files from docs/policy/
   - NEVER commit files matching *KENNITALA* or *kennitala*
   - ALWAYS verify with git check-ignore before committing

---

## Project Structure

**ALLOWED IN ROOT:**
- Config: .gitignore, package.json, firebase.json, README.md
- Directories: /apps/, /scripts/, /docs/, /testing/, /services/

**FORBIDDEN IN ROOT:**
- Binaries (cloud-sql-proxy, executables)
- Temp files (.log, .json audits, backups)
- Debug/dev HTML files
- Scattered documentation
- Test reports (use /docs/testing/reports/)
- Database scripts (use /scripts/database/)
- Dev tools (use /apps/members-portal/dev-tools/)

**USE tmp/ (PROJECT TMP) FOR:**
- Temporary work, experiments, debugging outputs
- Work-in-progress, prototypes, plans
- Files with no preservation value
- Quick tests
- NOTE: Use project tmp/ NOT system /tmp/

**STRUCTURE:**
- /apps/members-portal/ - Frontend (hub: dashboard + elections/events/policy areas)
- /docs/ - Documentation (architecture, dev, testing, operations)
- /scripts/ - Automation (database, deployment)
- /services/ - Backend (elections, events, members)
- /testing/ - Test code (integration tests)
- tmp/ - TEMPORARY FILES (project tmp, NOT system /tmp/)

---

## Documentation Maintenance

Key docs loaded at session start:
1. CURRENT_DEVELOPMENT_STATUS.md - System state, services, infrastructure
2. OPERATIONAL_PROCEDURES.md - Deployment, operations, scaling
3. CLOUD_RUN_SERVICES.md - 13 Cloud Run services, secrets
4. SESSION_START_REMINDER.md - Security rules, PII guidelines

**WHEN TO UPDATE:**
- After deployments: Update CURRENT_DEVELOPMENT_STATUS.md
- After infrastructure changes: Update CLOUD_RUN_SERVICES.md
- After security changes: Update SESSION_START_REMINDER.md
- After new workflows: Update OPERATIONAL_PROCEDURES.md

---

## Critical Deployment Warning (Issue #276)

**Firebase Deploy Resets Cloud Run Secrets!**

**PROBLEM:**
- 'firebase deploy --only functions' RESETS secret config on Cloud Run
- Has broken authentication 6+ times (2 hours debugging each)
- DJANGO_API_TOKEN, KENNI_IS_CLIENT_SECRET get wiped

**SAFE DEPLOYMENT:**

1. Frontend Only (SAFE) - **MUST run from services/members/**:
   ```bash
   cd /home/gudro/Development/projects/ekklesia/services/members
   firebase deploy --only hosting  # Doesn't affect secrets
   ```

   **IMPORTANT:** firebase.json is in services/members/, NOT project root!

2. Backend Services (USE SCRIPTS):
   ```bash
   cd services/elections && ./deploy.sh  # Includes secrets
   cd services/events && ./deploy.sh     # Includes secrets
   ```

3. ALWAYS Verify After ANY Firebase Command:
   ```bash
   gcloud run services describe SERVICE \
     --region=europe-west2 --project=ekklesia-prod-10-2025 \
     --format="json" | jq '.spec.template.spec.containers[0].env[] | select(.valueFrom.secretKeyRef != null)'
   ```

**NEVER:** `firebase deploy --only functions` (Resets secrets!)

---

## Frontend Best Practices

**MODULE IMPORTS:**
- Check import paths after refactoring/moving files
- Use relative paths consistently (./ or ../)
- Test imports in browser console: Check for 404s

**ASYNC/RACE CONDITIONS:**
- Always await async functions (fetch, Firebase calls)
- Handle loading states (show spinner, disable buttons)
- Prevent double submissions (disable button after click)

**NULL/UNDEFINED HANDLING:**
- Check if element exists before manipulating: `if (!el) return;`
- Use optional chaining: `obj?.property`
- Provide fallbacks: `data || defaultValue`

---

## Testing Checklist

**BEFORE EVERY COMMIT:**

1. **Browser Console Check** (Mandatory):
   - Open DevTools → Console tab
   - Refresh page → Look for errors
   - Perform action you changed → Watch for new errors
   - Check Network tab → No 404s on JS/CSS files

2. **Happy Path Testing** (Normal flow):
   - User logs in → Dashboard loads
   - Click feature → Expected result happens
   - Submit form → Success message shows

3. **Edge Case Testing** (Error conditions):
   - Missing data → Graceful error (not crash)
   - Network error → Retry or error message
   - Rapid clicks → No duplicate submissions

---

## Adding New Pages

**Quick Reference:** docs/development/guides/ADDING_NEW_PAGES_GUIDE.md

**3 Steps:**
1. HTML boilerplate (DOCTYPE, head, body.authenticated)
2. Navigation: `await initNavHeader(NAV_CONFIGS.area);`
3. Page script: `initAuthenticatedPage()` → Your logic

**NAV_CONFIGS (13 available):**
- Members: members, membersProfile, elections, events, policySession
- Admin: admin, adminMembers, adminMemberProfile, adminSync*
- Elections: adminElections, adminElectionsCreate, adminElectionsControl

---

## VS Code Tools

**WHEN REFACTORING - Use VS Code:**
- Moving files: Right-click → "Rename" or drag-and-drop (auto-updates imports)
- Renaming symbols: F2 on symbol name
- Extract function: Select code → Ctrl+Shift+R

**WHY VS CODE IS BETTER:**
- Safer: Analyzes AST, understands code structure
- Preview: See all changes before applying
- Intelligent: Handles relative paths correctly

---

## Documentation Language Standards

**WRITE IN ENGLISH:**
- Architecture docs, technical guides, API docs
- Code comments and docstrings
- README files, Git commits, GitHub issues/PRs

**ICELANDIC ACCEPTABLE FOR:**
- Internal meeting notes (docs/policy/)
- Draft brainstorming (temporary docs in /tmp/)

---

## Documentation-Driven Workflow (MANDATORY)

**BEFORE Starting Task:**
1. Identify relevant documentation
2. Read ALL related docs
3. Understand current architecture/patterns
4. Only THEN start implementation

**AFTER Task (If errors/inaccuracies found):**
1. Fix the code issue
2. Update documentation that was wrong/incomplete
3. Commit both code + doc fixes together

| Task Type | Read First |
|-----------|------------|
| Deployment | OPERATIONAL_PROCEDURES.md, CLOUD_RUN_SERVICES.md |
| New feature | ARCHITECTURE.md, relevant EPIC_*.md, service README |
| Bug fix | CLOUD_RUN_SERVICES.md, TROUBLESHOOTING.md, error logs |
| Frontend | ADDING_NEW_PAGES_GUIDE.md, JAVASCRIPT_GUIDE.md |

**REMEMBER:** Documentation is your first tool, not your last resort!
