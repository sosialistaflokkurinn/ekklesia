# Election Feature Accessibility Checklist

**Purpose:** Accessibility (WCAG AA) and responsive design requirements
**Part of:** [Election Feature Development Guide](./OVERVIEW.md)
**Last Updated:** 2025-11-24

---

## 📋 Pre-Development Accessibility Planning

### Requirements & Design
- [ ] User story defined and approved
- [ ] UI mockups/wireframes available
- [ ] **Accessibility requirements identified (WCAG AA)**
- [ ] Mobile vs desktop differences noted
- [ ] Error states defined (network failure, validation errors, etc.)
- [ ] Loading states defined (initial load, submission, etc.)
- [ ] Success states defined (confirmation, feedback)

---

## 📱 Responsive Design

### Mobile-First Checklist
- [ ] Page layout works on 320px width (iPhone SE)
- [ ] Touch targets minimum 44x44px (WCAG AAA)
- [ ] Text readable without zooming (16px minimum body text)
- [ ] Modals fit on small screens (use `width: 90%` with `max-width`)
- [ ] Tables/lists scroll horizontally if needed
- [ ] Forms stack vertically on mobile

**CSS Media Query:**
```css
/* Mobile first - base styles */
.element {
  padding: 16px;
}

/* Desktop - enhance */
@media (min-width: 768px) {
  .element {
    padding: 24px;
  }
}
```

---

## ♿ Accessibility (WCAG AA)

### Color Contrast
- [ ] All text meets 4.5:1 contrast ratio (WCAG AA)
- [ ] Large text (18px+) meets 3:1 contrast ratio
- [ ] Use CSS custom properties with good contrast:
  - `--color-gray-800` on `--color-white` ✓
  - `--color-primary-deep` on `--color-primary-pale` ✓
  - `--color-success-green` on `--color-success-bg-light` ✓

**Test with:**
- Chrome DevTools > Lighthouse > Accessibility audit
- Browser extension: axe DevTools

### Keyboard Navigation
- [ ] All interactive elements focusable (buttons, links, inputs)
- [ ] Focus order logical (top to bottom, left to right)
- [ ] Focus visible (outline or ring on focus)
- [ ] Modal can be closed with ESC key
- [ ] Enter key submits forms

### Screen Readers
- [ ] Semantic HTML used (`<button>`, `<nav>`, `<article>`, etc.)
- [ ] Images have `alt` text
- [ ] Form inputs have `<label>` or `aria-label`
- [ ] ARIA roles on complex UI (`role="dialog"`, `aria-modal="true"`)
- [ ] Live regions for dynamic updates (`aria-live="polite"`)

**Example:**
```html
<!-- Good ✓ -->
<button class="modal__close" aria-label="Close">×</button>

<!-- Bad ✗ -->
<div onclick="closeModal()">×</div>
```

---

## 🎨 Typography & Spacing Standards

### Typography Hierarchy

**Election Question (Most Important):**
```css
/* Desktop */
font-size: 1.75rem (28px)
font-weight: 700
color: var(--color-gray-900)

/* Mobile */
font-size: 1.375rem (22px)
```

**Question Label ("SPURNING"):**
```css
font-size: 0.875rem (14px)
font-weight: 600
color: var(--color-gray-600)
text-transform: uppercase
letter-spacing: 0.05em
```

**Section Titles ("Veldu þitt svar"):**
```css
font-size: 1.125rem (18px)
font-weight: 600
color: var(--color-gray-800)
```

**Answer Options (Candidate Names):**
```css
/* Desktop */
font-size: 1.25rem (20px)
font-weight: 600
color: var(--color-gray-900)

/* Mobile */
font-size: 1.125rem (18px)
```

**Rationale:** Creates clear visual hierarchy where the election question and voter choices are most prominent.

### Spacing Between Sections

**Major Section Spacing:**
```css
/* Schedule Display → Voting Form */
margin-bottom: var(--spacing-xl) /* 40px */
margin-top: var(--spacing-xl)    /* 40px */
/* Total: 80px gap */

/* Already Voted Badge → Next Section */
margin-bottom: var(--spacing-lg) /* 24px */
```

**Within Component Spacing:**
```css
/* Question → Voting Options */
margin-bottom: 0              /* Question section */
padding: var(--spacing-sm)    /* Voting section: 8px */
/* Total: 8px gap (tight grouping) */

/* Answer Options Gap */
gap: var(--spacing-md)        /* 16px between options */
```

**Design Principle:** Tight spacing within related content (question + answers), generous spacing between major sections (countdown → question, question → results).

---

## 🧪 Accessibility Testing

### Testing Procedures
- [ ] Tab through all interactive elements
- [ ] Use screen reader (NVDA on Windows, VoiceOver on Mac)
- [ ] Run Lighthouse accessibility audit (score 90+)
- [ ] Check color contrast (all text 4.5:1 minimum)
- [ ] Test on mobile device (touch targets, readability)
- [ ] Test with keyboard only (no mouse)
- [ ] Test with screen magnification (zoom to 200%)

### Screen Reader Testing
- [ ] All buttons announce their purpose
- [ ] Form inputs have clear labels
- [ ] Error messages are announced
- [ ] Dynamic content updates are announced
- [ ] Modal focus is trapped correctly

---

## 📚 Reference

### Testing Tools
- **Color Contrast:** Chrome DevTools > Lighthouse
- **Screen Readers:**
  - NVDA (Windows) - Free
  - VoiceOver (Mac) - Built-in
- **Accessibility Audits:** axe DevTools browser extension
- **Mobile Testing:** Chrome DevTools > Device Mode

### Related Checklists
- [Components](./components-checklist.md) - Component accessibility features
- [Testing](./testing-checklist.md) - Accessibility testing procedures
- [Overview](./OVERVIEW.md) - Back to main guide

---

**Last Updated:** 2025-11-24
**Maintained By:** Development Team
