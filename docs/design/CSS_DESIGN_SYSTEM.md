# Ekklesia CSS Design System

**Last Updated**: 2025-10-16
**Status**: ✅ Active - Follows design team standards
**Methodology**: BEM with `--name` prefix for utilities

---

## Overview

This document describes the CSS design system for the Ekklesia Members Service, including all utility classes, component patterns, and CSS best practices.

### Design Standards Compliance

✅ **BEM methodology** - All classes use BEM naming
✅ **`--name` prefix** - Utility classes use `--` prefix
✅ **Skip base** - Use `--header` instead of `.nav__header`
✅ **CSS variables** - Colors, spacing, radius, etc.
✅ **No inline styles** - 100% compliant
✅ **No Tailwind CSS** - Pure CSS only
✅ **Grouped files** - Organized by components

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

### State Classes

#### `--clickable`
Makes an element appear clickable (removes underline, adds pointer cursor).

**Usage**: Links styled as cards or buttons
```html
<a href="/profile" class="--info-item --clickable">
  <div class="--info-label">My Profile</div>
  <div class="--info-value">View and edit</div>
</a>
```

**CSS**:
```css
.--clickable {
  text-decoration: none;
  cursor: pointer;
}
```

#### `--disabled`
Disabled/inactive state (50% opacity).

**Usage**: Disabled menu items, coming soon features
```html
<div class="--info-item --disabled">
  <div class="--info-label">Voting</div>
  <div class="--info-value">Coming soon</div>
</div>
```

**CSS**:
```css
.--disabled {
  opacity: 0.5;
}
```

#### `--hidden`
Hides element completely (`display: none`).

**Usage**: Conditionally shown elements (controlled by JavaScript)
```html
<div id="error-message" class="--text-error --margin-top-md --hidden">
  <!-- JavaScript will remove --hidden class to show -->
</div>
```

**CSS**:
```css
.--hidden {
  display: none;
}
```

---

### Spacing Utilities

#### Margin Top
- `--margin-top-sm` - 8px top margin
- `--margin-top-md` - 16px top margin

**Usage**: Add spacing above elements
```html
<p class="--text-muted --margin-top-sm">Helper text</p>
<div class="--margin-top-md">Content with more space</div>
```

#### Margin Bottom
- `--margin-bottom-xs` - 4px bottom margin
- `--margin-bottom-sm` - 8px bottom margin
- `--margin-bottom-md` - 16px bottom margin

**Usage**: Add spacing below elements
```html
<h2 class="--margin-bottom-md">Section Title</h2>
```

**CSS**:
```css
.--margin-top-sm { margin-top: var(--spacing-sm); }
.--margin-top-md { margin-top: var(--spacing-md); }
.--margin-bottom-xs { margin-bottom: var(--spacing-xs); }
.--margin-bottom-sm { margin-bottom: var(--spacing-sm); }
.--margin-bottom-md { margin-bottom: var(--spacing-md); }
```

---

### Text Utilities

#### `--text-muted`
Muted text color (gray, 14px font size).

**Usage**: Helper text, descriptions, secondary information
```html
<p class="--text-muted">
  This is helper text that explains the feature
</p>
```

**CSS**:
```css
.--text-muted {
  color: var(--color-gray-500);
  font-size: 14px;
}
```

#### `--text-error`
Error text color (orange/red).

**Usage**: Error messages, validation feedback
```html
<div class="--text-error --margin-top-md">
  Invalid input - please try again
</div>
```

**CSS**:
```css
.--text-error {
  color: var(--color-error-text);
}
```

---

## Component Classes

### Navigation (`nav.css`)

#### Structure
```html
<nav class="--header">
  <div class="--container">
    <a href="/" class="--brand">Brand Name</a>
    <div class="--links">
      <a href="/dashboard" class="--link active">Dashboard</a>
      <a href="/profile" class="--link">Profile</a>
      <a href="#" class="--link --link--logout">Logout</a>
    </div>
  </div>
</nav>
```

#### Classes
- `--header` - Navigation wrapper (red background)
- `--container` - Max-width container with flex layout
- `--brand` - Brand/logo link
- `--links` - Links container (flex layout)
- `--link` - Individual link
- `.active` - Active page indicator (applied to `--link`)
- `--link--logout` - Logout button modifier

---

### Cards (`page.css`)

#### Structure
```html
<div class="--card">
  <h3 class="--card__title">Card Title</h3>
  <div class="--card__content">
    Card content goes here
  </div>
</div>
```

#### Modifier: Welcome Card
```html
<div class="--card --card--welcome">
  <h2 class="--card__title">Welcome!</h2>
  <p class="--card__content">Welcome message</p>
</div>
```

#### Classes
- `--card` - Base card component (white background, shadow)
- `--card__title` - Card title (20px, bold)
- `--card__content` - Card content area
- `--card--welcome` - Red gradient modifier for welcome cards

---

### Info Grid (`page.css`)

Display user information in a responsive grid layout.

#### Structure
```html
<div class="--info-grid">
  <div class="--info-item">
    <div class="--info-label">Email</div>
    <div class="--info-value">user@example.com</div>
  </div>
  <div class="--info-item">
    <div class="--info-label">Member Since</div>
    <div class="--info-value">January 2025</div>
  </div>
</div>
```

#### Classes
- `--info-grid` - Responsive grid container (auto-fit, 250px minimum)
- `--info-item` - Individual info item (gray background, rounded)
- `--info-label` - Label (uppercase, gray, 12px)
- `--info-value` - Value (dark, 16px, bold)

---

### Buttons (`login.css`)

#### Structure
```html
<button class="--btn">Primary Button</button>
<button class="--btn secondary">Secondary Button</button>
<button class="--btn" disabled>Disabled Button</button>
```

#### Classes
- `--btn` - Base button (red background, white text)
- `.secondary` - Secondary button modifier (orange background)
- `:disabled` - Disabled state (gray background, no pointer)

**CSS**:
```css
.--btn {
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

.--btn:hover {
  background: var(--color-primary-dark);
}

.--btn.secondary {
  background: var(--color-error-border);
}
```

---

### Status Indicators (`login.css`)

#### Structure
```html
<div class="--status authenticated">
  <span>Authenticated as user@example.com</span>
</div>

<div class="--status not-authenticated">
  <span>Please log in</span>
</div>

<div class="--status authenticating">
  <span>Authenticating...</span>
</div>
```

#### Classes
- `--status` - Base status indicator (padding, rounded, border-left)
- `.authenticated` - Green background (success)
- `.not-authenticated` - Orange background (error)
- `.authenticating` - Blue background (info)
- `.error` - Error state

---

### Forms (`events-test.css`)

#### Structure
```html
<div class="--form-group">
  <label class="--form-label">Input Label</label>
  <input type="text" class="--form-input" placeholder="Enter value">
</div>

<div class="--form-group">
  <label class="--form-label">Monospace Input</label>
  <input type="text" class="--form-input --form-input--monospace" placeholder="Token">
</div>

<div class="--form-group">
  <label class="--form-label">Select Option</label>
  <select class="--form-select">
    <option>Option 1</option>
    <option>Option 2</option>
  </select>
</div>
```

#### Classes
- `--form-group` - Form field wrapper (margin-bottom: 10px)
- `--form-label` - Label (display: block, bold)
- `--form-input` - Text input (full width, padding, border)
- `--form-input--monospace` - Monospace font modifier
- `--form-select` - Select dropdown (same styling as input)

---

## Layout Patterns

### Login Page
```html
<body>
  <div class="--container">
    <h1>Title</h1>
    <p class="--subtitle">Subtitle</p>

    <div class="--status not-authenticated">
      <span>Not authenticated</span>
    </div>

    <button class="--btn">Login</button>
  </div>
</body>
```

**Layout**: Centered container with gradient background

---

### Authenticated Pages
```html
<body class="authenticated">
  <nav class="--header">
    <!-- Navigation -->
  </nav>

  <div class="--page-container">
    <div class="--page-header">
      <h1 class="--page-title">Page Title</h1>
      <p class="--page-subtitle">Page subtitle</p>
    </div>

    <div class="--card">
      <!-- Card content -->
    </div>
  </div>
</body>
```

**Layout**: Navigation bar + max-width content area with gray background

---

## Best Practices

### When to Use Utility Classes
✅ **Use utilities for**:
- Spacing adjustments (`--margin-top-md`)
- State variations (`--hidden`, `--disabled`)
- Text styles (`--text-muted`, `--text-error`)
- Simple interactions (`--clickable`)

❌ **Don't use utilities for**:
- Complex components (create component class instead)
- Multiple styles together (create semantic class)
- Repeated patterns (extract to component)

### When to Create New Components
Create a new component class when:
1. Pattern is used in 3+ places
2. Multiple utilities always used together
3. Component has semantic meaning (e.g., `--user-badge`)
4. Styling is complex (3+ CSS properties)

### Naming Conventions
- **Utility classes**: `--name` (e.g., `--hidden`, `--clickable`)
- **Component blocks**: `--name` (e.g., `--card`, `--btn`)
- **Component elements**: `--block__element` (e.g., `--card__title`)
- **Component modifiers**: `--block--modifier` (e.g., `--card--welcome`)
- **State classes**: plain name (e.g., `.active`, `.authenticated`)

### File Organization
```
styles/
├── global.css              # Variables, reset, utilities
└── components/
    ├── nav.css             # Navigation component
    ├── page.css            # Page layouts, cards, info grids
    ├── login.css           # Login page components
    └── events-test.css     # Test page components, forms
```

---

## Migration from Old Naming

### Old → New Mapping

**Utility classes**:
- `.clickable` → `--clickable`
- `.hidden` → `--hidden`
- `.margin-top-md` → `--margin-top-md`

**Navigation**:
- `.nav-header` → `--header`
- `.nav-link` → `--link`
- `.nav-link.active` → `--link.active`

**Cards**:
- `.card` → `--card`
- `.card-title` → `--card__title`
- `.welcome-card` → `--card--welcome`

**Forms**:
- `.form-group` → `--form-group`
- `.form-input` → `--form-input`

**See**: `scripts/convert-to-bem.js` for complete conversion mapping

---

## Related Documentation

- Design Team Standards: (provided by design team)
- BEM Methodology: https://getbem.com/
- CSS Best Practices: https://developer.mozilla.org/en-US/docs/Web/CSS

---

**Last Updated**: 2025-10-16
**Maintained By**: Frontend team
**Questions**: See #59, #60, #61 in GitHub Issues
