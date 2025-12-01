# CSS Architecture

**Last Updated**: 2025-11-24
**Pattern**: Component-based CSS with shared components
**Methodology**: BEM (partially applied)

---

## Overview

The Ekklesia members portal uses a **component-based CSS architecture** where:
- **Global styles** define variables, resets, and utilities
- **Shared components** are reused across member and admin portals
- **Portal-specific styles** add custom styling on top of shared foundation

---

## Directory Structure

```
styles/
├── global.css                      # Variables, resets, utilities (shared)
└── components/                     # SHARED COMPONENTS (used by both portals)
    ├── nav.css                     # Navigation (5.7 KB)
    ├── page.css                    # Page layout (2.9 KB)
    ├── login.css                   # Login page (3.1 KB)
    ├── events-test.css             # Events test page (2.6 KB)
    └── profile-edit.css            # Profile edit form (13.2 KB)

admin/styles/                       # ADMIN-SPECIFIC STYLES
├── admin.css                       # Admin dashboard (6.8 KB)
├── admin-shared.css                # Admin utilities (3.5 KB)
├── members-admin.css               # Members list/detail (7.5 KB)
├── member-detail.css               # Member detail view (0.6 KB)
└── member-edit.css                 # Member edit form (2.3 KB)
```

**Total**: 5 shared components + 5 admin-specific styles

---

## Shared Components

### What Are Shared Components?

Components in `/styles/components/` are **reused by both member and admin portals**.

**Benefits**:
- ✅ **DRY (Don't Repeat Yourself)** - Navigation CSS written once, used everywhere
- ✅ **Consistency** - Same navigation style in member and admin portals
- ✅ **Maintainability** - Fix a bug once, fixes everywhere
- ✅ **Smaller Bundle** - No duplicate CSS

### Components Currently Shared

| Component | File | Size | Used By |
|-----------|------|------|---------|
| **Navigation** | `nav.css` | 5.7 KB | Member portal (7 pages) + Admin portal (6 pages) |
| **Page Layout** | `page.css` | 2.9 KB | Member portal (6 pages) + Admin portal (6 pages) |
| **Login** | `login.css` | 3.1 KB | Member portal login page |
| **Events Test** | `events-test.css` | 2.6 KB | Member portal test page |
| **Profile Edit** | `profile-edit.css` | 13.2 KB | Member & admin profile pages (mobile-responsive) |

**Total shared**: 27.5 KB

---

## Usage Example

### Member Portal HTML

```html
<!DOCTYPE html>
<html lang="is">
<head>
  <!-- Global styles -->
  <link rel="stylesheet" href="/styles/global.css">

  <!-- Shared components -->
  <link rel="stylesheet" href="/styles/components/nav.css">
  <link rel="stylesheet" href="/styles/components/page.css">
</head>
<body>
  <!-- Uses shared navigation and page layout -->
</body>
</html>
```

### Admin Portal HTML

```html
<!DOCTYPE html>
<html lang="is">
<head>
  <!-- Global styles (shared) -->
  <link rel="stylesheet" href="/styles/global.css">

  <!-- Shared components (same as member portal) -->
  <link rel="stylesheet" href="/styles/components/nav.css">
  <link rel="stylesheet" href="/styles/components/page.css">

  <!-- Admin-specific styles -->
  <link rel="stylesheet" href="/admin/styles/admin.css">
</head>
<body>
  <!-- Uses shared navigation + page layout + admin dashboard styles -->
</body>
</html>
```

**Key Point**: Admin portal imports shared components from `/styles/components/`, not `/admin/styles/components/`.

---

## Admin Portal CSS Strategy

Admin portal follows a **layered approach**:

1. **Layer 1: Shared foundation** (`/styles/global.css` + `/styles/components/`)
   - Global variables (colors, spacing, typography)
   - Navigation component
   - Page layout component

2. **Layer 2: Admin-specific styles** (`/admin/styles/`)
   - Admin dashboard styling
   - Members list/detail styling
   - Admin-only UI elements

**Files using shared components**:
- ✅ `admin/admin.html` - Dashboard
- ✅ `admin/members.html` - Members list
- ✅ `admin/member-detail.html` - Member detail
- ✅ `admin/member-edit.html` - Member edit
- ✅ `admin/sync-members.html` - Sync members
- ✅ `admin/sync-history.html` - Sync history

**Files NOT using shared components** (simple pages):
- `admin/index.html` - Landing/redirect page
- `admin/migrate-events.html` - Utility page

---

## Global CSS Variables

### Color Palette

```css
/* /styles/global.css */
:root {
  /* Socialist red (brand color) */
  --color-primary: #DC143C;
  --color-primary-dark: #B01030;

  /* Grayscale */
  --color-text: #1a1a1a;
  --color-text-muted: #666;
  --color-border: #ddd;
  --color-background: #f5f5f5;

  /* Semantic colors */
  --color-success: #28a745;
  --color-error: #dc3545;
  --color-warning: #ffc107;
}
```

### Typography

```css
:root {
  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-size-base: 16px;
  --font-size-small: 14px;
  --font-size-large: 18px;
  --line-height: 1.5;
}
```

### Spacing

```css
:root {
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
}
```

---

## BEM Methodology (Partial)

Some components follow BEM (Block Element Modifier) naming:

### Example: Navigation Component

```css
/* Block */
.nav { ... }

/* Element */
.nav__container { ... }
.nav__brand { ... }
.nav__link { ... }

/* Modifier */
.nav__link--active { ... }
.nav__link--logout { ... }
```

**Benefits**:
- Clear relationship between classes
- Avoids naming conflicts
- Self-documenting CSS

**Status**: Not all components use BEM yet (work in progress).

---

## Adding New Styles

### Should it be shared?

Ask these questions:

1. **Is it used in both member and admin portals?**
   - Yes → Add to `/styles/components/`
   - No → Add to `/admin/styles/` or `/styles/components/` (member-only)

2. **Is it a reusable UI pattern?**
   - Yes → Add to `/styles/components/`
   - No → Add inline or to page-specific file

3. **Is it admin-specific functionality?**
   - Yes → Add to `/admin/styles/`
   - No → Consider sharing

### Example: Adding a "Card" Component

**If used by both portals**:

```bash
# Create shared component
touch /home/gudro/Development/projects/ekklesia/apps/members-portal/styles/components/card.css
```

```css
/* /styles/components/card.css */
.card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  padding: var(--spacing-lg);
}

.card__title {
  font-size: var(--font-size-large);
  margin-bottom: var(--spacing-md);
}
```

```html
<!-- Use in member portal -->
<link rel="stylesheet" href="/styles/components/card.css">

<!-- Use in admin portal -->
<link rel="stylesheet" href="/styles/components/card.css">
```

---

## Future Improvements

Possible enhancements:

- [ ] Apply BEM methodology to all components
- [ ] Add dark mode support (CSS custom properties ready)
- [ ] Add responsive breakpoints as CSS variables
- [ ] Create component documentation (Storybook-style)
- [ ] Add CSS linting (stylelint)
- [ ] Consider CSS modules or CSS-in-JS for larger project

---

## Related Documentation

- **i18n System**: See `i18n/README.md`
- **Admin Portal**: Admin uses shared components + admin-specific styles
- **Member Portal**: Uses shared components only

---

**Architecture**: Component-based with shared foundation
**Shared Components**: 5 files (27.5 KB)
**Admin-Specific**: 5 files (20.7 KB)
**Total CSS**: 48.2 KB (minified would be ~30 KB)
