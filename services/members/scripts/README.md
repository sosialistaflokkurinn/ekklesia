# Members Service Scripts

Helper scripts for managing the Members service (Firebase Authentication, custom claims, roles).

---

## set-user-roles.js

Assign or remove roles for users via Firebase custom claims.

### Usage

Positional (quick add):
```bash
node set-user-roles.js <UID> <role1> [role2] [role3]
```

Flags (add/remove/project):
```bash
node set-user-roles.js --uid <UID> --add <role> [--add <role>] [--remove <role>] [--project <PROJECT_ID>]
```

### Examples

**Assign developer role** (highest privileges):
```bash
node set-user-roles.js abc123xyz developer
```

**Assign and remove roles**:
```bash
node set-user-roles.js --uid def456uvw --add meeting_election_manager --remove member
```

### Available Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `developer` | Core platform developers/SREs | Full admin access (testing), audit trail in production |
| `meeting_election_manager` | Election managers | Open/close elections, monitor progress, view results |
| `event_manager` | Event administrators | Manage event metadata, schedules, announcements |
| `member` | Regular party member | Authenticate, request token, vote, view results |

See [docs/guides/ROLES_AND_PERMISSIONS.md](../../docs/guides/ROLES_AND_PERMISSIONS.md) for complete role definitions.

### Prerequisites

**Option 1: Service Account** (recommended for production):
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
node set-user-roles.js <UID> <role>
```

**Option 2: Default Credentials** (Cloud Shell or Cloud Run):
```bash
# No setup needed, uses default application credentials
node set-user-roles.js <UID> <role>
```

**Option 3: User Credentials** (gcloud auth):
```bash
gcloud auth application-default login
node set-user-roles.js <UID> <role>
```

### Finding User UIDs

**Method 1: Test Events Page**
1. Go to: https://ekklesia-prod-10-2025.web.app/test-events.html
2. Sign in
3. Your UID is shown in section "1. Auðkenning" → "Auðkenni:"

**Method 2: Firebase Console**
1. Go to: https://console.firebase.google.com/project/ekklesia-prod-10-2025/authentication/users
2. Click on user
3. Copy UID from user details

**Method 3: Cloud Logs**
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=handlekenniauth" \
  --limit=10 \
  --format="value(jsonPayload.uid)" \
  --project=ekklesia-prod-10-2025
```

### How It Works

1. Reads current user's custom claims from Firebase
2. Merges new roles with existing roles (preserves `kennitala`, `isMember`, etc.)
3. Sets updated custom claims
4. User must **sign out and sign back in** for roles to take effect

### Example Output

```bash
$ node set-user-roles.js abc123xyz developer

Current user: gudrodur@example.com
Current claims: {
  "kennitala": "XXXXXX-XXXX",
  "isMember": true
}

✅ Roles updated successfully!
New claims: {
  "kennitala": "XXXXXX-XXXX",
  "isMember": true,
  "roles": ["developer"]
}

ℹ️  User must sign out and sign back in for roles to take effect.
```

### Security Notes

- **Only service account admins can set custom claims**
- Keep `developer` role assignment audited (very small list)
- Prefer `meeting_election_manager` for day-to-day election operations
- Roles are verified server-side (cannot be spoofed by client)

### Troubleshooting

**Error: "Insufficient permissions"**
- Ensure service account has `Firebase Admin` role
- Or use `gcloud auth application-default login` with owner/editor permissions

**Error: "User not found"**
- Verify UID is correct (not email or kennitala)
- Check user exists in Firebase Console

**Roles not taking effect**
- User must sign out and sign back in
- Check token claims: `getIdTokenResult()` in browser console
- Verify backend reads `decodedToken.roles` correctly

---

## emergency-set-role.sh

Emergency role assignment using Identity Toolkit REST API. Use this when `set-user-roles.js` fails due to credential issues.

### Usage

```bash
./emergency-set-role.sh <UID> <ROLE> [KENNITALA] [EMAIL] [PHONE]
```

### Examples

**Set developer role** (minimal):
```bash
./emergency-set-role.sh abc123XYZ789ExampleUserUID456 developer
```

**Set developer role with all claims** (recommended):
```bash
./emergency-set-role.sh abc123XYZ789ExampleUserUID456 developer 010190-2939 jon.jonsson@example.com +3545551234
```

### ⚠️ Warning

This script **overwrites ALL custom claims**. You must provide all existing claims (kennitala, email, phoneNumber) or they will be lost.

### Prerequisites

- `gcloud` CLI authenticated: `gcloud auth login`
- `jq` installed for JSON parsing
- Access to project: `ekklesia-prod-10-2025`

### When to Use This

- `set-user-roles.js` fails with credential errors
- Application Default Credentials are expired
- Need quick role assignment without npm dependencies
- Debugging custom claims issues

---

## check-user-claims.sh

Verify what custom claims a user currently has. Useful for debugging role issues.

### Usage

```bash
./check-user-claims.sh <UID>
```

### Example

```bash
$ ./check-user-claims.sh abc123XYZ789ExampleUserUID456

Fetching custom claims for user: abc123XYZ789ExampleUserUID456

User Information:
{
  "uid": "abc123XYZ789ExampleUserUID456",
  "email": "jon.jonsson@example.com",
  "displayName": "Jón Jónsson",
  "lastLoginAt": "1761220879000",
  "createdAt": "1696848000000"
}

Custom Claims (customAttributes):
{
  "roles": ["developer"],
  "kennitala": "010190-2939",
  "isMember": true,
  "email": "jon.jonsson@example.com",
  "phoneNumber": "+3545551234"
}
```

### Prerequisites

- `gcloud` CLI authenticated: `gcloud auth login`
- `jq` installed for JSON parsing
- Access to project: `ekklesia-prod-10-2025`

### When to Use This

- Verify role was set correctly after using `set-user-roles.js`
- Debug why user doesn't have expected permissions
- Check if custom claims were lost during `handleKenniAuth` redeployment
- Audit user roles for security review

---

## Quick Reference

| Task | Recommended Tool | Fallback |
|------|------------------|----------|
| Set role (normal) | `set-user-roles.js` | `emergency-set-role.sh` |
| Check claims | `check-user-claims.sh` | Firebase Console |
| Remove role | `set-user-roles.js --remove` | `emergency-set-role.sh` (without role) |
| List all users with roles | N/A (build UI) | Firebase Console + manual check |

---

## Related Documentation

- [docs/guides/ROLES_AND_PERMISSIONS.md](../../docs/guides/ROLES_AND_PERMISSIONS.md) - Complete RBAC documentation
- [docs/troubleshooting/ROLE_LOSS_INCIDENT_2025-10-23.md](../../../docs/troubleshooting/ROLE_LOSS_INCIDENT_2025-10-23.md) - Role loss incident report
- [docs/MEMBERS_DEPLOYMENT_GUIDE.md](../../docs/MEMBERS_DEPLOYMENT_GUIDE.md) - Members service deployment
- [Firebase Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims) - Official documentation
- [GitHub Issue #96](https://github.com/sosialistaflokkurinn/ekklesia/issues/96) - Role preservation improvements

---

**Last Updated**: 2025-10-23
**Status**: ✅ Production-ready
