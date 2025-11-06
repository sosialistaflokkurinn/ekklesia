# Ekklesia HTML Structure Guide

**Last Updated**: 2025-11-04
**Status**: ✅ Active - HTML5 Semantic Standards
**Purpose**: HTML structure, accessibility, and semantic markup guidelines

---

## Overview

This guide defines HTML structure standards for the Ekklesia project. We prioritize semantic HTML5, accessibility (ARIA), and internationalization-ready markup.

### Core Principles

1. **Semantic HTML** - Use elements that describe their meaning (not just appearance)
2. **Accessibility First** - ARIA labels, keyboard navigation, screen reader support
3. **Progressive Enhancement** - Works without JavaScript, enhanced with it
4. **i18n Ready** - All text loaded via `R.string`, never hardcoded
5. **Valid HTML5** - Passes W3C validation

---

## Semantic HTML5 Elements

### Document Structure

Always use semantic elements for document structure:

```html
<!DOCTYPE html>
<html lang="is">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title id="page-title">Loading...</title>

  <!-- Stylesheets -->
  <link rel="stylesheet" href="/styles/global.css">
  <link rel="stylesheet" href="/styles/components/page.css">
</head>
<body class="authenticated">
  <!-- Navigation -->
  <nav class="nav">
    <!-- Navigation content -->
  </nav>

  <!-- Main Content -->
  <main class="page__container">
    <h1 class="page__title" id="page-title-main">Page Title</h1>

    <article class="card">
      <h2 class="card__title">Section Title</h2>
      <!-- Content -->
    </article>
  </main>

  <!-- Scripts -->
  <script type="module" src="/js/page.js"></script>
</body>
</html>
```

**Key Elements**:
- `<nav>` - Navigation menus
- `<main>` - Primary page content (one per page)
- `<article>` - Self-contained content (cards, posts)
- `<section>` - Thematic grouping of content
- `<aside>` - Sidebar or tangential content
- `<header>` - Introductory content
- `<footer>` - Footer content

---

### Heading Hierarchy

Always use proper heading hierarchy (h1 → h2 → h3, never skip levels):

✅ **Good**:
```html
<main>
  <h1>Page Title</h1>

  <article class="card">
    <h2>Section Title</h2>
    <h3>Subsection Title</h3>
  </article>

  <article class="card">
    <h2>Another Section</h2>
  </article>
</main>
```

❌ **Bad** (skips h2):
```html
<main>
  <h1>Page Title</h1>

  <article class="card">
    <h3>Section Title</h3>  <!-- Wrong: jumped from h1 to h3 -->
  </article>
</main>
```

**Why**: Screen readers use heading hierarchy to navigate. Skipping levels confuses assistive technology.

---

### Links vs Buttons

Use `<a>` for navigation, `<button>` for actions:

✅ **Good**:
```html
<!-- Links for navigation -->
<a href="/profile" class="nav__link">Profile</a>
<a href="/dashboard" class="nav__link">Dashboard</a>

<!-- Buttons for actions -->
<button type="button" class="btn" id="btn-save">Save</button>
<button type="submit" class="btn">Submit Form</button>
<button type="button" class="btn" id="btn-logout">Logout</button>
```

❌ **Bad**:
```html
<!-- Don't use <a> for actions -->
<a href="#" class="btn" onclick="save()">Save</a>

<!-- Don't use <button> for navigation -->
<button onclick="location.href='/profile'">Profile</button>
```

**Why**:
- Links navigate to URLs (can be opened in new tab, bookmarked)
- Buttons perform actions (save, delete, open modal)
- Screen readers announce them differently

---

## Forms & Input

### Form Structure

Use proper form structure with labels and validation:

✅ **Good**:
```html
<form id="profile-form">
  <div class="form__group">
    <label for="input-name" class="form__label" id="label-name">Nafn</label>
    <input
      type="text"
      id="input-name"
      name="name"
      class="form__input"
      required
      maxlength="100"
      aria-describedby="error-name"
    />
    <span id="error-name" class="form__error" role="alert"></span>
  </div>

  <div class="form__group">
    <label for="input-email" class="form__label" id="label-email">Netfang</label>
    <input
      type="email"
      id="input-email"
      name="email"
      class="form__input"
      placeholder="nafn@example.is"
      aria-describedby="error-email"
    />
    <span id="error-email" class="form__error" role="alert"></span>
  </div>

  <button type="submit" class="btn" id="btn-submit">Vista</button>
</form>
```

**Key Attributes**:
- `for` - Links label to input (click label focuses input)
- `id` - Required for label linkage and i18n
- `name` - Form field name for submission
- `required` - HTML5 validation
- `maxlength` - Input length limit
- `aria-describedby` - Links error message to input (screen readers)
- `role="alert"` - Announces errors to screen readers

---

### Input Types

Use semantic input types for better mobile UX:

```html
<!-- Text input (default) -->
<input type="text" id="input-name" />

<!-- Email (mobile shows @ key) -->
<input type="email" id="input-email" placeholder="nafn@example.is" />

<!-- Phone (mobile shows number pad) -->
<input type="tel" id="input-phone" placeholder="+354 123 4567" />

<!-- Number (mobile shows number pad) -->
<input type="number" id="input-age" min="18" max="120" />

<!-- Date (mobile shows date picker) -->
<input type="date" id="input-birthdate" />

<!-- Password (hides characters) -->
<input type="password" id="input-password" />

<!-- Checkbox -->
<input type="checkbox" id="input-newsletter" />
<label for="input-newsletter">Skrá mig á póstlista</label>

<!-- Radio buttons -->
<input type="radio" id="input-yes" name="answer" value="yes" />
<label for="input-yes">Já</label>

<input type="radio" id="input-no" name="answer" value="no" />
<label for="input-no">Nei</label>
```

**Why**: Semantic input types provide better mobile keyboard and native validation.

---

### Select Dropdowns

Use `<select>` for dropdowns:

```html
<div class="form__group">
  <label for="input-country" class="form__label" id="label-country">Land</label>
  <select
    id="input-country"
    name="country"
    class="form__select"
    aria-describedby="error-country"
  >
    <option value="">-- Veldu land --</option>
    <option value="IS">Ísland</option>
    <option value="DK">Danmörk</option>
    <option value="NO">Noregur</option>
  </select>
  <span id="error-country" class="form__error" role="alert"></span>
</div>
```

**Best Practices**:
- Always include empty "choose" option
- Use semantic values (ISO codes, not display names)
- Add `aria-describedby` for error messages

---

## Accessibility (ARIA)

### ARIA Labels

Use ARIA labels for interactive elements without visible text:

```html
<!-- Button with icon only (no text) -->
<button
  type="button"
  class="nav__hamburger"
  id="nav-hamburger"
  aria-label="Opna valmynd"
  aria-expanded="false"
>
  <span class="nav__hamburger-line"></span>
  <span class="nav__hamburger-line"></span>
  <span class="nav__hamburger-line"></span>
</button>

<!-- Close button with icon -->
<button
  type="button"
  class="modal__close"
  aria-label="Loka glugga"
>
  <span class="modal__close-icon">✕</span>
</button>
```

**When to use**:
- Buttons with icons only (no text)
- Interactive elements without visible labels
- Custom controls (sliders, toggles)

---

### ARIA Live Regions

Use `role="alert"` or `aria-live` for dynamic content:

```html
<!-- Error messages (announced immediately) -->
<div id="error-message" class="u-text-error" role="alert">
  Villa kom upp
</div>

<!-- Status messages (announced politely) -->
<div id="status-message" aria-live="polite" aria-atomic="true">
  Vistað!
</div>

<!-- Loading state (announced immediately) -->
<div id="loading-status" role="status" aria-live="assertive">
  Hleð gögnum...
</div>
```

**Roles**:
- `role="alert"` - Important errors (announced immediately)
- `aria-live="polite"` - Non-urgent updates (announced when user pauses)
- `aria-live="assertive"` - Urgent updates (interrupts screen reader)
- `role="status"` - Status updates (loading, saving)

---

### ARIA Expanded State

Use `aria-expanded` for collapsible content:

```html
<!-- Collapsible phone numbers section -->
<div class="info-grid__item">
  <div
    class="info-grid__label info-grid__label--clickable"
    id="label-phone-numbers"
    tabindex="0"
    role="button"
    aria-expanded="false"
    aria-controls="phone-numbers-section"
  >
    Símanúmer
    <span class="expand-icon" aria-hidden="true">▼</span>
  </div>

  <div class="info-grid__value" id="value-phone-simple">+354 123 4567</div>
</div>

<!-- Expanded section (initially hidden) -->
<div
  id="phone-numbers-section"
  class="phone-numbers-section"
  style="display: none;"
  aria-hidden="true"
>
  <!-- Phone numbers list -->
</div>
```

**JavaScript** (toggle state):
```javascript
label.addEventListener('click', () => {
  const expanded = label.getAttribute('aria-expanded') === 'true';
  label.setAttribute('aria-expanded', !expanded);
  section.setAttribute('aria-hidden', expanded);
  section.style.display = expanded ? 'none' : 'block';
});
```

**Why**: Screen readers announce "collapsed" or "expanded" state to users.

---

### Keyboard Navigation

Make interactive elements keyboard-accessible:

```html
<!-- Clickable div needs tabindex and role -->
<div
  class="info-grid__label info-grid__label--clickable"
  tabindex="0"
  role="button"
  aria-expanded="false"
>
  Símanúmer
</div>
```

**JavaScript** (handle keyboard):
```javascript
element.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    element.click(); // Trigger click handler
  }
});
```

**Rules**:
- Native buttons/links are keyboard-accessible by default
- Custom interactive elements need `tabindex="0"` and `role`
- Handle Enter and Space keys

---

## Internationalization (i18n)

### ID Attributes for Strings

All user-facing text must have `id` attributes for i18n:

✅ **Good** (i18n-ready):
```html
<h1 id="page-title">Loading...</h1>
<button id="btn-save" class="btn">Loading...</button>
<label id="label-name" class="form__label">Loading...</label>
```

**JavaScript** (populate with i18n strings):
```javascript
import { R } from '/i18n/strings-loader.js';
await R.load('is');

document.getElementById('page-title').textContent = R.string.page_title;
document.getElementById('btn-save').textContent = R.string.btn_save;
document.getElementById('label-name').textContent = R.string.label_name;
```

❌ **Bad** (hardcoded):
```html
<h1>Félagakerfi</h1>  <!-- Hardcoded Icelandic text -->
<button class="btn">Vista</button>  <!-- Not translatable -->
```

**Why**: All text must be translatable. Use `R.string` pattern for all languages.

---

### Placeholder Text

Placeholder text should also use i18n:

```html
<input
  type="email"
  id="input-email"
  placeholder=""  <!-- Empty initially -->
/>
```

**JavaScript**:
```javascript
document.getElementById('input-email').placeholder = R.string.placeholder_email;
// Result: "nafn@example.is"
```

---

## Common Patterns

### Status Feedback Pattern

Pattern for editable fields with visual feedback:

```html
<div class="profile-field">
  <input
    type="text"
    id="input-name"
    class="profile-field__input"
  />
  <span class="profile-field__status" id="status-name"></span>
  <span class="profile-field__error" id="error-name"></span>
</div>
```

**CSS States**:
```css
.profile-field__status {
  display: inline-flex;
  width: 20px;
  height: 20px;
}

/* Hidden by default */
.profile-field__status:empty {
  display: none;
}

/* Loading spinner */
.profile-field__status--loading {
  display: inline-flex !important;
}

.profile-field__status--loading::after {
  content: "";
  display: block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-gray-300);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

/* Success checkmark */
.profile-field__status--success {
  display: inline-flex !important;
}

.profile-field__status--success::after {
  content: "✓";
  color: var(--color-success);
  font-size: 18px;
  font-weight: bold;
}

/* Error icon */
.profile-field__status--error {
  display: inline-flex !important;
}

.profile-field__status--error::after {
  content: "✕";
  color: var(--color-error);
  font-size: 16px;
  font-weight: bold;
}
```

**JavaScript** (usage):
```javascript
// Show loading spinner
statusIcon.className = 'profile-field__status profile-field__status--loading';

// Save data
await saveField();

// Show success checkmark
statusIcon.className = 'profile-field__status profile-field__status--success';

// Auto-clear after 2 seconds
setTimeout(() => {
  statusIcon.className = 'profile-field__status';
}, 2000);
```

---

### Collapsible Section Pattern

Pattern for collapsible sections (phone numbers, addresses):

```html
<!-- Trigger (grid item) -->
<div class="info-grid__item">
  <div
    class="info-grid__label info-grid__label--clickable"
    id="label-phone-numbers"
    tabindex="0"
    role="button"
    aria-expanded="false"
    aria-controls="phone-numbers-section"
  >
    <span id="label-phone-numbers-text">Símanúmer</span>
    <span class="expand-icon" id="phone-expand-icon" aria-hidden="true">▼</span>
  </div>

  <!-- Simple view (collapsed state) -->
  <div class="info-grid__value" id="value-phone-simple">+354 123 4567</div>
</div>

<!-- Expanded section (full width below grid) -->
<div
  id="phone-numbers-section"
  class="phone-numbers-section"
  style="display: none;"
  aria-hidden="true"
>
  <!-- Detailed content here -->
</div>
```

**JavaScript** (toggle):
```javascript
const label = document.getElementById('label-phone-numbers');
const section = document.getElementById('phone-numbers-section');
const icon = document.getElementById('phone-expand-icon');

label.addEventListener('click', () => {
  const expanded = label.getAttribute('aria-expanded') === 'true';

  // Toggle state
  label.setAttribute('aria-expanded', !expanded);
  section.setAttribute('aria-hidden', expanded);
  section.style.display = expanded ? 'none' : 'block';

  // Toggle icon
  icon.textContent = expanded ? '▼' : '▲';
});

// Keyboard support
label.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    label.click();
  }
});
```

---

### Modal Pattern

Pattern for modal dialogs:

```html
<div class="modal" id="modal-confirm" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <div class="modal__overlay" id="modal-overlay"></div>

  <div class="modal__content">
    <h2 class="modal__title" id="modal-title">Staðfesta aðgerð</h2>
    <p class="modal__desc" id="modal-desc">Ertu viss um að þú viljir eyða þessu?</p>

    <div class="modal__actions">
      <button type="button" class="btn btn--secondary" id="modal-cancel">Hætta við</button>
      <button type="button" class="btn btn--danger" id="modal-confirm-btn">Eyða</button>
    </div>
  </div>
</div>
```

**JavaScript** (show/hide):
```javascript
const modal = document.getElementById('modal-confirm');
const overlay = document.getElementById('modal-overlay');
const cancelBtn = document.getElementById('modal-cancel');

// Show modal
function showModal() {
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden'; // Prevent scroll

  // Focus first button
  document.getElementById('modal-cancel').focus();
}

// Hide modal
function hideModal() {
  modal.style.display = 'none';
  document.body.style.overflow = ''; // Restore scroll
}

// Close on overlay click
overlay.addEventListener('click', hideModal);

// Close on cancel
cancelBtn.addEventListener('click', hideModal);

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.style.display === 'block') {
    hideModal();
  }
});
```

**Accessibility**:
- `role="dialog"` - Announces as dialog
- `aria-modal="true"` - Indicates modal behavior
- `aria-labelledby` - Links to title
- Focus management (focus first button on open)
- Escape key closes modal
- Body scroll disabled when open

---

## Best Practices

### ✅ Do

- Use semantic HTML5 elements (`<nav>`, `<main>`, `<article>`)
- Include `alt` text on all images
- Use proper heading hierarchy (h1 → h2 → h3)
- Link labels to inputs with `for` attribute
- Add ARIA labels to icon-only buttons
- Use `role="alert"` for error messages
- Make custom controls keyboard-accessible
- Test with screen reader (VoiceOver, NVDA)
- Use `id` attributes for all user-facing text (i18n)

### ❌ Don't

- Use `<div>` and `<span>` for everything (not semantic)
- Skip heading levels (h1 → h3)
- Use `<a>` for actions (use `<button>`)
- Forget `alt` text on images
- Use placeholder as label (inaccessible)
- Hardcode user-facing text (not translatable)
- Use inline styles (breaks CSS separation)
- Forget keyboard navigation

---

## Common Mistakes

### Mistake 1: Placeholder as Label

❌ **Bad**:
```html
<input type="text" placeholder="Nafn" />  <!-- No label -->
```

✅ **Good**:
```html
<label for="input-name" id="label-name">Nafn</label>
<input
  type="text"
  id="input-name"
  placeholder="T.d. Jón Jónsson"
/>
```

**Why**: Placeholders disappear when user types. Screen readers need labels.

---

### Mistake 2: Non-semantic Buttons

❌ **Bad**:
```html
<div class="btn" onclick="save()">Vista</div>
```

✅ **Good**:
```html
<button type="button" class="btn" id="btn-save">Vista</button>
```

**Why**: `<div>` is not keyboard-accessible or announced as button by screen readers.

---

### Mistake 3: Missing ARIA States

❌ **Bad**:
```html
<div class="collapsible-trigger" onclick="toggle()">
  Show more
</div>
```

✅ **Good**:
```html
<div
  class="collapsible-trigger"
  tabindex="0"
  role="button"
  aria-expanded="false"
  aria-controls="collapsible-content"
  onclick="toggle()"
>
  Show more
</div>
```

**Why**: Screen readers need to know if content is expanded or collapsed.

---

### Mistake 4: Hardcoded Text

❌ **Bad**:
```html
<h1>Félagakerfi</h1>
<button class="btn">Vista</button>
```

✅ **Good**:
```html
<h1 id="page-title">Loading...</h1>
<button class="btn" id="btn-save">Loading...</button>

<script type="module">
import { R } from '/i18n/strings-loader.js';
await R.load('is');

document.getElementById('page-title').textContent = R.string.page_title;
document.getElementById('btn-save').textContent = R.string.btn_save;
</script>
```

**Why**: All text must be translatable. Hardcoded text prevents internationalization.

---

## Validation

### W3C Validation

All HTML should pass W3C validation:

**Validator**: https://validator.w3.org/

**Common Errors to Avoid**:
- Missing `alt` attribute on images
- Duplicate `id` attributes
- Invalid nesting (e.g., `<p>` inside `<p>`)
- Missing closing tags
- Incorrect attribute values

---

### Accessibility Checklist

Before merging code, verify:

- [ ] All images have `alt` text
- [ ] Heading hierarchy is correct (h1 → h2 → h3)
- [ ] Forms have labels linked with `for`
- [ ] Icon-only buttons have `aria-label`
- [ ] Interactive elements are keyboard-accessible
- [ ] Error messages use `role="alert"`
- [ ] Collapsible sections have `aria-expanded`
- [ ] Modals have `role="dialog"` and `aria-modal="true"`
- [ ] All user-facing text has `id` for i18n
- [ ] Tested with keyboard navigation (Tab, Enter, Space, Escape)

---

## Related Documentation

- **CSS & BEM Guide**: [/docs/standards/CSS_BEM_GUIDE.md](/docs/standards/CSS_BEM_GUIDE.md)
- **JavaScript Guide**: [/docs/standards/JAVASCRIPT_GUIDE.md](/docs/standards/JAVASCRIPT_GUIDE.md)
- **i18n Guide**: [/docs/standards/I18N_GUIDE.md](/docs/standards/I18N_GUIDE.md)
- **Master Code Standards**: [/docs/CODE_STANDARDS.md](/docs/CODE_STANDARDS.md)

**External Resources**:
- **ARIA Authoring Practices**: https://www.w3.org/WAI/ARIA/apg/
- **MDN HTML Guide**: https://developer.mozilla.org/en-US/docs/Web/HTML
- **WebAIM Screen Reader Guide**: https://webaim.org/articles/screenreader_testing/

---

**Last Updated**: 2025-11-04
**Maintained By**: Frontend team
**Status**: ✅ Active - Required for all HTML markup
