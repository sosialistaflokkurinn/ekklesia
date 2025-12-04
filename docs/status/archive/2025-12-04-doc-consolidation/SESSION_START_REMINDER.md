# Session Start Reminder

## Security & Git Rules

### Git Strategy: "Track All, Push Selectively"

All files are tracked locally (so AI assistants can see them), but sensitive files
are blocked from push by the pre-push hook. See `.git-local-only` for blocked patterns.

1. **NEVER BYPASS GIT HOOKS (--no-verify):**
   - **Pre-commit:** Detects secrets, PII, security issues
   - **Pre-push:** Blocks sensitive files from going to remote
   - If hook fails: INVESTIGATE → UNDERSTAND → FIX

2. **LOCAL-ONLY FILES (blocked from push, see .git-local-only):**
   - Policy docs: `docs/policy/` (meeting notes with personal info)
   - PII patterns: `*KENNITALA*.md`, `*DUPLICATE_SSN*.md`
   - Credentials: `.env`, `*.key.json`, `*client_secret*`
   - Admin scripts: `services/svc-members/scripts/check-*.js`
   - Audit logs: `*.audit.json`, `scripts/logs/*.jsonl`

3. **HOW IT WORKS:**
   ```
   git add file.md     → File is tracked locally
   git commit          → File is committed locally
   git push            → Pre-push hook checks .git-local-only
                       → If file matches pattern → PUSH BLOCKED
                       → If no match → Push succeeds
   ```

4. **CRITICAL RULES:**
   - Sensitive files ARE committed locally (AI can see them)
   - Sensitive files are NEVER pushed to remote (hook blocks them)
   - NEVER use `git push --no-verify` (bypasses security)
   - If pre-push blocks your push: Remove sensitive files from commits

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

1. Frontend Only (SAFE) - **MUST run from services/svc-members/**:
   ```bash
   cd /home/gudro/Development/projects/ekklesia/services/svc-members
   firebase deploy --only hosting  # Doesn't affect secrets
   ```

   **IMPORTANT:** firebase.json is in services/svc-members/, NOT project root!

   **NO LOCAL SERVER:** There is NO local development server workflow.
   Changes are tested by deploying to Firebase Hosting.
   NEVER suggest `python3 -m http.server` or similar local servers.

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
