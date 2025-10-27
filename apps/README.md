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
├── dashboard.html           # Member dashboard
├── elections.html           # Elections list
├── election-detail.html     # Vote on election
├── profile.html             # Member profile
├── js/                      # Shared JavaScript modules
├── styles/                  # Shared CSS (BEM methodology)
├── session/                 # Session management
└── firebase/                # Firebase configuration
```

**Deployment**:
- Firebase Hosting via `services/members/public` symlink
- Symlink: `services/members/public → ../../apps/members-portal`
- **All files deployed from this single location**

**URLs**:
- Member pages: `/dashboard.html`, `/elections.html`, etc.
- Admin pages: `/admin/admin.html`, `/admin/sync-members.html`, etc.

**Technology**:
- Vanilla JavaScript (ES6 modules)
- Firebase SDK (Authentication, Firestore)
- BEM CSS methodology
- R.string i18n pattern (Icelandic)

**Backend**: Cloud Functions in `services/members/functions/`

---

## IMPORTANT: No Duplicate Directories

**❌ DO NOT CREATE:** `apps/admin-portal/`

All admin portal files belong in `apps/members-portal/admin/` subdirectory.

**Why?**
- Single source of truth for deployment
- Prevents confusion about which files are deployed
- Firebase symlink only points to `members-portal/`
- Editing files in wrong location wastes time (no deployment effect)

**Prevention**: `.gitignore` blocks `apps/admin-portal/` directory creation

---

## Deployment Process

1. **Edit files** in `apps/members-portal/` (member or admin)
2. **Symlink** at `services/members/public` automatically includes changes
3. **Deploy** from `services/members/`:
   ```bash
   cd services/members
   firebase deploy --only hosting
   ```

**Cache Busting**: Update version query parameters in HTML `<script>` tags when deploying JavaScript changes:
```html
<script src="/admin/js/sync-members.js?v=1234567890"></script>
```
