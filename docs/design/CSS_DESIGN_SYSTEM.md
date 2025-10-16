# Ekklesia CSS Design System

**Last Updated**: 2025-10-16
**Status**: ✅ Active - Canonical BEM Methodology
**Naming**: Industry-standard BEM (Block Element Modifier)

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

## CSS Variables

### Colors

#### Primary Colors (Socialist Red)
```css
--color-primary: #d32f2f        /* Main brand red */
--color-primary-dark: #b71c1c   /* Darker red for hover states */
```

#### Status Colors
```css
/* Success (Green) */
--color-success-bg: #c6f6d5
--color-success-text: #22543d
--color-success-border: #38a169
--color-success: #48bb78

/* Error (Orange - for contrast with red primary) */
--color-error-bg: #fff3e0
--color-error-text: #e65100
--color-error-border: #ff6f00
--color-error: #ff9800

/* Info (Blue) */
--color-info-bg: #ebf8ff
--color-info-text: #2c5282
--color-info-border: #3182ce
--color-info: #63b3ed
```

#### Neutral Colors (Gray Scale)
```css
--color-gray-50: #f7fafc   /* Lightest */
--color-gray-100: #edf2f7
--color-gray-200: #e2e8f0
--color-gray-300: #cbd5e0
--color-gray-400: #a0aec0
--color-gray-500: #718096  /* Mid gray */
--color-gray-600: #4a5568
--color-gray-700: #2d3748
--color-gray-800: #1a202c  /* Text color */
--color-gray-900: #171923  /* Darkest */
```

### Spacing
```css
--spacing-xs: 4px    /* Extra small */
--spacing-sm: 8px    /* Small */
--spacing-md: 16px   /* Medium (default) */
--spacing-lg: 24px   /* Large */
--spacing-xl: 40px   /* Extra large */
```

### Border Radius
```css
--radius-sm: 4px     /* Small - buttons, inputs */
--radius-md: 6px     /* Medium */
--radius-lg: 8px     /* Large - cards */
--radius-xl: 12px    /* Extra large - containers */
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
**Modifiers**: `.btn--secondary`

#### Structure
```html
<button class="btn">Primary Button</button>
<button class="btn btn--secondary">Secondary Button</button>
<button class="btn" disabled>Disabled Button</button>
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

## Related Documentation

- **BEM Methodology**: https://getbem.com/
- **CSS Best Practices**: https://developer.mozilla.org/en-US/docs/Web/CSS
- **Design Team Standards**: (provided by design team)
- **Conversion Script**: `scripts/convert-to-bem.js`

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

**Last Updated**: 2025-10-16
**Maintained By**: Frontend team
**Questions**: See #59, #60, #61 in GitHub Issues
