# Dev Tools - Firebase Authentication Debugging

This directory contains development and debugging tools for local testing.

## 🔧 Available Tools

### `force-refresh.html`
Force Firebase to refresh ID tokens with latest custom claims.

**Use when:**
- You've updated custom claims (roles, isMember, etc.) in Firebase Console
- Claims are not updating in the client
- Testing role-based access control (RBAC)

**Access:**
```
http://localhost:5000/dev-tools/force-refresh.html
```

---

### `token-debug.html`
Simple token inspector to view current Firebase ID token claims.

**Use when:**
- Checking what roles a user has
- Verifying custom claims structure
- Debugging authentication issues

**Access:**
```
http://localhost:5000/dev-tools/token-debug.html
```

---

## 🚀 Usage

1. Start local dev server:
   ```bash
   firebase serve --only hosting
   ```

2. Login to the portal

3. Navigate to tool URL

4. Click button to refresh/inspect token

---

## ⚠️ Important Notes

- **Local development only** - Do not deploy to production
- These tools require authenticated Firebase session
- Changes made here are temporary (until token expires)
- For permanent claim changes, use Firebase Admin SDK or Console

---

## 📚 Related Documentation

- `/docs/development/DEBUG_MODE.md` - Debug mode usage guide
- `/docs/integration/FIREBASE_AUTHENTICATION.md` - Auth architecture
- `/docs/development/guides/RBAC_SYSTEM.md` - Role-based access control
