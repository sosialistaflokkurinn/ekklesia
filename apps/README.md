# Frontend Applications

This directory contains all frontend applications for the Ekklesia platform.

## Directory Structure

### members-portal/ (SINGLE SOURCE OF TRUTH)

**Purpose**: Member and admin portal - all frontend UI for Ekklesia

**Structure**:
```
members-portal/
├── admin/                    # Admin portal (developer role required)
│   ├── admin.html           # Admin dashboard
│   ├── sync-members.html    # Manual member sync trigger
│   ├── sync-history.html    # Sync history viewer
│   ├── js/                  # Admin JavaScript modules
│   ├── styles/              # Admin-specific CSS
│   └── i18n/                # Admin Icelandic strings
├── members-area/            # Member portal (authenticated members)
│   ├── dashboard.html       # Member dashboard
│   ├── elections.html       # Elections list
│   ├── election-detail.html # Vote on election
│   ├── events.html          # Events calendar
│   ├── profile.html         # Member profile
│   ├── test-events.html     # Test events page
│   └── docs/                # Member-specific documentation
├── index.html               # Landing page (login)
├── favicon.svg              # Favicon
├── favicon.ico              # Favicon fallback
├── js/                      # Shared JavaScript modules
├── styles/                  # Shared CSS (BEM methodology)
├── session/                 # Session management
├── ui/                      # Shared UI components
└── firebase/                # Firebase configuration
```

**Deployment**:
- [Firebase Hosting](https://firebase.google.com/docs/hosting) via `services/svc-members/public` symlink
- Symlink: `services/svc-members/public → ../../apps/members-portal`
- **All files deployed from this single location**

**Developer Note**:
- ✅ **Edit files here**: `apps/members-portal/`
- ❌ **Never edit**: `services/svc-members/public/` (it's just a symlink)
- 🔍 **VS Code**: Symlink hidden via [`.vscode/settings.json`](../.vscode/settings.json) to reduce confusion

**URLs**:
- Landing page: `/index.html` (login)
- Member pages: `/members-area/dashboard.html`, `/members-area/elections.html`, etc.
- Admin pages: `/admin/admin.html`, `/admin/sync-members.html`, etc.

**Technology**:
- Vanilla JavaScript ([ES6 modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules))
- [Firebase SDK](https://firebase.google.com/docs/web/setup) (Authentication, Firestore)
- [BEM CSS methodology](http://getbem.com/) ([CSS Guide](../docs/standards/CSS_BEM_GUIDE.md))
- [R.string i18n pattern](../docs/standards/I18N_GUIDE.md) (Icelandic)

**Backend**: [Cloud Functions](https://firebase.google.com/docs/functions) in [`services/svc-members/functions/`](../services/svc-members/functions/)

---

## IMPORTANT: No Duplicate Directories

**❌ DO NOT CREATE:** `apps/admin-portal/`

All admin portal files belong in `apps/members-portal/admin/` subdirectory.

**Why?**
- Single source of truth for deployment
- Prevents confusion about which files are deployed
- Firebase symlink only points to `members-portal/`
- Editing files in wrong location wastes time (no deployment effect)

**Prevention**: [`.gitignore`](../.gitignore) blocks `apps/admin-portal/` directory creation

---

## Deployment Process

1. **Edit files** in `apps/members-portal/` (member or admin)
2. **Symlink** at `services/svc-members/public` automatically includes changes
3. **Deploy** from `services/svc-members/`:
   ```bash
   cd services/svc-members
   firebase deploy --only hosting
   ```

**Cache Busting**: Update version query parameters in HTML `<script>` tags when deploying JavaScript changes ([Firebase Hosting docs](https://firebase.google.com/docs/hosting/manage-cache)):
```html
<script src="/admin/js/sync-members.js?v=1234567890"></script>
```
