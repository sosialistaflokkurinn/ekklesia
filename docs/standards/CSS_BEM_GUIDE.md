# Ekklesia CSS & BEM Style Guide

**Last Updated**: 2025-11-04
**Status**: ✅ Active - Canonical BEM Methodology
**Naming**: Industry-standard BEM (Block Element Modifier)
**Location**: Relocated from `docs/design/CSS_DESIGN_SYSTEM.md`

---

## Overview

This document describes the CSS design system for the Ekklesia Members Service, following canonical BEM (Block Element Modifier) methodology with separate utility class namespace.

### Design Standards Compliance

✅ **BEM methodology** - Canonical implementation (block, block__element, block--modifier)
✅ **Utility namespace** - `.u-name` prefix to avoid conflicts with CSS variables
✅ **No inline styles** - 100% compliant
✅ **CSS variables** - Colors, spacing, radius (--color-*, --spacing-*, etc.)
✅ **No Tailwind CSS** - Pure CSS only
✅ **Grouped files** - Organized by components

---

## BEM Naming Convention

### Structure

**Block**: Standalone component (`.nav`, `.card`, `.form`)
**Element**: Part of a block (`.nav__link`, `.card__title`, `.form__input`)
**Modifier**: Variation of block or element (`.nav__link--active`, `.card--welcome`, `.form__input--monospace`)
**Utility**: Reusable helper (`.u-hidden`, `.u-margin-top-md`)

### Examples

```html
<!-- Navigation block with elements and modifiers -->
<nav class="nav">
  <div class="nav__container">
    <a href="/" class="nav__brand">Brand</a>
    <div class="nav__links">
      <a href="/dashboard" class="nav__link nav__link--active">Dashboard</a>
      <a href="/profile" class="nav__link">Profile</a>
      <a href="#" class="nav__link nav__link--logout">Logout</a>
    </div>
  </div>
</nav>

<!-- Card block with modifier -->
<div class="card card--welcome">
  <h2 class="card__title">Welcome!</h2>
  <p class="card__content">Content here</p>
</div>

<!-- Utilities (separate namespace) -->
<div class="u-hidden">Hidden content</div>
<p class="u-text-muted u-margin-top-sm">Helper text</p>
```

### Why NOT `--prefix` for Everything?

❌ **Wrong** (our first attempt):
```css
.--header { }       /* Looks like CSS variable, not a class */
.--container { }    /* No block context, namespace collision */
.--card__title { }  /* Mixed notation, confusing */
```

✅ **Correct** (canonical BEM):
```css
.nav { }            /* Clear block name */
.nav__container { } /* Element belongs to nav */
.card__title { }    /* Element belongs to card */
.nav__link--active { } /* Modifier on element */
```

**Benefits**:
- Clear block/element relationships
- No namespace collisions (`.nav__container` ≠ `.page__container`)
- Standard BEM tooling works
- No confusion with CSS custom properties (`--color-primary`)

---

## Design Tokens Architecture

We use a 3-layer architecture for CSS variables (Design Tokens) to ensure consistency and maintainability.

### Layer 1: Primitives (Base Values)
Raw values for colors, spacing, and typography. These should rarely be used directly in components.

#### Colors
```css
/* Primary Colors (Socialist Red) */
--color-primary: #d32f2f;        /* Main brand red */
--color-primary-dark: #b71c1c;   /* Darker red for hover states */
--color-accent-gold: #f3b41b;    /* Socialist star accent */

/* Neutral Colors (Gray Scale) */
--color-gray-50: #f7fafc;
--color-gray-100: #edf2f7;
--color-gray-200: #e2e8f0;
--color-gray-800: #1a202c;
/* ... full palette in global.css ... */
```

#### Spacing
```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 40px;
```

### Layer 2: Semantic Layer (System Tokens)
Functional names mapped to primitives. **Use these in your components.** This layer enables theming (e.g., Dark Mode) without changing component code.

```css
:root {
  /* Text */
  --color-text: var(--color-gray-800);
  --color-text-light: var(--color-gray-600);
  --color-text-inverse: #FFFFFF;

  /* Backgrounds */
  --color-bg: #FFFFFF;
  --color-bg-alt: var(--color-gray-100);
  --color-bg-card: #FFFFFF;

  /* Borders */
  --color-border: var(--color-gray-200);
  --border-radius: var(--radius-md);

  /* Primary Actions */
  --color-primary: #d32f2f;
  --color-primary-hover: #b71c1c;
  --color-on-primary: #FFFFFF;
}
```

### Layer 3: Component Layer
Specific overrides for components (defined in component files).

```css
.card {
  background-color: var(--color-bg-card); /* Uses Semantic Layer */
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
}
```

---

## Utility Classes

Utilities use `.u-` prefix to separate them from component classes and avoid collision with CSS custom properties (`--`).

### State Classes

#### `.u-clickable`
Makes an element appear clickable (removes underline, adds pointer cursor).

**Usage**: Links styled as cards or buttons
```html
<a href="/profile" class="info-grid__item u-clickable">
  <div class="info-grid__label">My Profile</div>
  <div class="info-grid__value">View and edit</div>
</a>
```

**CSS**:
```css
.u-clickable {
  text-decoration: none;
  cursor: pointer;
}
```

#### `.u-disabled`
Disabled/inactive state (50% opacity).

**Usage**: Disabled menu items, coming soon features
```html
<div class="info-grid__item u-disabled">
  <div class="info-grid__label">Voting</div>
  <div class="info-grid__value">Coming soon</div>
</div>
```

#### `.u-hidden`
Hides element completely (`display: none`).

**Usage**: Conditionally shown elements (controlled by JavaScript)
```html
<div id="error-message" class="u-text-error u-margin-top-md u-hidden">
  <!-- JavaScript removes .u-hidden to show -->
</div>
```

---

### Spacing Utilities

#### Margin Top
- `.u-margin-top-sm` - 8px top margin
- `.u-margin-top-md` - 16px top margin

#### Margin Bottom
- `.u-margin-bottom-xs` - 4px bottom margin
- `.u-margin-bottom-sm` - 8px bottom margin
- `.u-margin-bottom-md` - 16px bottom margin

**Usage**:
```html
<p class="u-text-muted u-margin-top-sm">Helper text</p>
<div class="u-margin-top-md">Content with more space</div>
```

---

### Text Utilities

#### `.u-text-muted`
Muted text color (gray, 14px font size).

**Usage**: Helper text, descriptions, secondary information
```html
<p class="u-text-muted">
  This is helper text that explains the feature
</p>
```

#### `.u-text-error`
Error text color (orange/red).

**Usage**: Error messages, validation feedback
```html
<div class="u-text-error u-margin-top-md">
  Invalid input - please try again
</div>
```

---

## Component Classes (BEM Blocks)

### Login (`.login`)

**Block**: `.login` (login page container)
**Elements**: `.login__subtitle`, `.login__status`
**Modifiers**: `.login__status--authenticated`, `.login__status--not-authenticated`, `.login__status--authenticating`, `.login__status--error`

The login page uses a dedicated `.login` block instead of the generic `.container` class to provide proper BEM scoping and avoid namespace collisions.

#### Structure
```html
<div class="login">
  <h1>Welcome</h1>
  <p class="login__subtitle">Please log in to continue</p>

  <div class="login__status login__status--not-authenticated">
    <span>Not authenticated</span>
  </div>

  <button class="btn">Login</button>
</div>
```

#### CSS
```css
.login { /* Block */
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--spacing-xl);
  max-width: 600px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.login__subtitle { /* Element */
  color: var(--color-gray-500);
  margin-bottom: 30px;
  font-size: 14px;
}

.login__status { /* Element */
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  margin-bottom: 20px;
}

.login__status--authenticated { /* Modifier */
  background: var(--color-success-bg);
  color: var(--color-success-text);
}

.login__status--not-authenticated { /* Modifier */
  background: var(--color-error-bg);
  color: var(--color-error-text);
}
```

---

### Navigation (`.nav`)

**Block**: `.nav`
**Elements**: `.nav__container`, `.nav__brand`, `.nav__links`, `.nav__link`
**Modifiers**: `.nav__link--active`, `.nav__link--logout`

#### Structure
```html
<nav class="nav">
  <div class="nav__container">
    <a href="/" class="nav__brand">Brand Name</a>
    <div class="nav__links">
      <a href="/dashboard" class="nav__link nav__link--active">Dashboard</a>
      <a href="/profile" class="nav__link">Profile</a>
      <a href="#" class="nav__link nav__link--logout">Logout</a>
    </div>
  </div>
</nav>
```

#### CSS
```css
.nav { /* Block */
  background: var(--color-primary);
  padding: var(--spacing-md) var(--spacing-xl);
}

.nav__container { /* Element */
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
}

.nav__link { /* Element */
  color: white;
  text-decoration: none;
  padding: var(--spacing-sm) var(--spacing-md);
}

.nav__link--active { /* Modifier */
  background: rgba(255, 255, 255, 0.2);
  font-weight: 500;
}

.nav__link--logout { /* Modifier */
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
}
```

---

### Card (`.card`)

**Block**: `.card`
**Elements**: `.card__title`, `.card__content`
**Modifiers**: `.card--welcome`

#### Structure
```html
<div class="card">
  <h3 class="card__title">Card Title</h3>
  <div class="card__content">
    Card content goes here
  </div>
</div>
```

#### Modifier: Welcome Card
```html
<div class="card card--welcome">
  <h2 class="card__title">Welcome!</h2>
  <p class="card__content">Welcome message</p>
</div>
```

#### CSS
```css
.card { /* Block */
  background: white;
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card__title { /* Element */
  font-size: 20px;
  font-weight: 600;
  color: var(--color-gray-800);
}

.card--welcome { /* Modifier */
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  color: white;
}

.card--welcome .card__title { /* Modifier affects nested element */
  color: white;
}
```

---

### Info Grid (`.info-grid`)

**Block**: `.info-grid`
**Elements**: `.info-grid__item`, `.info-grid__label`, `.info-grid__value`

Display user information in a responsive grid layout.

#### Structure
```html
<div class="info-grid">
  <div class="info-grid__item">
    <div class="info-grid__label">Email</div>
    <div class="info-grid__value">user@example.com</div>
  </div>
  <div class="info-grid__item">
    <div class="info-grid__label">Member Since</div>
    <div class="info-grid__value">January 2025</div>
  </div>
</div>
```

#### CSS
```css
.info-grid { /* Block */
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-md);
}

.info-grid__item { /* Element */
  padding: var(--spacing-md);
  background: var(--color-gray-50);
  border-radius: var(--radius-sm);
}

.info-grid__label { /* Element */
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-gray-500);
}

.info-grid__value { /* Element */
  font-size: 16px;
  color: var(--color-gray-800);
  font-weight: 500;
}
```

---

### Form (`.form`)

**Block**: `.form` (implicit, not used as class)
**Elements**: `.form__group`, `.form__label`, `.form__input`, `.form__select`
**Modifiers**: `.form__input--monospace`

#### Structure
```html
<div class="form__group">
  <label class="form__label">Input Label</label>
  <input type="text" class="form__input" placeholder="Enter value">
</div>

<div class="form__group">
  <label class="form__label">Monospace Input</label>
  <input type="text" class="form__input form__input--monospace" placeholder="Token">
</div>

<div class="form__group">
  <label class="form__label">Select Option</label>
  <select class="form__select">
    <option>Option 1</option>
    <option>Option 2</option>
  </select>
</div>
```

#### CSS
```css
.form__group { /* Element */
  margin-bottom: 10px;
}

.form__label { /* Element */
  display: block;
  margin-bottom: 5px;
  font-weight: 600;
}

.form__input { /* Element */
  width: 100%;
  padding: 8px;
  border: 1px solid var(--color-gray-300);
  border-radius: var(--radius-sm);
}

.form__input--monospace { /* Modifier */
  font-family: monospace;
}

.form__select { /* Element */
  width: 100%;
  padding: 8px;
  border: 1px solid var(--color-gray-300);
  border-radius: var(--radius-sm);
}
```

---

### Button (`.btn`)

**Block**: `.btn`
**Modifiers**: `.btn--secondary`, `.btn--outline`, `.btn--danger`

#### Structure
```html
<button class="btn">Primary Button</button>
<button class="btn btn--secondary">Secondary Button</button>
<button class="btn" disabled>Disabled Button</button>
<button class="btn btn--outline">Membership Verify</button>
<button class="btn btn--danger">Danger Button</button>
```

#### CSS
```css
.btn { /* Block */
  display: inline-block;
  padding: 12px var(--spacing-lg);
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn:hover {
  background: var(--color-primary-dark);
}

.btn:disabled {
  background: var(--color-gray-300);
  cursor: not-allowed;
}

.btn--secondary { /* Modifier */
  background: var(--color-error-border);
}

.btn--secondary:hover {
  background: #c53030;
}

.btn--outline { /* Modifier */
  position: relative;
  border: 1px solid rgba(0, 0, 0, 0.08);
  padding-left: calc(var(--spacing-lg) + 28px);
}

.btn--outline::before { /* Socialist star accent */
  content: '';
  position: absolute;
  top: 50%;
  left: var(--spacing-md);
  width: 18px;
  height: 18px;
  background-color: var(--color-accent-gold);
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'/%3E%3C/svg%3E");
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'/%3E%3C/svg%3E");
  transform: translateY(-50%);
}

.btn--danger { /* Modifier */
  background: #a51616;
}

.btn--danger:hover {
  background: #7d0f0f;
}
```

---

### Debug Log (`.debug-log`)

**Block**: `.debug-log`
**Elements**: `.debug-log__entry`, `.debug-log__timestamp`
**Modifiers**: `.debug-log__entry--success`, `.debug-log__entry--error`, `.debug-log__entry--info`

Debug logging component for development and testing pages.

#### Structure
```html
<div class="debug-log">
  <div class="debug-log__entry debug-log__entry--success">
    <span class="debug-log__timestamp">10:15:23</span>
    Success message
  </div>
  <div class="debug-log__entry debug-log__entry--error">
    <span class="debug-log__timestamp">10:15:24</span>
    Error message
  </div>
  <div class="debug-log__entry debug-log__entry--info">
    <span class="debug-log__timestamp">10:15:25</span>
    Info message
  </div>
</div>
```

#### CSS
```css
.debug-log { /* Block */
  background: var(--color-gray-800);
  color: var(--color-gray-400);
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  font-family: 'Courier New', monospace;
  font-size: 12px;
  max-height: 300px;
  overflow-y: auto;
}

.debug-log__entry { /* Element */
  margin: var(--spacing-xs) 0;
  padding: var(--spacing-xs) 0;
  border-bottom: 1px solid var(--color-gray-700);
}

.debug-log__timestamp { /* Element */
  color: var(--color-gray-500);
}

.debug-log__entry--success { /* Modifier */
  color: var(--color-success);
}

.debug-log__entry--error { /* Modifier */
  color: var(--color-error);
}

.debug-log__entry--info { /* Modifier */
  color: var(--color-info);
}
```

---

## Best Practices

### When to Use BEM vs Utilities

✅ **Use BEM for**:
- Components (navigation, cards, forms)
- Related elements (nav__link, card__title)
- Variations (card--welcome, btn--secondary)

✅ **Use utilities for**:
- Spacing adjustments (`.u-margin-top-md`)
- State variations (`.u-hidden`, `.u-disabled`)
- Text styles (`.u-text-muted`, `.u-text-error`)
- Simple interactions (`.u-clickable`)

❌ **Don't**:
- Mix BEM and utilities for the same purpose
- Create utilities for complex components
- Use utilities when a modifier makes more sense

### When to Create New BEM Blocks

Create a new BEM block when:
1. Component is used in 2+ places
2. Component has logical grouping of elements
3. Component has semantic meaning (e.g., `.user-badge`)
4. Component needs modifiers

### Naming Conventions

- **BEM blocks**: `.block` (e.g., `.nav`, `.card`, `.form`)
- **BEM elements**: `.block__element` (e.g., `.nav__link`, `.card__title`)
- **BEM modifiers**: `.block--modifier` or `.block__element--modifier`
- **Utilities**: `.u-name` (e.g., `.u-hidden`, `.u-margin-top-md`)
- **State classes**: `.active`, `.authenticated` (applied to blocks/elements)

### File Organization

```
styles/
├── global.css              # Variables, reset, utilities
└── components/
    ├── nav.css             # Navigation component (.nav)
    ├── page.css            # Page layouts, cards, info grids
    ├── login.css           # Login page components
    └── events-test.css     # Test page components, forms
```

---

## Migration from Old Naming

### Old → New Mapping

**Utility classes** (now with `.u-` prefix):
- `.clickable` → `.u-clickable`
- `.hidden` → `.u-hidden`
- `.margin-top-md` → `.u-margin-top-md`

**Navigation**:
- `.nav-header` → `.nav`
- `.nav-link` → `.nav__link`
- `.nav-link.active` → `.nav__link.nav__link--active`
- `.nav-logout` → `.nav__link--logout`

**Cards**:
- `.card` → `.card`
- `.card-title` → `.card__title`
- `.welcome-card` → `.card--welcome`

**Forms**:
- `.form-group` → `.form__group`
- `.form-input` → `.form__input`
- `.form-input-monospace` → `.form__input--monospace`

**See**: `scripts/convert-to-bem.js` for complete conversion mapping

---

## Common Pitfalls to Avoid

❌ **Don't use `--` for blocks**:
```css
.--nav { }  /* Wrong: looks like CSS variable */
.nav { }    /* Correct: clear block name */
```

❌ **Don't omit block names**:
```css
.--container { }  /* Wrong: no context, namespace collision */
.nav__container { }  /* Correct: belongs to nav */
.page__container { } /* Correct: belongs to page */
```

❌ **Don't mix naming conventions**:
```html
<div class="card">
  <h3 class="card-title">Wrong</h3>  <!-- Inconsistent: dash vs underscore -->
  <h3 class="card__title">Correct</h3>
</div>
```

❌ **Don't confuse utilities with CSS variables**:
```css
.--margin-top { }  /* Wrong: conflicts with --spacing-* variables */
.u-margin-top { }  /* Correct: separate utility namespace */
```

---

## Admin Portal Components

### Admin Color Variables

The admin portal uses dedicated CSS variables defined in `admin.css` to maintain consistent styling across all admin pages.

#### Admin Variables (`:root` in `admin.css`)

```css
:root {
  /* Admin section/card colors */
  --admin-card-bg: var(--color-white);          /* White background for all admin cards */
  --admin-card-border: var(--color-border-light); /* Light gray border */

  /* Admin text colors */
  --admin-text-primary: var(--color-black);      /* Black text for main content */
  --admin-text-secondary: #4a4a4a;               /* Dark gray for labels */
  --admin-text-muted: var(--color-gray-500);     /* Muted gray for subtle text */
}
```

**Usage**: These variables ensure all admin cards (member details, member edit, sync pages) have consistent white backgrounds and black text, regardless of the page-specific theme.

---

### Admin Shared Components (`.admin-*`)

**File**: `admin-shared.css`

**Purpose**: Reusable components for all admin pages (member detail, member edit, sync, etc.)

These components follow BEM methodology with `.admin-` prefix to differentiate from member portal components.

#### Admin Section (`.admin-section`)

**Block**: `.admin-section`
**Elements**: `.admin-section__title`

Card-style sections for grouping related information (used across all admin pages).

**Structure**:
```html
<section class="admin-section">
  <h2 class="admin-section__title">Grunnupplýsingar</h2>
  <div class="admin-grid">
    <!-- Fields here -->
  </div>
</section>
```

**CSS**:
```css
.admin-section {
  background: var(--admin-card-bg);
  border: 1px solid var(--admin-card-border);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.admin-section__title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--admin-text-primary);
  margin: 0 0 1.5rem 0;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid var(--admin-card-border);
}
```

---

#### Admin Field Grid (`.admin-grid`, `.admin-field`)

**Block**: Implicit (no `.admin-grid` as block)
**Elements**: `.admin-field`, `.admin-field__label`, `.admin-field__value`

Responsive grid for displaying label-value pairs in admin pages.

**Structure**:
```html
<div class="admin-grid">
  <div class="admin-field">
    <label class="admin-field__label">Nafn</label>
    <p class="admin-field__value">Jón Jónsson</p>
  </div>
  <div class="admin-field">
    <label class="admin-field__label">Kennitala</label>
    <p class="admin-field__value">111111-1111</p>
  </div>
</div>
```

**CSS**:
```css
.admin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.admin-field {
  display: flex;
  flex-direction: column;
}

.admin-field__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--admin-text-secondary);
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.admin-field__value {
  font-size: 1rem;
  color: var(--admin-text-primary);
  word-break: break-word;
  margin: 0;
}
```

**Responsive**: On mobile (<768px), grid collapses to single column.

---

#### Admin Status Badges (`.admin-badge`)

**Block**: `.admin-badge`
**Modifiers**: `.admin-badge--success`, `.admin-badge--error`, `.admin-badge--warning`, `.admin-badge--neutral`

Status indicators for member states, sync status, etc.

**Structure**:
```html
<span class="admin-badge admin-badge--success">Virkur</span>
<span class="admin-badge admin-badge--error">Óvirkur</span>
<span class="admin-badge admin-badge--warning">Í bið</span>
<span class="admin-badge admin-badge--neutral">Óþekkt</span>
```

**CSS**:
```css
.admin-badge {
  display: inline-block;
  padding: 0.375rem 0.75rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
}

.admin-badge--success {
  background-color: var(--color-success-bg-light);
  color: var(--color-success-green);
}

.admin-badge--error {
  background-color: var(--color-error-bg-lighter);
  color: var(--color-error-deep-orange);
}

.admin-badge--warning {
  background-color: var(--color-warning-bg);
  color: var(--color-warning-dark);
}

.admin-badge--neutral {
  background-color: var(--color-gray-100);
  color: var(--color-gray-500);
}
```

---

#### Admin State Components

**Blocks**: `.admin-loading`, `.admin-error`, `.admin-not-found`
**Elements**: `.admin-error__message`, `.admin-not-found__message`

Loading, error, and not-found states for admin pages.

**Structure**:
```html
<!-- Loading State -->
<div class="admin-loading">
  <div class="spinner"></div>
  <p>Hleð upplýsingum...</p>
</div>

<!-- Error State -->
<div class="admin-error">
  <p class="admin-error__message">Villa kom upp</p>
  <button class="btn btn--secondary">Reyna aftur</button>
</div>

<!-- Not Found State -->
<div class="admin-not-found">
  <p class="admin-not-found__message">Félagi fannst ekki</p>
  <a href="/admin/members.html" class="btn btn--secondary">Til baka</a>
</div>
```

**CSS**:
```css
.admin-loading,
.admin-error,
.admin-not-found {
  text-align: center;
  padding: 3rem 1rem;
}

.admin-loading .spinner {
  margin: 0 auto 1rem;
}

.admin-error__message,
.admin-not-found__message {
  color: var(--color-error);
  font-size: 1.1rem;
  margin-bottom: 1.5rem;
}
```

---

#### Admin Back Navigation (`.admin-back`)

**Block**: `.admin-back`
**Elements**: `.admin-back__link`

Consistent back navigation for all admin pages.

**Structure**:
```html
<div class="admin-back">
  <a href="/admin/members.html" class="admin-back__link">
    ← Til baka til félaga
  </a>
</div>
```

**CSS**:
```css
.admin-back {
  margin-bottom: 1.5rem;
}

.admin-back__link {
  display: inline-flex;
  align-items: center;
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: 0.95rem;
  transition: color 0.2s ease;
}

.admin-back__link:hover {
  color: var(--color-primary);
}
```

---

### Admin File Structure

```
apps/members-portal/admin/styles/
├── admin.css              # Admin-specific overrides and variables
├── admin-shared.css       # Shared admin components (NEW - 2025-10-31)
├── member-detail.css      # Member detail page-specific styles
├── member-edit.css        # Member edit page-specific styles
├── members.css            # Member list page styles
├── sync-members.css       # Sync page styles
└── sync-history.css       # Sync history page styles
```

**Design Pattern**:
- `admin.css` - Global admin variables and overrides
- `admin-shared.css` - Reusable components (`.admin-section`, `.admin-grid`, etc.)
- Page-specific CSS - Page-unique styles only

**Benefits**:
- Single source of truth for admin component styles
- Consistent white cards and black text across all admin pages
- Easy to change color scheme globally via CSS variables
- Reduced code duplication (~42 lines saved in initial refactoring)

---

### Admin Component Usage

**When to use `.admin-*` vs page-specific classes**:

✅ **Use `.admin-*` for**:
- Card sections (`.admin-section`)
- Field grids (`.admin-grid`, `.admin-field`)
- Status badges (`.admin-badge`)
- Loading/error states (`.admin-loading`, `.admin-error`)
- Back navigation (`.admin-back`)

✅ **Use page-specific classes for**:
- Form inputs (`.member-edit__input`)
- Page-specific actions (`.member-detail__actions`)
- Unique page elements (`.member-edit__note`)

---

## Related Documentation

- **BEM Methodology**: https://getbem.com/
- **CSS Best Practices**: https://developer.mozilla.org/en-US/docs/Web/CSS
- **Design Team Standards**: (provided by design team)
- **Conversion Script**: `scripts/convert-to-bem.js`
- **Master Code Standards**: [/docs/CODE_STANDARDS_MAP.md](/docs/CODE_STANDARDS_MAP.md)

---

## Summary

### Canonical BEM Structure

```
Block:     .nav, .card, .form, .btn
Element:   .nav__link, .card__title, .form__input
Modifier:  .nav__link--active, .card--welcome, .form__input--monospace
Utility:   .u-hidden, .u-margin-top-md, .u-text-muted
```

### Why This Works

✅ **Clear hierarchy**: Block → Element → Modifier
✅ **No collisions**: `.nav__container` ≠ `.page__container`
✅ **Separate utilities**: `.u-` prefix avoids confusion with `--` variables
✅ **Industry standard**: Works with BEM tooling and linters
✅ **Maintainable**: Easy to understand relationships

---

**Last Updated**: 2025-11-04
**Maintained By**: Frontend team
**Questions**: See #59, #60, #61 in GitHub Issues
