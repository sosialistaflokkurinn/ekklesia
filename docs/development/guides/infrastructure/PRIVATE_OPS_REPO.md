# Private Ops Repository Setup

**Last Updated:** 2025-10-20  
**Status:** ✅ Current

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

---

## Detailed Setup Instructions

### Step 1: Create Private Repository

**On GitHub:**

```bash
# Create via CLI
gh repo create ekklesia-ops \
  --private \
  --source=. \
  --remote=origin \
  --push

# OR create via web UI
# 1. Go to https://github.com/new
# 2. Repository name: ekklesia-ops
# 3. Visibility: Private
# 4. Add README
# 5. Create repository
```

**Initial Clone:**

```bash
git clone git@github.com:sosialistaflokkurinn/ekklesia-ops.git
cd ekklesia-ops
```

### Step 2: Set Up Directory Structure

```bash
# Create full structure
mkdir -p runbooks/{elections,members,infrastructure}
mkdir -p scripts/{firebase,gcp,database,kubernetes}
mkdir -p policies
mkdir -p docs
mkdir -p archived

# Create initial files
cat > README.md << 'EOF'
# Ekklesia Ops Repository

**⚠️ CONFIDENTIAL - RESTRICTED ACCESS**

This repository contains sensitive operational assets for the Ekklesia voting platform:
- Production runbooks (destructive operations)
- Admin scripts and utilities
- Policy documentation
- Access control procedures

**Access Level:** Security Team + SREs only

**No credentials stored here.** All secrets are in Google Secret Manager.

**Audit:** Access reviewed quarterly.
EOF

cat > .gitignore << 'EOF'
# Never commit secrets
*.key
*.pem
*.pfx
*.p12
.env
.env.local
secrets.json
credentials.json
service-account.json

# Log files
*.log
logs/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Archives
*.tar.gz
*.zip

# Temporary
tmp/
temp/
.tmp/
EOF

cat > policies/access-controls.md << 'EOF'
# Access Control Policy

## Repository Members

- **Owner:** Security Officer (2-person approval required for team changes)
- **Maintainers:** SRE Lead, Incident Commander
- **Members:** Rotating SRE team members (re-certified quarterly)

## Permission Model

| Role | Permissions | Review Required |
|------|-------------|-----------------|
| Owner | All | N/A |
| Maintainer | Push to main, approve PRs | N/A |
| Member | Create branches, submit PRs | Required |
| Read-only | Clone only | N/A |

## Branch Protection Rules

- `main` branch: Require 2 approvals before merge
- `main` branch: Require status checks pass
- `main` branch: Dismiss stale reviews on new commits
- `main` branch: Require up-to-date branches before merge

## Secret Management

All secrets are stored in Google Secret Manager, NOT in this repo.

```bash
# Access a secret
gcloud secrets versions access latest --secret="ekklesia-db-password"

# Create a new secret
echo "your-secret-value" | gcloud secrets create my-secret --data-file=-
```
EOF

git add .gitignore README.md policies/
git commit -m "Initial ops repo setup with policies"
git push origin main
```

### Step 3: Add Runbooks

**Production Election Reset (Destructive Operation):**

Create `runbooks/elections/reset-election.sql`:

```bash
cat > runbooks/elections/reset-election.sql << 'EOF'
-- DESTRUCTIVE: Full election reset
-- Use with extreme caution.
-- Last executed: 2025-10-16 by [operator name]

BEGIN;

-- Clear results
DELETE FROM election_results WHERE election_id = $1;

-- Clear votes (if data retention policy permits)
DELETE FROM votes WHERE election_id = $1;

-- Reset election status
UPDATE elections 
SET 
  status = 'draft',
  started_at = NULL,
  ended_at = NULL,
  reset_at = NOW()
WHERE id = $1;

-- Log the reset
INSERT INTO audit_log (table_name, action, record_id, timestamp, operator_id)
VALUES ('elections', 'FULL_RESET', $1, NOW(), current_user);

COMMIT;
EOF
```

**Production Maintenance Runbook:**

Create `runbooks/members/rotate-keys.md`:

```bash
cat > runbooks/members/rotate-keys.md << 'EOF'
# Firebase Key Rotation (Members Service)

**Purpose:** Rotate authentication keys to maintain security posture

**Frequency:** Quarterly or after suspected compromise

**Prerequisites:**
- 2 team members available (for approval)
- Maintenance window scheduled (30 minutes)
- Incident commander on standby

**Steps:**

1. **Notify users** (optional for planned rotation)
   ```bash
   gcloud functions call notifyKeyRotation --data '{"env":"production"}'
   ```

2. **Generate new key**
   ```bash
   gcloud iam service-accounts keys create \
     /tmp/new-key.json \
     --iam-account=members-service@ekklesia-prod-10-2025.iam.gserviceaccount.com
   ```

3. **Upload to Secret Manager**
   ```bash
   gcloud secrets versions add ekklesia-members-key \
     --data-file=/tmp/new-key.json
   ```

4. **Deploy with new key**
   ```bash
   gcloud functions deploy handleKenniAuth \
     --gen2 \
     --runtime python311 \
     --update-build-config-source-location /home/gudro/Development/projects/ekklesia/services/members/functions
   ```

5. **Verify functionality**
   ```bash
   curl -X GET https://handlekenniauth-prod.run.app/health
   ```

6. **Revoke old key**
   ```bash
   gcloud iam service-accounts keys delete \
     --iam-account=members-service@ekklesia-prod-10-2025.iam.gserviceaccount.com \
     OLD_KEY_ID
   ```

7. **Document completion**
   - Timestamp: $(date -Iseconds)
   - Approver 1: [name]
   - Approver 2: [name]
   - Any incidents: None
EOF
```

### Step 4: Add Scripts

**Firebase Admin Script (with stricter logging):**

Create `scripts/firebase/enforce-mfa.js`:

```bash
cat > scripts/firebase/enforce-mfa.js << 'EOF'
#!/usr/bin/env node

/**
 * Enforce MFA for elevated roles
 *
 * Usage: node enforce-mfa.js --project=ekklesia-prod-10-2025
 *
 * AUDIT TRAIL: All actions logged to Cloud Logging
 */

const admin = require('firebase-admin');
const { program } = require('commander');

program
  .option('--project <id>', 'Firebase project ID')
  .option('--dry-run', 'Show what would be done, but don\'t do it')
  .parse(process.argv);

const projectId = program.project || process.env.FIREBASE_PROJECT_ID;

admin.initializeApp({
  projectId: projectId
});

async function enforceMfa() {
  console.log(`[$(date)] Starting MFA enforcement for project: ${projectId}`);
  
  const elevatedRoles = ['developer', 'election_manager', 'event_manager'];
  let processed = 0;
  let noncompliant = 0;
  
  // Fetch all users
  let nextPageToken = undefined;
  const report = {
    checked: 0,
    compliant: [],
    noncompliant: [],
    errors: []
  };
  
  do {
    const result = await admin.auth().listUsers(1000, nextPageToken);
    
    for (const user of result.users) {
      report.checked++;
      const roles = (user.customClaims?.roles || []);
      const hasElevatedRole = roles.some(r => elevatedRoles.includes(r));
      
      if (!hasElevatedRole) continue;
      
      const hasMfa = (user.multiFactor?.enrolledFactors?.length || 0) > 0;
      
      if (!hasMfa) {
        noncompliant++;
        report.noncompliant.push({
          uid: user.uid,
          email: user.email,
          roles: roles.filter(r => elevatedRoles.includes(r))
        });
        
        if (!program.dryRun) {
          try {
            const newRoles = roles.filter(r => !elevatedRoles.includes(r));
            await admin.auth().setCustomUserClaims(user.uid, {
              ...user.customClaims,
              roles: newRoles,
              mfa_enforced_at: new Date().toISOString()
            });
            
            console.log(`[REMOVED] Elevated roles from ${user.email}`);
          } catch (err) {
            report.errors.push({
              uid: user.uid,
              error: err.message
            });
            console.error(`[ERROR] Failed to update ${user.uid}: ${err.message}`);
          }
        }
      } else {
        report.compliant.push({
          uid: user.uid,
          email: user.email,
          mfa_method: user.multiFactor.enrolledFactors[0]
        });
      }
    }
    
    nextPageToken = result.pageToken;
  } while (nextPageToken);
  
  console.log(`\n[SUMMARY]`);
  console.log(`  Users checked: ${report.checked}`);
  console.log(`  Compliant: ${report.compliant.length}`);
  console.log(`  Non-compliant: ${report.noncompliant.length}`);
  console.log(`  Errors: ${report.errors.length}`);
  
  if (program.dryRun) {
    console.log('\n[DRY RUN MODE] No changes applied');
  }
  
  console.log(`[$(date)] MFA enforcement completed`);
  process.exit(report.errors.length > 0 ? 1 : 0);
}

enforceMfa().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
EOF

chmod +x scripts/firebase/enforce-mfa.js
```

### Step 5: Configure Access Control

**Add CODEOWNERS file:**

```bash
cat > .github/CODEOWNERS << 'EOF'
# Runbooks require security team review
/runbooks/ @security-team

# Scripts require maintainer review
/scripts/ @sre-lead

# Policies require owner approval
/policies/ @security-officer
EOF
```

**Add branch protection:**

```bash
# Via GitHub CLI
gh repo edit ekklesia-ops \
  --add-branch-protection main \
  --require-approval-count=2 \
  --require-status-checks
```

### Step 6: Access Audit

**Create audit process:**

```bash
cat > policies/quarterly-access-audit.sh << 'EOF'
#!/bin/bash

# Quarterly access audit for ekklesia-ops

echo "=== Access Audit: $(date -I) ==="

# List repository members
echo -e "\n[MEMBERS]"
gh repo view --json members --jq '.members[] | "\(.login) (\(.role))"'

# List recent commits
echo -e "\n[RECENT ACTIVITY]"
git log --all --oneline -20 | while read commit; do
  echo "  $commit"
done

# Check key file modifications
echo -e "\n[KEY FILES MODIFIED IN PAST 7 DAYS]"
git log --since='7 days ago' --name-only --oneline -- \
  runbooks/ scripts/ policies/ | grep -E "^[a-z]" | sort -u

echo -e "\n=== End of Audit ==="
EOF

chmod +x policies/quarterly-access-audit.sh
```

---

## Security Best Practices

1. **Never commit credentials**
   - Use Google Secret Manager for all secrets
   - Use Application Default Credentials (ADC)
   - Never commit `.env` files or JSON credentials

2. **Limit repository members**
   - Only active SRE team members
   - Quarterly re-certification of access
   - Immediate removal when role changes

4. **Enable comprehensive audit logging**
   - All modifications logged to Cloud Logging
   - All destructive operations require timestamps and operator ID
   - Monthly review of audit logs

5. **Regularly rotate access credentials**
   - Service account keys: quarterly
   - Personal access tokens: every 6 months
   - Revoke immediately if compromise suspected

---

## Example Workflow

```bash
# 1. Clone the ops repo
git clone git@github.com:sosialistaflokkurinn/ekklesia-ops.git
cd ekklesia-ops

# 2. Create a feature branch
git checkout -b fix/enable-mfa-enforcement

# 3. Edit scripts
nano scripts/firebase/enforce-mfa.js

# 4. Commit with clear message
git commit -m "Add MFA enforcement script

- Checks all users with elevated roles
- Removes roles for non-compliant users
- Requires --dry-run flag before execution
- All actions logged to Cloud Logging

Requires 2025-10-16 security review completion."

# 5. Push and create PR
git push origin fix/enable-mfa-enforcement
gh pr create --title "Add MFA enforcement script"

# 6. Get 2 approvals and merge
gh pr merge --squash

# 7. Execute with dry-run first
node scripts/firebase/enforce-mfa.js --project=ekklesia-prod-10-2025 --dry-run

# 8. Execute for real (after verification)
node scripts/firebase/enforce-mfa.js --project=ekklesia-prod-10-2025

# 9. Document in audit log
echo "MFA enforcement executed on $(date)" >> AUDIT_LOG.txt
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't clone repo | Check SSH key; verify team membership in GitHub |
| Secret access denied | Check IAM roles; `gcloud auth application-default login` |
| PR merge blocked | Ensure 2 approvals from different team members |
| Script fails with permissions error | Verify service account has required roles in GCP |
| Audit log missing entries | Check Cloud Logging sink configuration |

---

_Last Updated: 2025-10-20_  
_Access Policy Review: 2025-01-20_  
_Next Quarterly Audit: 2025-01-20_
- See SECURITY.md for disclosure and safety policies
- See ADMIN_ALERTS.md for alerting; consider moving shell automation here
