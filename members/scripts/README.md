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

## Related Documentation

- [docs/guides/ROLES_AND_PERMISSIONS.md](../../docs/guides/ROLES_AND_PERMISSIONS.md) - Complete RBAC documentation
- [docs/MEMBERS_DEPLOYMENT_GUIDE.md](../../docs/MEMBERS_DEPLOYMENT_GUIDE.md) - Members service deployment
- [Firebase Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims) - Official documentation

---

**Last Updated**: 2025-10-16
**Status**: ✅ Production-ready
