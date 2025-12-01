````markdown
# Unified RBAC System

**Status:** ✅ Implemented  
**Date:** 2025-11-07  
**Location:** `/apps/members-portal/js/rbac.js`

## Overview

Unified Role-Based Access Control (RBAC) system for the entire Ekklesia member portal. One central location for all roles and permissions.

## Role Hierarchy

```
┌─────────────┐
│  superuser  │ ← System Administrator (All permissions + dangerous operations)
└──────┬──────┘
       │
┌──────▼──────┐
│    admin    │ ← Administrator (Member management + Elections management)
└──────┬──────┘
       │
┌──────▼──────┐
│   member    │ ← Member (Basic member access)
└─────────────┘
```

**Hierarchy Level:**
- `member`: 1
- `admin`: 2 (inherits all member permissions)
- `superuser`: 3 (inherits all admin permissions)

## Role Mapping

### Elections Service Mapping
Backend elections API uses different role names:

```javascript
// Frontend roles → Backend election roles
admin      → election-manager
superuser  → superadmin
```

**Mapping Function:**
```javascript
import { getElectionRole } from './rbac.js';

const electionRole = await getElectionRole();
// Returns: 'election-manager', 'superadmin', or null
```

## Permissions

### Member Area Permissions
```javascript
PERMISSIONS.VIEW_DASHBOARD      // View dashboard
PERMISSIONS.VIEW_PROFILE        // View profile
PERMISSIONS.EDIT_PROFILE        // Edit profile
PERMISSIONS.VIEW_EVENTS         // View events
PERMISSIONS.REGISTER_EVENT      // Register for event
PERMISSIONS.VIEW_ELECTIONS      // View elections
PERMISSIONS.VOTE                // Vote
```

### Admin Area Permissions
```javascript
PERMISSIONS.VIEW_ADMIN_PORTAL   // View admin portal
PERMISSIONS.VIEW_MEMBERS_LIST   // View member list
PERMISSIONS.VIEW_MEMBER_DETAILS // View member details
PERMISSIONS.EDIT_MEMBER         // Edit member
PERMISSIONS.SYNC_MEMBERS        // Run sync
PERMISSIONS.VIEW_SYNC_HISTORY   // View sync history
```

### Elections Admin Permissions
```javascript
PERMISSIONS.VIEW_ELECTIONS_ADMIN     // View election management
PERMISSIONS.CREATE_ELECTION          // Create election
PERMISSIONS.EDIT_ELECTION            // Edit election
PERMISSIONS.OPEN_ELECTION            // Open election
PERMISSIONS.CLOSE_ELECTION           // Close election
PERMISSIONS.HIDE_ELECTION            // Hide election
PERMISSIONS.UNHIDE_ELECTION          // Unhide election
PERMISSIONS.VIEW_ELECTION_RESULTS    // View results
PERMISSIONS.EXPORT_ELECTION_RESULTS  // Export results
PERMISSIONS.DELETE_ELECTION          // Delete election (superuser ONLY)
```

### System Permissions (Superuser Only)
```javascript
PERMISSIONS.DELETE_MEMBER           // Delete member
PERMISSIONS.MANAGE_ROLES            // Manage roles
PERMISSIONS.VIEW_SYSTEM_LOGS        // View system logs
PERMISSIONS.DANGEROUS_OPERATIONS    // Dangerous operation
```

## Permissions

### Member Area Permissions
```javascript
PERMISSIONS.VIEW_DASHBOARD      // View dashboard
PERMISSIONS.VIEW_PROFILE        // View profile
PERMISSIONS.EDIT_PROFILE        // Edit profile
PERMISSIONS.VIEW_EVENTS         // View events
PERMISSIONS.REGISTER_EVENT      // Register for event
PERMISSIONS.VIEW_ELECTIONS      // View elections
PERMISSIONS.VOTE                // Vote
```

### Admin Area Permissions
```javascript
PERMISSIONS.VIEW_ADMIN_PORTAL   // View admin portal
PERMISSIONS.VIEW_MEMBERS_LIST   // View member list
PERMISSIONS.VIEW_MEMBER_DETAILS // View member details
PERMISSIONS.EDIT_MEMBER         // Edit member
PERMISSIONS.SYNC_MEMBERS        // Run sync
PERMISSIONS.VIEW_SYNC_HISTORY   // View sync history
```

### Elections Admin Permissions
```javascript
PERMISSIONS.VIEW_ELECTIONS_ADMIN     // View election management
PERMISSIONS.CREATE_ELECTION          // Create election
PERMISSIONS.EDIT_ELECTION            // Edit election
PERMISSIONS.OPEN_ELECTION            // Open election
PERMISSIONS.CLOSE_ELECTION           // Close election
PERMISSIONS.HIDE_ELECTION            // Hide election
PERMISSIONS.UNHIDE_ELECTION          // Unhide election
PERMISSIONS.VIEW_ELECTION_RESULTS    // View results
PERMISSIONS.EXPORT_ELECTION_RESULTS  // Export results
PERMISSIONS.DELETE_ELECTION          // Delete election (superuser ONLY)
```

### System Permissions (Superuser Only)
```javascript
PERMISSIONS.DELETE_MEMBER           // Delete member
PERMISSIONS.MANAGE_ROLES            // Manage roles
PERMISSIONS.VIEW_SYSTEM_LOGS        // View system logs
PERMISSIONS.DANGEROUS_OPERATIONS    // Dangerous operation
```

### Admin Area Permissions
```javascript
PERMISSIONS.VIEW_ADMIN_PORTAL   // Skoða admin portal
PERMISSIONS.VIEW_MEMBERS_LIST   // Skoða félagalista
PERMISSIONS.VIEW_MEMBER_DETAILS // Skoða félagaupplýsingar
PERMISSIONS.EDIT_MEMBER         // Breyta félaga
PERMISSIONS.SYNC_MEMBERS        // Keyra sync
PERMISSIONS.VIEW_SYNC_HISTORY   // Skoða sync history
PERMISSIONS.VIEW_SYNC_QUEUE     // Skoða sync queue
```

### Elections Admin Permissions
```javascript
PERMISSIONS.VIEW_ELECTIONS_ADMIN     // Skoða kosningastjórnun
PERMISSIONS.CREATE_ELECTION          // Stofna kosningu
PERMISSIONS.EDIT_ELECTION            // Breyta kosningu
PERMISSIONS.OPEN_ELECTION            // Opna kosningu
PERMISSIONS.CLOSE_ELECTION           // Loka kosningu
PERMISSIONS.HIDE_ELECTION            // Fela kosningu
PERMISSIONS.UNHIDE_ELECTION          // Birta kosningu aftur
PERMISSIONS.VIEW_ELECTION_RESULTS    // Skoða niðurstöður
PERMISSIONS.EXPORT_ELECTION_RESULTS  // Flytja út niðurstöður
PERMISSIONS.DELETE_ELECTION          // Eyða kosningu (superuser ONLY)
```

### System Permissions (Superuser Only)
```javascript
PERMISSIONS.DELETE_MEMBER           // Eyða félaga
PERMISSIONS.MANAGE_ROLES            // Stjórna hlutverkum
PERMISSIONS.VIEW_SYSTEM_LOGS        // Skoða kerfisskrár
PERMISSIONS.DANGEROUS_OPERATIONS    // Hættuleg aðgerð
```

## Usage

### 1. Check User Role

```javascript
import { getCurrentUserRole, getCurrentUserRoles, hasRole } from './rbac.js';

// Get highest role (single string)
const role = await getCurrentUserRole();
// Returns: 'member', 'admin', 'superuser', or null

// Get all roles (array)
const roles = await getCurrentUserRoles();
// Returns: ['member', 'admin'] or ['member', 'superuser']

// Check specific role
const isAdmin = await hasRole('admin');
const isSuperuser = await hasRole('superuser');

// Check multiple roles (any)
const hasAdminAccess = await hasAnyRole(['admin', 'superuser']);
```

### 2. Check Permissions

```javascript
import { hasPermission, hasAnyPermission, PERMISSIONS } from './rbac.js';

// Check single permission
const canDelete = await hasPermission(PERMISSIONS.DELETE_ELECTION);

// Check multiple permissions (any)
const canManageElections = await hasAnyPermission([
  PERMISSIONS.CREATE_ELECTION,
  PERMISSIONS.EDIT_ELECTION
]);

// Check multiple permissions (all)
const canFullyManage = await hasAllPermissions([
  PERMISSIONS.CREATE_ELECTION,
  PERMISSIONS.DELETE_ELECTION
]);
```

### 3. Page Access Control

```javascript
import { requireMember, requireAdmin, requireSuperuser } from './rbac.js';

// Require member role (for member area pages)
async function init() {
  try {
    await requireMember(); // Redirects to /session/login.html if not member
    // User is authenticated and has member role
  } catch (error) {
    // Handle error
  }
}

// Require admin role (for admin pages)
async function initAdmin() {
  try {
    await requireAdmin(); // Redirects to /members-area/ if not admin/superuser
    // User has admin or superuser role
  } catch (error) {
    // Handle error
  }
}

// Require superuser role (for dangerous operations)
async function initDangerous() {
  try {
    await requireSuperuser(); // Redirects if not superuser
    // User has superuser role
  } catch (error) {
    // Handle error
  }
}
```

### 4. UI Element Visibility

```javascript
import { toggleElementByPermission, toggleElementByRole } from './rbac.js';

// Show/hide based on permission
await toggleElementByPermission('delete-button', PERMISSIONS.DELETE_ELECTION);

// Show/hide based on role
await toggleElementByRole('admin-menu', 'admin');
await toggleElementByRole('superuser-settings', ['superuser']); // Array also works
```

### 5. Legacy Elections API Compatibility

```javascript
import { canPerformAction } from './rbac.js';

// Legacy function for elections list (maintains backwards compatibility)
const userRole = 'superadmin'; // or 'election-manager'
const canDelete = canPerformAction(userRole, 'delete');
// Returns: true/false
```

## Implementation Examples

### Member Area Dashboard
```javascript
// /js/dashboard.js
import { requireMember } from './rbac.js';

async function init() {
  await R.load('is');
  await initAuthenticatedPage();
  
  const currentUser = await requireAuth();
  
  // Check member role
  try {
    await requireMember();
  } catch (error) {
    alert('Þú verður að vera félagsmaður til að sjá þessa síðu.');
    window.location.href = '/';
    return;
  }
  
  // Rest of initialization...
}
```

### Admin Portal
```javascript
// /admin/js/admin.js
import { requireAdmin } from '../../js/rbac.js';

async function init() {
  try {
    const strings = await adminStrings.load();
    const { user, userData } = await initSession();
    
    // Check admin access (requires admin or superuser)
    await requireAdmin();
    
    // Initialize admin portal...
  } catch (error) {
    // Error handling...
  }
}
```

### Elections Admin
```javascript
// /admin-elections/js/elections-list.js
import { getElectionRole, requireAdmin, hasPermission, PERMISSIONS } from '../../js/rbac.js';

document.addEventListener('DOMContentLoaded', async () => {
  await R.load('is');
  
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = '/session/login.html';
      return;
    }
    
    try {
      // Check admin access
      await requireAdmin();
      
      // Get election role for API calls
      const electionRole = await getElectionRole();
      // Returns: 'election-manager' or 'superadmin'
      
      // Check specific permission
      const canDelete = await hasPermission(PERMISSIONS.DELETE_ELECTION);
      
      // Initialize UI...
    } catch (error) {
      console.error('[Elections List] Authorization error:', error);
    }
  });
});
```

### Dynamic Button Rendering
```javascript
// Show delete button only for superadmin
function renderActionButtons(election) {
  const buttons = [];
  
  buttons.push(`<button onclick="viewElection('${election.id}')">Skoða</button>`);
  buttons.push(`<button onclick="editElection('${election.id}')">Breyta</button>`);
  
  // Delete button only for superadmin
  if (currentUserRole === 'superadmin') {
    buttons.push(`<button onclick="deleteElection('${election.id}')" class="btn-danger">Eyða</button>`);
  }
  
  return buttons.join('');
}
```

## API Reference

### Core Functions

| Function | Description | Returns |
|----------|-------------|---------|
| `getCurrentUserRoles()` | Get all user roles from token | `Promise<string[]>` |
| `getCurrentUserRole()` | Get highest role | `Promise<string\|null>` |
| `getElectionRole()` | Get mapped election role | `Promise<string\|null>` |
| `hasRole(role)` | Check specific role | `Promise<boolean>` |
| `hasAnyRole(roles)` | Check any of roles | `Promise<boolean>` |
| `hasAllRoles(roles)` | Check all roles | `Promise<boolean>` |
| `hasPermission(permission)` | Check permission | `Promise<boolean>` |
| `hasAnyPermission(permissions)` | Check any permission | `Promise<boolean>` |
| `hasAllPermissions(permissions)` | Check all permissions | `Promise<boolean>` |
| `requireMember(redirectUrl)` | Require member role | `Promise<boolean>` |
| `requireAdmin(redirectUrl)` | Require admin/superuser | `Promise<boolean>` |
| `requireSuperuser(redirectUrl)` | Require superuser | `Promise<boolean>` |
| `requirePermission(permission, msg)` | Require permission | `Promise<boolean>` |
| `toggleElementByPermission(id, perm)` | Toggle element | `Promise<void>` |
| `toggleElementByRole(id, role)` | Toggle element | `Promise<void>` |
| `displayRoleIndicator(id)` | Show role badge | `Promise<void>` |

### Legacy Functions

| Function | Description | Returns |
|----------|-------------|---------|
| `canPerformAction(role, action)` | Check election action (legacy) | `boolean` |

**Note:** `canPerformAction()` is deprecated. Use `hasPermission()` instead for new code.

## Migration from Old System

### Before (Old RBAC - admin-elections/js/rbac.js)
```javascript
import { getCurrentUserRole, canPerformAction } from './rbac.js';

const userRole = await getCurrentUserRole();
// Returned: 'election-manager' or 'superadmin' directly

if (userRole === 'superadmin') {
  // Show delete button
}
```

### After (New Unified RBAC)
```javascript
import { getElectionRole, hasPermission, PERMISSIONS } from '../../js/rbac.js';

const electionRole = await getElectionRole();
// Returns: 'election-manager' or 'superadmin' (mapped from admin/superuser)

// OR better: use permission check
const canDelete = await hasPermission(PERMISSIONS.DELETE_ELECTION);
if (canDelete) {
  // Show delete button
}
```

### Before (Old Admin Access - admin/js/utils/admin-helpers.js)
```javascript
import { checkAdminAccess } from './utils/admin-helpers.js';

function checkAdminAccess(userData) {
  const roles = userData.roles || [];
  const hasAccess = roles.includes('admin') || roles.includes('superuser');
  
  if (!hasAccess) {
    throw new Error('Unauthorized: Admin or superuser role required');
  }
  return true;
}

// Usage
checkAdminAccess(userData);
```

### After (New Unified RBAC)
```javascript
import { requireAdmin } from '../../js/rbac.js';

// Usage
await requireAdmin(); // Automatically redirects if not admin/superuser
```

## Console Logging

All RBAC functions log to console for debugging:

```javascript
[RBAC] User roles from token: ['member', 'admin', 'superuser']
[RBAC] Highest role: superuser
[RBAC] Mapped superuser -> superadmin (elections)
[RBAC] User has permission 'delete-election' via role 'superuser'
[RBAC] ✓ Admin access granted
```

## Testing

### Manual Testing Checklist

**Member Role:**
- [ ] Can access `/members-area/dashboard.html`
- [ ] Cannot access `/admin/`
- [ ] Cannot access `/admin-elections/`
- [ ] Role badge shows "Félagsmaður"

**Admin Role:**
- [ ] Can access `/members-area/dashboard.html`
- [ ] Can access `/admin/`
- [ ] Can access `/admin-elections/`
- [ ] Cannot see delete buttons in elections list
- [ ] Role badge shows "Stjórnandi"

**Superuser Role:**
- [ ] Can access all areas
- [ ] Can see delete buttons in elections list
- [ ] Can delete elections
- [ ] Role badge shows "Kerfisstjóri"

**No Roles:**
- [ ] Redirected to login on member area access
- [ ] Cannot access any protected area

## File Structure

```
apps/members-portal/
├── js/
│   └── rbac.js                          ← Unified RBAC system (514 lines)
├── admin/
│   └── js/
│       └── admin.js                     ← Uses requireAdmin()
├── admin-elections/
│   └── js/
│       ├── elections-list.js            ← Uses requireAdmin(), getElectionRole()
│       └── election-create.js           ← Uses requireAdmin(), hasPermission()
└── members-area/
    └── dashboard.html                   ← Uses requireMember()
```

## Related Documentation

- [GitHub Issue #201](https://github.com/sosialistaflokkurinn/ekklesia/issues/201) - Elections Admin Implementation
- [Epic #192](https://github.com/sosialistaflokkurinn/ekklesia/issues/192) - Admin Elections Dashboard
- `SECURITY.md` - Security practices
- `docs/architecture/CSS_DESIGN_SYSTEM.md` - Role badge styles

## Implementation Details

**Commit:** `eb29019` - feat(rbac): Unified RBAC system across all portal areas  
**Date:** 2025-11-07  
**Files Changed:** 6 files, +607 insertions, -190 deletions  
**Deployment:** Firebase Hosting (104 files)

---

**Author:** Ekklesia Development Team  
**Last Updated:** 2025-11-07

````

## Related Documentation

- [GitHub Issue #201](https://github.com/sosialistaflokkurinn/ekklesia/issues/201) - Elections Admin Implementation
- [Epic #192](https://github.com/sosialistaflokkurinn/ekklesia/issues/192) - Admin Elections Dashboard
- `SECURITY.md` - Security practices
- `docs/architecture/CSS_DESIGN_SYSTEM.md` - Role badge styles

## Implementation Details

**Commit:** `eb29019` - feat(rbac): Unified RBAC system across all portal areas  
**Date:** 2025-11-07  
**Files Changed:** 6 files, +607 insertions, -190 deletions  
**Deployment:** Firebase Hosting (104 files)

---

**Höfundur:** Ekklesia Development Team  
**Síðast uppfært:** 2025-11-07
