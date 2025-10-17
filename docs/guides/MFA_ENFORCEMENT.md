# MFA Enforcement for Admin Roles

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

Change Management:
- Use two-person review for any removal of developer role
- Track actions in a private ticket

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

Next scheduled audit: 2025-11-01
