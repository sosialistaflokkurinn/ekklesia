# Component Factory Patterns

This document defines the standard patterns for JavaScript component factories in the Members Portal.

**Last Updated**: 2025-11-13 (Issue #274)

---

## Table of Contents

1. [Component Factory Pattern](#component-factory-pattern)
2. [Return Value Structure](#return-value-structure)
3. [Component Types](#component-types)
4. [Pattern Examples](#pattern-examples)
5. [Utility Module Exception](#utility-module-exception)
6. [Migration Guide](#migration-guide)
7. [Code Quality Checks](#code-quality-checks)

---

## Component Factory Pattern

All component factory functions should follow a **consistent API pattern** for predictability and maintainability.

### ✅ Standard Pattern

Component factories return an **object** with:
- `element` property - The root HTMLElement
- Methods for component operations (show, hide, destroy, etc.)

```javascript
export function createComponent(options = {}) {
  // Create DOM structure
  const container = document.createElement('div');
  container.className = 'component';

  // Add component logic
  // ...

  // Return API object
  return {
    element: container,

    // Component methods
    show: () => {
      container.classList.remove('component--hidden');
    },

    hide: () => {
      container.classList.add('component--hidden');
    },

    destroy: () => {
      container.remove();
    }
  };
}
```

### ❌ Deprecated Pattern

Do NOT return raw HTMLElements directly:

```javascript
// ❌ BAD - Returns raw element
export function createComponent(options = {}) {
  const container = document.createElement('div');
  return container;  // No API object!
}
```

---

## Return Value Structure

### Required Properties

All component factories MUST return an object with:

- **`element`** (HTMLElement) - The root DOM element
  - Always present
  - Read-only (conceptually)
  - Used for mounting/inserting into DOM

### Recommended Methods

Component factories SHOULD include these methods when applicable:

- **`destroy()`** - Remove component from DOM and clean up event listeners
- **`show()`** / **`hide()`** - Toggle visibility
- **`update(data)`** - Update component state
- **`setContent(content)`** - Update content dynamically
- **`on(event, handler)`** - Event subscription (for complex components)

### Example Return Structure

```javascript
return {
  // Required
  element: container,

  // Optional - include what makes sense for your component
  destroy: () => { /* cleanup */ },
  show: () => { /* show logic */ },
  hide: () => { /* hide logic */ },
  update: (data) => { /* update logic */ },
  setContent: (content) => { /* content logic */ },
};
```

---

## Component Types

### 1. Factory Functions (Standard Pattern)

Functions that create and return component instances.

**Naming Convention**: `create*()` or `show*()`

**Examples**:
- `createCard()` - apps/members-portal/js/components/card.js:12
- `createLoadingState()` - apps/members-portal/js/components/loading-state.js:15
- `createErrorState()` - apps/members-portal/js/components/error-state.js:17
- `showToast()` - apps/members-portal/js/components/toast.js:17

```javascript
// Usage
import { createCard } from './components/card.js';

const card = createCard({
  title: 'My Card',
  content: '<p>Card content</p>'
});

document.body.appendChild(card.element);

// Later...
card.setTitle('Updated Title');
card.destroy();
```

### 2. ES6 Classes (Alternative Pattern)

Class-based components with constructor and methods.

**Naming Convention**: PascalCase class name

**Examples**:
- `SearchableSelect` - apps/members-portal/js/components/searchable-select.js:21

```javascript
// Usage
import { SearchableSelect } from './components/searchable-select.js';

const selector = new SearchableSelect({
  options: [...],
  onSelect: (value) => { /* ... */ }
});

document.body.appendChild(selector.element);

// Later...
selector.updateOptions([...]);
selector.destroy();
```

**Pattern Consistency**: Classes should provide an `element` getter for consistency:

```javascript
class MyComponent {
  constructor(options) {
    this.container = document.createElement('div');
    // ...
  }

  /**
   * Get the root element (for consistency with factory pattern)
   */
  get element() {
    return this.container;
  }

  destroy() {
    this.container.remove();
  }
}
```

### 3. Utility Modules (Exception)

Collections of utility functions that operate on elements.

**Naming Convention**: Descriptive function names (not `create*`)

**Examples**:
- `status.js` - Multiple functions: `showStatus()`, `createStatusIcon()`, `showLoading()`, etc.

**Why Exception?**: Designed for **functional composition** rather than encapsulation.

```javascript
// Usage (functional pattern)
import { createStatusIcon, showStatus } from './components/status.js';

const statusIcon = createStatusIcon();  // Returns raw HTMLElement
container.appendChild(statusIcon);

showStatus(statusIcon, 'loading');  // Operates on element
// ...
showStatus(statusIcon, 'success');
```

**When to Use Utility Pattern**:
- Lightweight, stateless operations
- Functions operate on elements passed to them
- Designed for composition (mix and match functions)
- Multiple small functions that work together

**When to Use Component Pattern**:
- Encapsulated state and behavior
- Complex lifecycle (mount, update, destroy)
- Multiple coordinated methods
- Component instances need to be managed

---

## Pattern Examples

### Example 1: Toast Notifications

**File**: apps/members-portal/js/components/toast.js:17

```javascript
export function showToast(message, type = 'info', options = {}) {
  const { duration = 3000, dismissible = true } = options;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;

  let hideTimeout = null;

  const hideToast = (toastEl) => {
    toastEl.classList.add('toast--hiding');
    setTimeout(() => toastEl.remove(), 300);
  };

  if (dismissible) {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast__close';
    closeBtn.onclick = () => hideToast(toast);
    toast.appendChild(closeBtn);
  }

  document.body.appendChild(toast);

  if (duration > 0) {
    hideTimeout = setTimeout(() => hideToast(toast), duration);
  }

  // Return API object with element and methods
  return {
    element: toast,

    hide: () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      hideToast(toast);
    },

    destroy: () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      hideToast(toast);
    }
  };
}
```

**Usage**:
```javascript
const toast = showToast('Operation successful!', 'success');

// Manually hide if needed
toast.hide();
```

### Example 2: Card Component

**File**: apps/members-portal/js/components/card.js:12

```javascript
export function createCard(options = {}) {
  const {
    title = '',
    content = '',
    variant = 'default',
    padding = 'md',
  } = options;

  const card = document.createElement('div');
  card.className = `card card--${variant} card--padding-${padding}`;

  let titleEl = null;
  if (title) {
    const header = document.createElement('div');
    header.className = 'card__header';

    titleEl = document.createElement('h3');
    titleEl.className = 'card__title';
    titleEl.textContent = title;

    header.appendChild(titleEl);
    card.appendChild(header);
  }

  const contentEl = document.createElement('div');
  contentEl.className = 'card__content';

  if (typeof content === 'string') {
    contentEl.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    contentEl.appendChild(content);
  }

  card.appendChild(contentEl);

  // Return API object
  return {
    element: card,

    setTitle: (newTitle) => {
      if (!titleEl) {
        titleEl = document.createElement('h3');
        titleEl.className = 'card__title';
        const header = card.querySelector('.card__header') || (() => {
          const h = document.createElement('div');
          h.className = 'card__header';
          card.insertBefore(h, card.firstChild);
          return h;
        })();
        header.insertBefore(titleEl, header.firstChild);
      }
      titleEl.textContent = newTitle;
    },

    setContent: (newContent) => {
      contentEl.innerHTML = '';
      if (typeof newContent === 'string') {
        contentEl.innerHTML = newContent;
      } else if (newContent instanceof HTMLElement) {
        contentEl.appendChild(newContent);
      }
    },

    destroy: () => {
      card.remove();
    }
  };
}
```

**Usage**:
```javascript
const card = createCard({
  title: 'Policy #123',
  content: '<p>Description...</p>',
  variant: 'elevated',
  padding: 'lg'
});

container.appendChild(card.element);

// Update dynamically
card.setTitle('Policy #123 - Approved');
card.setContent('<p>Updated description...</p>');

// Remove
card.destroy();
```

### Example 3: SearchableSelect Class

**File**: apps/members-portal/js/components/searchable-select.js:21

```javascript
export class SearchableSelect {
  constructor(options = {}) {
    this.options = options.options || [];
    this.placeholder = options.placeholder || 'Select...';
    this.onSelect = options.onSelect || (() => {});

    this.wrapper = document.createElement('div');
    this.wrapper.className = 'searchable-select';

    // Build component...
    this.render();
  }

  /**
   * Get the wrapper element (for consistency with component factory pattern)
   * @returns {HTMLElement} The wrapper element
   */
  get element() {
    return this.wrapper;
  }

  render() {
    // Render logic...
  }

  updateOptions(newOptions) {
    this.options = newOptions;
    this.render();
  }

  destroy() {
    this.wrapper.remove();
  }
}
```

**Usage**:
```javascript
const selector = new SearchableSelect({
  options: [
    { value: 'is', label: 'Iceland' },
    { value: 'no', label: 'Norway' }
  ],
  placeholder: 'Select country...',
  onSelect: (value) => {
    console.log('Selected:', value);
  }
});

container.appendChild(selector.element);

// Update options
selector.updateOptions([...]);

// Remove
selector.destroy();
```

---

## Utility Module Exception

### Status.js - Functional Utility Module

**File**: apps/members-portal/js/components/status.js

This module is an **intentional exception** to the component factory pattern because it follows **functional programming principles**.

**Why Utility Pattern is Better Here**:

1. **Separation of concerns**: Icon creation vs. state management
2. **Functional composition**: Pure functions that operate on elements
3. **No unnecessary coupling**: Don't need to bundle methods with every icon instance
4. **Flexible**: Can use `showStatus()` on ANY element, not just factory-created icons
5. **Memory efficient**: No method references stored on every icon instance

**Utility Functions**:
- `createStatusIcon(options)` - Creates status indicator element (returns raw HTMLElement)
- `showStatus(element, state, options)` - Updates element state
- `showLoading(element, options)` - Convenience wrapper
- `showSuccess(element, options)` - Convenience wrapper
- `showError(element, options)` - Convenience wrapper
- `clearStatus(element, options)` - Convenience wrapper
- `toggleButtonLoading(button, loading, options)` - Button-specific utility

**Usage Pattern**:
```javascript
import { createStatusIcon, showStatus } from './components/status.js';

// Create icon once
const statusIcon = createStatusIcon();
container.appendChild(statusIcon);

// Use multiple times with different states
showStatus(statusIcon, 'loading');
await doSomething();
showStatus(statusIcon, 'success');
```

**When to Use Utility Pattern**:
- Lightweight status indicators
- Stateless operations on elements
- Functions designed for composition
- Multiple small functions working together

**When NOT to Use Utility Pattern**:
- Complex lifecycle management
- Encapsulated state and behavior
- Multiple coordinated methods
- Component instances need cleanup/teardown

---

## Migration Guide

### Migrating from Raw Element Returns

If you have a component factory returning raw elements:

```javascript
// ❌ OLD PATTERN
export function createMyComponent(options = {}) {
  const container = document.createElement('div');
  // ... setup ...
  return container;
}
```

**Step 1**: Identify usage patterns
```bash
# Find all callsites
grep -rn "createMyComponent" apps/members-portal/
```

**Step 2**: Refactor to return API object
```javascript
// ✅ NEW PATTERN
export function createMyComponent(options = {}) {
  const container = document.createElement('div');
  // ... setup ...

  return {
    element: container,
    destroy: () => {
      container.remove();
    },
    // Add other useful methods...
  };
}
```

**Step 3**: Update callsites (if needed)
```javascript
// OLD (might still work if only using for side effects)
const component = createMyComponent();
document.body.appendChild(component);

// NEW (explicit element property)
const component = createMyComponent();
document.body.appendChild(component.element);
```

**Step 4**: Check backward compatibility
- If all callsites only use the component for side effects (e.g., `showToast()` not stored), migration is 100% backward compatible
- If callsites store and access the element directly, they need `.element` property

### Backward Compatibility Strategy

**Priority 1**: Functions called for side effects
- Examples: `showToast()`, `showLoadingIn()`, `showErrorIn()`
- Migration: ✅ 100% backward compatible
- Reason: Return value not stored or used

**Priority 2**: Functions with internal helpers
- Examples: `createLoadingState()` used by `showLoadingIn()`
- Migration: ✅ Update helper internally, external API unchanged

**Priority 3**: Functions with direct callsites
- Examples: `createCard()` stored in variables
- Migration: ⚠️ Requires callsite updates to use `.element`

### Testing After Migration

1. **Unit tests**: If component has tests, update assertions
2. **Visual testing**: Load pages that use the component
3. **Code pattern check**: Run `./scripts/check-code-patterns.sh`
4. **Backward compatibility**: Verify existing callsites still work

---

## Code Quality Checks

### Automated Pattern Detection

The codebase includes automated checks for component API consistency:

**Script**: `scripts/check-code-patterns.sh`

**Pattern 8**: Component factory return values
- Checks for `export function create*()` in `components/` directory
- Warns if functions return raw elements instead of API objects
- Acknowledges utility modules as valid exceptions

**Run checks**:
```bash
./scripts/check-code-patterns.sh
```

**Expected output**:
```
8️⃣  Checking component factory return values...
   ✅ Component factory APIs look consistent
```

### Manual Review Checklist

Before committing a new component:

- [ ] Component returns `{element, ...methods}` object
- [ ] `element` property is present and points to root HTMLElement
- [ ] Common methods included: `destroy()`, `show()`, `hide()` (if applicable)
- [ ] JSDoc comments document return value structure
- [ ] Callsites updated to use `.element` property (if needed)
- [ ] Code pattern check passes: `./scripts/check-code-patterns.sh`

---

## Related Documentation

- **Issue #274**: Component API Consistency (tech debt, completed 2025-11-13)
- **scripts/check-code-patterns.sh**: Automated code quality checks
- **BEM Methodology**: CSS naming conventions used in components
- **ARIA Accessibility**: Web accessibility standards for components

---

## Questions?

For questions or suggestions about component patterns:
1. Review this document first
2. Check existing component implementations for examples
3. Discuss in code review if unsure about a specific case

**Remember**: Consistency is key. Follow established patterns unless there's a strong reason to deviate.

---

**Document Version**: 1.0
**Last Updated**: 2025-11-13
**Maintained by**: Development Team
