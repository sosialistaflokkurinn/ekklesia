# Admin Portal Styles

**Last Updated**: 2025-11-05
**Pattern**: Layered CSS (shared foundation + admin-specific)

---

## Overview

Admin portal styles follow a **layered architecture**:
1. **Layer 1**: Shared foundation from `/styles/`
2. **Layer 2**: Admin-specific styles in `/admin/styles/`

This approach ensures consistency with the member portal while allowing admin-only customizations.

---

## Directory Structure

```
admin/styles/
├── README.md                       # This file
├── admin.css                       # Admin dashboard (6.8 KB)
├── admin-shared.css                # Admin utilities (3.5 KB)
├── members-admin.css               # Members list/detail (7.5 KB)
├── member-detail.css               # Member detail view (0.6 KB)
└── member-edit.css                 # Member edit form (2.3 KB)
```

**Note**: The empty `components/` directory was removed (2025-11-05) because admin uses shared components from `/styles/components/` instead.

---

## Shared vs Admin-Specific Styles

### Shared Components (from `/styles/`)

Admin portal **reuses** these components:

| Component | File | Used By |
|-----------|------|---------|
| **Global** | `/styles/global.css` | All admin pages |
| **Navigation** | `/styles/components/nav.css` | All admin pages with nav |
| **Page Layout** | `/styles/components/page.css` | All admin pages |

### Admin-Specific Styles (from `/admin/styles/`)

These styles are **unique to admin portal**:

| File | Purpose | Size |
|------|---------|------|
| `admin.css` | Admin dashboard styling | 6.8 KB |
| `admin-shared.css` | Admin utilities (badges, cards) | 3.5 KB |
| `members-admin.css` | Members list/detail/pagination | 7.5 KB |
| `member-detail.css` | Member detail view layout | 0.6 KB |
| `member-edit.css` | Member edit form styling | 2.3 KB |

**Total**: 20.7 KB

---

## HTML Usage Pattern

### Standard Admin Page

```html
<!DOCTYPE html>
<html lang="is">
<head>
  <!-- Layer 1: Shared foundation -->
  <link rel="stylesheet" href="/styles/global.css">
  <link rel="stylesheet" href="/styles/components/nav.css">
  <link rel="stylesheet" href="/styles/components/page.css">

  <!-- Layer 2: Admin-specific -->
  <link rel="stylesheet" href="/admin/styles/admin.css">
</head>
<body class="authenticated admin">
  <!-- Admin dashboard content -->
</body>
</html>
```

### Members List Page

```html
<!DOCTYPE html>
<html lang="is">
<head>
  <!-- Shared foundation -->
  <link rel="stylesheet" href="/styles/global.css">
  <link rel="stylesheet" href="/styles/components/nav.css">
  <link rel="stylesheet" href="/styles/components/page.css">

  <!-- Admin-specific -->
  <link rel="stylesheet" href="/admin/styles/admin.css">
  <link rel="stylesheet" href="/admin/styles/members-admin.css">
</head>
<body class="authenticated admin">
  <!-- Members list content -->
</body>
</html>
```

---

## CSS Files Explained

### admin.css - Admin Dashboard

**Purpose**: Styles for admin dashboard (quick actions, stats cards)

**Key classes**:
```css
.admin-dashboard { ... }
.quick-actions { ... }
.stat-card { ... }
```

**Used by**:
- `admin/admin.html`
- Most other admin pages (common layout)

---

### admin-shared.css - Admin Utilities

**Purpose**: Reusable admin components (role badges, admin cards)

**Key classes**:
```css
.admin-badge { ... }
.admin-card { ... }
.admin-status { ... }
```

**Used by**:
- `admin/member-detail.html`
- Any page showing admin-specific UI elements

---

### members-admin.css - Members List

**Purpose**: Members list table, search, pagination

**Key classes**:
```css
.members-table { ... }
.members-search { ... }
.members-pagination { ... }
.members-filter { ... }
```

**Used by**:
- `admin/members.html` (members list)

**Size**: 7.5 KB (largest admin-specific file)

---

### member-detail.css - Member Detail View

**Purpose**: Layout for individual member detail page

**Key classes**:
```css
.member-detail-header { ... }
.member-detail-section { ... }
```

**Used by**:
- `admin/member-detail.html`

**Size**: 0.6 KB (small file, minimal overrides)

---

### member-edit.css - Member Edit Form

**Purpose**: Form styling for editing member data

**Key classes**:
```css
.member-edit-form { ... }
.form-section { ... }
.form-actions { ... }
```

**Used by**:
- `admin/member-edit.html`

**Size**: 2.3 KB

---

## Why No `/admin/styles/components/`?

**Answer**: Admin portal **shares components** from `/styles/components/`.

**Benefits**:
- ✅ **Consistency** - Same navigation in member and admin portals
- ✅ **DRY** - No duplicate CSS for nav, page layout
- ✅ **Smaller bundle** - Shared CSS loaded once, cached by browser
- ✅ **Easier maintenance** - Fix navigation CSS once, fixes everywhere

**Verified**: All admin HTML files import from `/styles/components/`, never from `/admin/styles/components/`.

---

## Adding New Admin Styles

### Should it be in `/admin/styles/`?

Ask these questions:

1. **Is it admin-only functionality?**
   - Yes → Add to `/admin/styles/`
   - No → Consider adding to `/styles/components/` (shared)

2. **Is it used in multiple admin pages?**
   - Yes → Add to `admin-shared.css`
   - No → Add to page-specific file (e.g., `members-admin.css`)

3. **Is it a variation of existing shared component?**
   - Yes → Override in admin-specific file (use `.admin` scoping)
   - No → Create new component

### Example: Admin-Only Alert

```css
/* /admin/styles/admin-shared.css */
.admin-alert {
  background: var(--color-warning);
  border-left: 4px solid var(--color-primary);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.admin-alert--danger {
  background: #ffe6e6;
  border-left-color: var(--color-error);
}
```

---

## CSS Variables from Global

Admin styles can use all global CSS variables:

```css
/* From /styles/global.css */
:root {
  --color-primary: #DC143C;           /* Socialist red */
  --color-primary-dark: #B01030;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --font-family: -apple-system, ...;
}
```

**Usage in admin styles**:
```css
/* /admin/styles/admin.css */
.admin-dashboard {
  padding: var(--spacing-lg);
  font-family: var(--font-family);
}

.admin-badge--role {
  background: var(--color-primary);
  color: white;
}
```

---

## Admin Body Classes

Admin pages use these classes:

```html
<body class="authenticated admin">
```

**Classes explained**:
- `.authenticated` - User is logged in (hides login page elements)
- `.admin` - User has admin role (enables admin-specific styling)

**CSS scoping**:
```css
/* Only applies to admin pages */
.admin .members-table {
  /* Admin-specific table styling */
}

/* Only applies to authenticated pages */
.authenticated .nav {
  /* Show full navigation */
}
```

---

## Performance Considerations

### CSS Loading Order

```html
<!-- 1. Global (smallest, most important) -->
<link rel="stylesheet" href="/styles/global.css">

<!-- 2. Shared components (cached across member + admin) -->
<link rel="stylesheet" href="/styles/components/nav.css">
<link rel="stylesheet" href="/styles/components/page.css">

<!-- 3. Admin-specific (loaded last, admin-only) -->
<link rel="stylesheet" href="/admin/styles/admin.css">
```

**Why this order?**
- Global styles apply first (CSS variables, resets)
- Shared components next (navigation, layout)
- Admin-specific last (overrides shared styles if needed)

### Caching Strategy

**Shared components** (`/styles/components/`):
- Cached by browser for member portal
- Reused when user visits admin portal
- No duplicate download

**Admin-specific** (`/admin/styles/`):
- Only loaded on admin pages
- Not loaded for regular members
- Keeps member portal lightweight

---

## File Size Summary

| Category | Files | Total Size | Notes |
|----------|-------|------------|-------|
| **Shared foundation** | 3 files | ~28 KB | `/styles/global.css` + 2 components |
| **Admin-specific** | 5 files | ~21 KB | `/admin/styles/*.css` |
| **Total for admin page** | 8 files | ~49 KB | Minified: ~30 KB |

**Optimization**: CSS could be minified and combined for production.

---

## Related Documentation

- **Shared CSS Architecture**: See `/styles/README.md`
- **Admin i18n System**: See `/admin/i18n/` (separate from member portal)
- **Admin JavaScript**: See `/admin/js/`

---

**Pattern**: Layered CSS (shared + admin-specific)
**Shared from**: `/styles/global.css` + `/styles/components/`
**Admin-specific**: 5 files (20.7 KB)
**Empty directory removed**: `components/` (2025-11-05)
