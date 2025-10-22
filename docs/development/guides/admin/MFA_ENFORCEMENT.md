# MFA Enforcement for Admin Roles

**Last Updated:** 2025-10-20  
**Status:** ✅ Current

Classification: Internal - Operations

This guide describes how to audit and enforce Multi-Factor Authentication (MFA) for users holding elevated roles (developer, meeting_election_manager, event_manager).

Goals:
- Ensure accounts with administrative capabilities have MFA enabled
- Provide a repeatable monthly audit process
- Document escalation paths and remediation steps

Scope:
- Firebase Authentication users in project(s): ekklesia-<env>
- Roles stored in custom claims: roles: ["developer", "meeting_election_manager", "event_manager"]

Audit Steps (Monthly):
1) Export users with elevated roles
   - Use an internal script (not in public repo) to list UIDs and claims
   - Or query Cloud Logging for admin route usage as a seed list
2) Check MFA enrollment status for each UID
   - Firebase Admin SDK: getUser(uid).multiFactor.enrolledFactors
   - If zero, mark as non-compliant
3) Notify non-compliant users and CC security officer
   - Provide MFA setup instructions and deadline (7 days)
4) After deadline, remove elevated roles for non-compliant accounts
   - Keep audit log of changes (who approved, when, why)

Implementation Snippet (Node):
```js
// Pseudocode, keep real script in private ops repo
const admin = require('firebase-admin');
admin.initializeApp();
const u = await admin.auth().getUser(uid);
const hasMfa = (u.multiFactor?.enrolledFactors?.length || 0) > 0;
if (!hasMfa) {
  const claims = u.customClaims || {};
  const roles = (claims.roles || []).filter(r => !['developer','meeting_election_manager','event_manager'].includes(r));
  await admin.auth().setCustomUserClaims(uid, { ...claims, roles });
}
```

MFA Setup Instructions (Send to users):
- Go to Firebase-hosted app and sign in
- In account security settings, add a second factor (TOTP or SMS)
- Confirm recovery codes are stored securely

References:
- Firebase Admin SDK Multi-factor Auth
- Security Policy (SECURITY.md)

## Baseline Audit

Date: 2025-10-16

Summary:
- Elevated users detected: 1
- With MFA: 0 (0.0%)
- Without MFA: 1
- Non-compliant UIDs: wElbKqQ8mLfYmxhpiUGAnv0vx2g1

Remediation Plan (immediate):
1) User with developer role must enroll MFA (TOTP preferred) as soon as possible.
2) Re-run audit after enrollment to confirm compliance.
3) If still non-compliant after 7 days, remove `developer` role until MFA is enabled.

---

## MFA Configuration Examples

### TOTP (Time-Based One-Time Password) Setup

**Admin Configuration (Backend):**

```bash
# Deploy TOTP enforcement to production
gcloud functions deploy enforceTotp \
  --gen2 \
  --runtime=python311 \
  --region=europe-west2 \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars FIREBASE_PROJECT_ID=ekklesia-prod-10-2025

# Test TOTP verification
curl -X POST https://region-project.cloudfunctions.net/enforceTotp \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "user-uid-here",
    "totp_secret": "JBSWY3DPEBLW64TMMQ======"
  }'
```

**Client Setup Instructions (User Steps):**

1. Sign in to https://ekklesia-prod-10-2025.web.app
2. Navigate to Account Settings → Security → Multi-Factor Auth
3. Click "Add Authentication Method"
4. Select "Authenticator App (TOTP)"
5. Scan QR code with Google Authenticator, Authy, or Microsoft Authenticator
6. Enter 6-digit code from app
7. Save recovery codes in a secure location (password manager recommended)
8. Confirm MFA is now active

### SMS-Based MFA Setup

**Admin Configuration:**

```bash
# SMS MFA requires additional Firebase configuration
gcloud firebase:projects:list

# Set SMS provider (Twilio or Firebase's built-in)
gcloud functions deploy handleSmsMfa \
  --gen2 \
  --runtime=python311 \
  --set-env-vars \
    TWILIO_ACCOUNT_SID=your-sid \
    TWILIO_AUTH_TOKEN=your-token \
    TWILIO_FROM_NUMBER=+1234567890
```

**User SMS Setup:**

1. Account Settings → Security → Multi-Factor Auth
2. Click "Add Authentication Method"
3. Select "SMS"
4. Enter your mobile number
5. Receive SMS code
6. Enter code to confirm

### Recovery Codes

**Generate Recovery Codes (Admin):**

```js
const admin = require('firebase-admin');

async function generateRecoveryCodes(uid) {
  const user = await admin.auth().getUser(uid);
  const codes = [];
  
  // Generate 8 recovery codes
  for (let i = 0; i < 8; i++) {
    codes.push(generateRandomCode());
  }
  
  // Store securely (encrypted in Firestore or Secret Manager)
  await admin.firestore()
    .collection('mfa_recovery_codes')
    .doc(uid)
    .set({
      codes: codes,
      created_at: admin.firestore.Timestamp.now(),
      used: []
    }, { merge: true });
  
  return codes;
}

function generateRandomCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}
```

**User Recovery Code Storage:**

1. After MFA setup, you'll receive 8 recovery codes
2. Store codes in a secure password manager (1Password, KeePass, Bitwarden)
3. Do NOT share with anyone
4. Use one code if you lose access to your authenticator
5. Each code can only be used once

---

## Monthly Audit Process

### Step 1: Export Users with Elevated Roles

```bash
# Use private ops repository script (not in public repo)
./scripts/export-elevated-users.sh > /tmp/elevated_users.json

# Output format:
# [
#   { "uid": "user1", "roles": ["developer", "election_manager"] },
#   { "uid": "user2", "roles": ["event_manager"] }
# ]
```

### Step 2: Check MFA Status

```js
const admin = require('firebase-admin');

async function checkMfaCompliance(usersFile) {
  const users = require(usersFile);
  const report = {
    compliant: [],
    non_compliant: [],
    timestamp: new Date().toISOString()
  };
  
  for (const user of users) {
    const firebaseUser = await admin.auth().getUser(user.uid);
    const hasMfa = (firebaseUser.multiFactor?.enrolledFactors?.length || 0) > 0;
    
    if (hasMfa) {
      report.compliant.push({
        uid: user.uid,
        roles: user.roles,
        mfa_method: firebaseUser.multiFactor.enrolledFactors[0].factorId
      });
    } else {
      report.non_compliant.push({
        uid: user.uid,
        roles: user.roles,
        email: firebaseUser.email
      });
    }
  }
  
  return report;
}
```

### Step 3: Notification Template

**Email to Non-Compliant Users:**

Subject: Action Required - Enable Multi-Factor Authentication for Your Account

```
Hello [User Name],

Your account has administrative access to the Ekklesia voting platform. 
To protect this critical system, we require Multi-Factor Authentication (MFA) 
for all users with elevated roles.

**Action Required by [Date + 7 days]:**
1. Sign in to https://ekklesia-prod-10-2025.web.app
2. Go to Account Settings → Security
3. Add an authenticator app or SMS authentication
4. Confirm your recovery codes are saved

**Questions?**
Contact: [Security Officer Email]

This is a mandatory security requirement. Failure to enable MFA after 7 days 
will result in temporary role suspension until MFA is enabled.

Best regards,
Security Team
```

### Step 4: Role Removal (Post-Deadline)

```js
async function enforceCompliance(report) {
  const deadline = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  for (const user of report.non_compliant) {
    const firebaseUser = await admin.auth().getUser(user.uid);
    
    // Check if past deadline
    if (firebaseUser.createdAt < deadline) {
      const claims = firebaseUser.customClaims || {};
      
      // Remove elevated roles
      const updatedRoles = (claims.roles || [])
        .filter(r => !['developer', 'election_manager', 'event_manager'].includes(r));
      
      await admin.auth().setCustomUserClaims(user.uid, {
        ...claims,
        roles: updatedRoles,
        mfa_suspended_at: new Date().toISOString()
      });
      
      // Log to audit trail
      console.log(`Suspended roles for ${user.uid} due to non-compliance`);
    }
  }
}
```

---

## Compliance Checklist

- [ ] All developer accounts have MFA enabled
- [ ] All election_manager accounts have MFA enabled
- [ ] All event_manager accounts have MFA enabled
- [ ] Monthly audit completed and documented
- [ ] Non-compliant users notified within 24 hours
- [ ] Recovery codes verified for each user
- [ ] Next audit scheduled

---

## Troubleshooting

| Issue | Resolution |
|-------|-----------|
| TOTP not working | Verify device time is synchronized; re-scan QR code |
| SMS code not received | Check phone number; request code resend after 30 seconds |
| Recovery codes lost | Contact admin; identity verification required |
| MFA disabled by accident | Re-enable through account settings; use recovery code if needed |
| Firebase User not found | Verify UID format; check project ID matches |

---

_Baseline Audit Date: 2025-10-16_  
_Next Audit: 2025-11-16_

Next scheduled audit: 2025-11-01
