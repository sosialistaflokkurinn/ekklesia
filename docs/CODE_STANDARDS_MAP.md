# Ekklesia Code Standards

**Last Updated**: 2025-11-22
**Status**: ✅ Active - Master Index for All Code Standards
**Purpose**: Unified reference for all coding conventions, style guides, and best practices

---

## Overview

This document serves as the master index for all code standards in the Ekklesia project. All standards are organized by technology/concern and linked to detailed guides in `/docs/standards/`.

### Philosophy

Our code standards prioritize:

1. **Consistency** - Same patterns across the entire codebase
2. **Clarity** - Code that explains itself
3. **Maintainability** - Easy to modify and extend
4. **Accessibility** - Usable by everyone
5. **Performance** - Fast, efficient code

---

## Quick Reference (TL;DR)

**For the impatient developer:**

| Standard | Key Rule | Example |
|----------|----------|---------|
| **CSS** | Use BEM methodology | `.nav__link--active` |
| **HTML** | Semantic elements | `<nav>`, `<main>`, `<article>` |
| **JavaScript** | ES6+ modules | `import { R } from './strings-loader.js'` |
| **Components** | Use `el()` helper | `el('div', 'card', {}, content)` |
| **Python** | Type hints + docstrings | `def foo(x: str) -> int:` |
| **i18n** | R.string pattern | `R.string.page_title` |
| **Data Quality** | Always validate input | `validateKennitala(kt)` |
| **Documentation** | JSDoc for functions | `/** @param {string} name */` |
| **Git** | Conventional commits | `feat(auth): add Kenni.is login` |
| **Quality** | Test before merge | `npm run test` |

---

## Standard Guides by Category

### 1. CSS Standards

**Guide**: [CSS & BEM Guide](../docs/standards/CSS_BEM_GUIDE.md)

**Summary**:
- Use canonical [BEM methodology](http://getbem.com/) (Block Element Modifier)
- [Design Tokens](../docs/standards/CSS_BEM_GUIDE.md) (3-layer architecture: Primitives, Semantic, Component)
- **Semantic Layer**: Use `--color-text`, `--color-bg`, `--color-primary` (not raw hex values)
- Utility classes with `.u-` prefix
- Component-based file organization
- No inline styles

**Key Conventions**:
```css
/* Block */
.card { }

/* Element (part of block) */
.card__title { }
.card__content { }

/* Modifier (variation) */
.card--welcome { }
.card__title--large { }

/* Utility (reusable helper) */
.u-hidden { }
.u-margin-top-md { }
```

**Quick Links**:
- [BEM Naming Rules](../docs/standards/CSS_BEM_GUIDE.md)
- [CSS Variables Reference](../docs/standards/CSS_BEM_GUIDE.md)
- [Component Organization](../docs/standards/CSS_BEM_GUIDE.md)

---

### 2. HTML Standards

**Guide**: [HTML Structure Guide](../docs/standards/HTML_GUIDE.md)

**Summary**:
- Use semantic [HTML5 elements](https://developer.mozilla.org/en-US/docs/Web/HTML/Element)
- [ARIA labels](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA) for accessibility
- Proper [heading hierarchy](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/Heading_Elements) (h1 → h2 → h3)
- [Form validation attributes](https://developer.mozilla.org/en-US/docs/Learn/Forms/Form_validation)
- i18n-ready with `id` attributes

**Key Conventions**:
```html
<!-- ✅ Good: Semantic structure -->
<nav class="nav">
  <a href="/dashboard" class="nav__link">Dashboard</a>
</nav>

<main class="page__container">
  <h1 id="page-title">Loading...</h1>
  <article class="card">
    <h2 class="card__title">Card Title</h2>
  </article>
</main>

<!-- ❌ Bad: Div soup -->
<div class="nav">
  <div class="link">Dashboard</div>
</div>
```

**Quick Links**:
- [Semantic HTML Reference](../docs/standards/HTML_GUIDE.md)
- [Accessibility Checklist](../docs/standards/HTML_GUIDE.md#accessibility)
- [Form Best Practices](../docs/standards/HTML_GUIDE.md#forms)

---

### 3. JavaScript Standards

**Guide**: [JavaScript Style Guide](../docs/standards/JAVASCRIPT_GUIDE.md)

**Summary**:
- [ES6+](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide) modern JavaScript
- Modular code with [`import`/`export`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [Async/await](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function) for promises
- [JSDoc](https://jsdoc.app/) comments for all functions
- No [jQuery](https://jquery.com/) - vanilla JS only

**Key Conventions**:
```javascript
// ✅ Good: Modern ES6+ with JSDoc
/**
 * Save phone numbers to Firestore
 *
 * @param {Array<{country: string, number: string}>} phoneNumbers
 * @returns {Promise<void>}
 */
async function savePhoneNumbers(phoneNumbers) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  await updateDoc(doc(db, 'members', user.uid), {
    phone_numbers: phoneNumbers
  });
}

// ❌ Bad: Old-style callback hell
function savePhoneNumbers(phoneNumbers, callback) {
  firebase.auth().onAuthStateChanged(function(user) {
    firebase.firestore().collection('members').doc(user.uid)
      .update({ phone_numbers: phoneNumbers })
      .then(function() { callback(null) })
      .catch(function(err) { callback(err) });
  });
}
```

**Quick Links**:
- [Module System](../docs/standards/JAVASCRIPT_GUIDE.md)
- [Async Patterns](../docs/standards/JAVASCRIPT_GUIDE.md)
- [Error Handling](../docs/standards/JAVASCRIPT_GUIDE.md)
- [Naming Conventions](../docs/standards/JAVASCRIPT_GUIDE.md)

---

### 4. Component Standards

**Guide**: [Component Library Guide](../docs/standards/COMPONENT_LIBRARY_GUIDE.md)

**Summary**:
- Use `el()` helper for DOM creation (no `document.createElement`)
- Functional components with factory pattern (`createButton`, `createCard`)
- Return component API `{ element, update, destroy }`
- Use `R.string` for all text content
- BEM naming for classes

**Key Conventions**:
```javascript
// ✅ Good: Component Factory Pattern
import { el } from '../utils/dom.js';
import { R } from '/i18n/strings-loader.js';

export function createWelcomeCard({ username }) {
  const title = el('h2', 'card__title', {}, R.string.welcome_title);
  const text = el('p', 'card__text', {}, 
    R.format(R.string.welcome_message, username)
  );

  const card = el('div', 'card card--welcome', {}, title, text);

  return {
    element: card,
    update: (newUsername) => { /* ... */ },
    destroy: () => card.remove()
  };
}
```

**Quick Links**:
- [DOM Helper (`el()`)](../docs/standards/COMPONENT_LIBRARY_GUIDE.md#dom-helper)
- [Component API Pattern](../docs/standards/COMPONENT_LIBRARY_GUIDE.md#component-api)

---

### 5. Python Standards

**Guide**: [Python Style Guide](../docs/standards/PYTHON_GUIDE.md)

**Summary**:
- [Python 3.11+](https://docs.python.org/3.11/) modern syntax
- [Type hints](https://docs.python.org/3/library/typing.html) for function signatures
- Docstrings ([Google style](https://google.github.io/styleguide/pyguide.html)) for all public functions
- [PEP 8](https://peps.python.org/pep-0008/) formatting (use [`black`](https://black.readthedocs.io/) or [`ruff`](https://docs.astral.sh/ruff/))
- [Virtual environments](https://docs.python.org/3/library/venv.html) for dependencies

**Key Conventions**:
```python
# ✅ Good: Modern Python with type hints and docstrings
from typing import Optional
from pathlib import Path

def normalize_kennitala(kennitala: str) -> Optional[str]:
    """Normalize kennitala format to DDMMYY-XXXX.

    Args:
        kennitala: Raw kennitala string with or without hyphen

    Returns:
        Normalized kennitala with hyphen, or None if invalid

    Example:
        >>> normalize_kennitala("1234567890")
        "123456-7890"
    """
    if not kennitala:
        return None

    kennitala = kennitala.strip()
    if '-' in kennitala:
        return kennitala

    if len(kennitala) == 10:
        return f"{kennitala[:6]}-{kennitala[6:]}"

    return None

# ❌ Bad: No type hints, no docstring
def normalize_kennitala(kennitala):
    if not kennitala:
        return None
    kennitala = kennitala.strip()
    if '-' in kennitala:
        return kennitala
    if len(kennitala) == 10:
        return kennitala[:6] + '-' + kennitala[6:]
    return None
```

**Where Python is Used**:
- **Cloud Functions** ([`services/members/functions/`](../services/members/functions/)) - Production code for [Firebase](https://firebase.google.com/docs/functions)
- **Admin Scripts** ([`scripts/admin/`](../scripts/admin/)) - Documentation audit, i18n validation, database tools

**Quick Links**:
- [Type Hints Reference](../docs/standards/PYTHON_GUIDE.md#type-hints)
- [Docstring Format](../docs/standards/PYTHON_GUIDE.md#docstrings)
- [Error Handling](../docs/standards/PYTHON_GUIDE.md#error-handling)
- [Cloud Functions Patterns](../docs/standards/PYTHON_GUIDE.md#cloud-functions)

---

### 6. Internationalization (i18n)

**Guide**: [i18n & R.string Guide](../docs/standards/I18N_GUIDE.md)

**Summary**:
- [XML-based strings](https://developer.android.com/guide/topics/resources/string-resource) (Android R.string pattern)
- All user-facing text in `i18n/values-is/strings.xml`
- Access via `R.string.key_name`
- Configuration values also in strings.xml
- Easy to add new languages

**Key Conventions**:
```javascript
// ✅ Good: Using R.string
import { R } from '/i18n/strings-loader.js';
await R.load('is');

document.title = R.string.page_title;
document.getElementById('btn-save').textContent = R.string.btn_save;

// Format strings with placeholders
const msg = R.format(R.string.error_format, errorDetails);

// ❌ Bad: Hardcoded strings
document.title = 'Félagakerfi';
document.getElementById('btn-save').textContent = 'Vista';
```

**Quick Links**:
- [R.string Setup](../docs/standards/I18N_GUIDE.md)
- [Adding Translations](../docs/standards/I18N_GUIDE.md)
- [String Format Placeholders](../docs/standards/I18N_GUIDE.md)
- [Configuration Values](../docs/standards/I18N_GUIDE.md)

**Tools**:
- `scripts/find-unused-strings.py` - Audit string usage
- `scripts/archive-unused-strings.py` - Clean up `strings.xml`

---

### 7. Data Quality & UX

**Guide**: [Data Quality & UX Guide](../docs/standards/DATA_QUALITY_UX.md)

**Summary**:
- Always [validate user input](https://developer.mozilla.org/en-US/docs/Learn/Forms/Form_validation)
- Flexible search patterns (autocomplete over strict format)
- Clear error messages
- Status feedback for async operations
- [Graceful degradation](https://developer.mozilla.org/en-US/docs/Glossary/Graceful_degradation)

**Key Conventions**:
```javascript
// ✅ Good: Validate and provide feedback
async function saveEmail(email) {
  const statusIcon = document.getElementById('status-email');

  // Validate
  if (!isValidEmail(email)) {
    showStatusFeedback(statusIcon, 'error');
    return;
  }

  // Save with feedback
  showStatusFeedback(statusIcon, 'loading');
  await updateUserEmail(email);
  showStatusFeedback(statusIcon, 'success');
}

// ❌ Bad: No validation or feedback
async function saveEmail(email) {
  await updateUserEmail(email);
}
```

**Key Patterns**:
- **Pattern 1**: Always validate input before saving
- **Pattern 2**: Flexible search with autocomplete (country selector)
- **Pattern 3**: Status feedback (loading → success → clear)
- **Pattern 4**: Clear error messages (not just "Error")

**Quick Links**:
- [Validation Rules](../docs/standards/DATA_QUALITY_UX.md)
- [Status Feedback Pattern](../docs/standards/DATA_QUALITY_UX.md)
- [Search UX Patterns](../docs/standards/DATA_QUALITY_UX.md)

---

### 8. Documentation Standards

**Guide**: [Documentation Guide](../docs/standards/DOCUMENTATION_GUIDE.md)

**Summary**:
- [JSDoc](https://jsdoc.app/) for all public functions
- [README.md](https://www.makeareadme.com/) in every major directory
- Architecture Decision Records ([ADRs](https://adr.github.io/)) for big changes
- Keep documentation close to code
- Update docs with code changes

**Key Conventions**:
```javascript
/**
 * Show status feedback on an element (loading → success → clear)
 *
 * This is a reusable utility for providing visual feedback on any
 * editable field. The feedback automatically clears after a delay.
 *
 * @param {HTMLElement} statusElement - The status icon element
 * @param {string} state - 'loading', 'success', or 'error'
 * @param {number} clearDelayMs - Milliseconds before clearing (default 2000)
 *
 * @example
 * const statusIcon = document.getElementById('status-email');
 * showStatusFeedback(statusIcon, 'loading');
 * await saveEmail();
 * showStatusFeedback(statusIcon, 'success');
 */
function showStatusFeedback(statusElement, state, clearDelayMs = 2000) {
  // Implementation...
}
```

**Quick Links**:
- [JSDoc Template](../docs/standards/DOCUMENTATION_GUIDE.md#jsdoc)
- [README Template](../docs/standards/DOCUMENTATION_GUIDE.md#readme)
- [ADR Process](../docs/standards/DOCUMENTATION_GUIDE.md#adr)

---

### 9. Git Workflow

**Guide**: [Git Workflow Guide](../docs/standards/GIT_WORKFLOW_GUIDE.md)

**Summary**:
- Feature branches from `main`
- [Conventional commit messages](https://www.conventionalcommits.org/)
- [Pull requests](https://docs.github.com/en/pull-requests) for all changes
- Squash merge for clean history
- Tag releases with [semantic versioning](https://semver.org/)

**Key Conventions**:
```bash
# ✅ Good: Conventional commit
git commit -m "feat(profile): add status feedback to phone numbers

- Created reusable showStatusFeedback() utility
- Added status icons to phone number fields
- Auto-clear success state after 2 seconds

Closes #123"

# ❌ Bad: Vague commit
git commit -m "Fixed stuff"
```

**Commit Types**:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring (no behavior change)
- `docs`: Documentation only
- `style`: Formatting (no code change)
- `test`: Adding tests
- `chore`: Maintenance (dependencies, config)

**Quick Links**:
- [Branch Naming](../docs/standards/GIT_WORKFLOW_GUIDE.md#branches)
- [Commit Message Format](../docs/standards/GIT_WORKFLOW_GUIDE.md#commits)
- [Pull Request Template](../docs/standards/GIT_WORKFLOW_GUIDE.md#pull-requests)

---

### 10. Quality & Testing

**Guide**: [Quality & Testing Guide](../docs/standards/QUALITY_TESTING_GUIDE.md)

**Summary**:
- Unit tests for business logic
- Integration tests for APIs
- Manual testing checklist for UI
- [Pre-commit hooks](https://pre-commit.com/) for code quality
- [Load testing](https://k6.io/) for production readiness

**Key Conventions**:
```javascript
// ✅ Good: Testable function with clear contract
/**
 * Validate Icelandic kennitala (national ID)
 *
 * @param {string} kt - Kennitala to validate (10 digits)
 * @returns {boolean} True if valid
 */
export function validateKennitala(kt) {
  if (!kt || kt.length !== 10) return false;
  // Validation logic...
  return true;
}

// Test
import { validateKennitala } from './validators.js';

test('validates correct kennitala', () => {
  expect(validateKennitala('1234567890')).toBe(true);
});

test('rejects invalid kennitala', () => {
  expect(validateKennitala('123')).toBe(false);
  expect(validateKennitala(null)).toBe(false);
});
```

**Quick Links**:
- [Testing Checklist](../docs/standards/QUALITY_TESTING_GUIDE.md)
- [Pre-commit Hooks](../docs/standards/QUALITY_TESTING_GUIDE.md)
- [Load Testing](../docs/standards/QUALITY_TESTING_GUIDE.md)

---

## Tooling & Configuration

### ESLint Configuration

**File**: `.eslintrc.json`

Enforces JavaScript standards automatically:
- ES6+ syntax rules
- No unused variables
- Consistent spacing and formatting
- JSDoc validation

**Usage**:
```bash
# Check for issues
npm run lint

# Auto-fix issues
npm run lint:fix
```

### Prettier Configuration

**File**: `.prettierrc.json`

Enforces consistent code formatting:
- 2-space indentation
- Single quotes for strings
- Semicolons required
- 100 character line width

**Usage**:
```bash
# Format all files
npm run format

# Check formatting
npm run format:check
```

### Pre-commit Hooks

Automatically runs before every commit:
- [ESLint](https://eslint.org/) checks
- [Prettier](https://prettier.io/) formatting
- Kennitala/PII detection (Optimized single-pass scan)
- File size limits

**Setup**:
```bash
# Install pre-commit hooks
npm install
# Hooks are automatically installed via package.json
# Custom optimized hooks are located in git-hooks/
```

### Maintenance Scripts

We provide several scripts to help maintain code quality and standards:

**Code Health**:
- `scripts/check-code-health.py`: Comprehensive health check (PII, patterns, file sizes)
- `scripts/check-code-patterns.sh`: Fast grep-based pattern check

**String Management**:
- `scripts/find-unused-strings.py`: Find unused i18n strings
- `scripts/archive-unused-strings.py`: Move unused strings to archive
- `scripts/restore-strings.py`: Restore archived strings if needed

---

## Pull Request Template

All pull requests must use the standardized template:

**File**: `.github/pull_request_template.md`

**Required Sections**:
- Summary of changes
- Type of change (feature/bugfix/refactor/docs)
- Testing completed
- Screenshots (for UI changes)
- Related issues/epics
- Checklist (tests passing, docs updated, etc.)

**Example**:
```markdown
## Summary
Added status feedback to phone numbers and addresses using reusable utility.

## Type of Change
- [x] Feature (new functionality)
- [ ] Bugfix (fixes issue)
- [ ] Refactor (no behavior change)

## Testing
- [x] Manual testing on profile page
- [x] Tested with multiple phone numbers
- [x] Verified auto-clear after 2 seconds

## Screenshots
[Attach screenshots showing checkmarks on phone fields]

## Related Issues
Closes #123

## Checklist
- [x] Code follows style guidelines
- [x] JSDoc added for new functions
- [x] No console.log statements left
- [x] Tested in Chrome and Firefox
```

---

## Priority Order (What Matters Most)

When in doubt about which standards to follow first, prioritize in this order:

### 🔴 Critical (Must Never Break)

1. **Security** - Never expose PII, tokens, or credentials
2. **Accessibility** - ARIA labels, keyboard navigation, semantic HTML
3. **Data Validation** - Always validate user input before saving
4. **Error Handling** - Never silently fail, always log errors

### 🟡 High Priority (Follow Before Merging)

5. **i18n** - No hardcoded user-facing strings
6. **BEM CSS** - Consistent naming for all styles
7. **JSDoc** - All public functions documented
8. **Git Commits** - Conventional commit messages

### 🟢 Medium Priority (Clean Up Before Release)

9. **Code Formatting** - Prettier/ESLint compliance
10. **Testing** - Unit tests for business logic
11. **Documentation** - READMEs and guides updated
12. **Performance** - No unnecessary re-renders or loops

---

## Common Patterns & Anti-Patterns

### ✅ Status Feedback Pattern (Good Example)

This pattern emerged from Epic #159 and is now our standard for all editable fields:

```javascript
// 1. Create reusable status icon
const statusIcon = createStatusIcon();

// 2. Add to DOM next to editable field
fieldContainer.appendChild(statusIcon);

// 3. Show feedback on change
field.addEventListener('blur', async (e) => {
  if (hasChanged(e.target.value)) {
    showStatusFeedback(statusIcon, 'loading');
    await saveField(e.target.value);
    showStatusFeedback(statusIcon, 'success');
  }
});
```

**Why This Works**:
- Clear visual feedback (loading spinner → checkmark)
- Auto-clears after 2 seconds (not cluttered)
- Reusable across all fields (phone, email, address)
- Accessible (status changes announced to screen readers)

### ❌ Callback Hell (Anti-Pattern)

```javascript
// ❌ Bad: Nested callbacks
firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    firebase.firestore().collection('members').doc(user.uid).get()
      .then(function(doc) {
        firebase.firestore().collection('members').doc(user.uid).update({
          name: doc.data().name
        }).then(function() {
          console.log('Saved');
        });
      });
  }
});

// ✅ Good: Async/await
async function updateName() {
  const user = auth.currentUser;
  if (!user) return;

  const docRef = doc(db, 'members', user.uid);
  const docSnap = await getDoc(docRef);

  await updateDoc(docRef, {
    name: docSnap.data().name
  });

  console.log('Saved');
}
```

### ❌ String Concatenation (Anti-Pattern)

```javascript
// ❌ Bad: Hardcoded and concatenated
const errorMsg = 'Villa kom upp: ' + error.message;
document.getElementById('error').textContent = errorMsg;

// ✅ Good: i18n with formatting
const errorMsg = R.format(R.string.error_format, error.message);
document.getElementById('error').textContent = errorMsg;
```

### ❌ Inline Styles (Anti-Pattern)

```javascript
// ❌ Bad: Inline styles
element.style.display = 'none';
element.style.color = 'red';

// ✅ Good: CSS classes
element.classList.add('u-hidden');
element.classList.add('profile-field__status--error');
```

---

## Standard Adoption Checklist

Before marking a file or feature as "standards-compliant", verify:

**CSS**:
- [ ] All classes follow BEM convention
- [ ] No inline styles
- [ ] CSS variables used for colors/spacing
- [ ] Utility classes use `.u-` prefix

**HTML**:
- [ ] Semantic elements used (`<nav>`, `<main>`, `<article>`)
- [ ] Proper heading hierarchy (h1 → h2 → h3)
- [ ] ARIA labels on interactive elements
- [ ] `id` attributes for i18n strings

**JavaScript**:
- [ ] ES6+ syntax (const/let, arrow functions, async/await)
- [ ] JSDoc comments on all functions
- [ ] No console.log in production code
- [ ] Proper error handling (try/catch)
- [ ] Modular code (import/export)

**i18n**:
- [ ] No hardcoded user-facing strings
- [ ] All strings in `i18n/values-is/strings.xml`
- [ ] Using `R.string.key_name` pattern
- [ ] Placeholders for dynamic content

**Documentation**:
- [ ] Function JSDoc complete
- [ ] README.md exists if needed
- [ ] Comments explain "why", not "what"
- [ ] Architecture decisions documented (ADR)

**Git**:
- [ ] Conventional commit messages
- [ ] Feature branch from main
- [ ] Pull request uses template
- [ ] Related issues linked

**Quality**:
- [ ] ESLint passes (`npm run lint`)
- [ ] Prettier formatted (`npm run format`)
- [ ] Manual testing completed
- [ ] No known bugs

---

## Enforcement

### Automated Checks (Pre-commit)

These run automatically before every commit:
- ESLint validation
- Prettier formatting check
- PII detection (kennitalas, emails)
- File size limits

**Cannot commit if these fail.**

### Code Review Checklist

Reviewers must verify:
- Standards compliance (use checklist above)
- Tests passing
- Documentation updated
- No security issues
- No performance regressions

### Exemptions

In rare cases, standards can be broken if:
1. Clearly documented why (ADR or code comment)
2. Approved by lead developer
3. Plan to fix in future (technical debt ticket)

**Example**:
```javascript
// TECH DEBT: Temporarily using inline style for dynamic positioning
// Will be refactored to CSS-in-JS in Epic #XX
element.style.top = `${calculatedTop}px`;
```

---

## Resources & Further Reading

### Internal Documentation
- [BEM Methodology](../docs/standards/CSS_BEM_GUIDE.md)
- [i18n System](../docs/standards/I18N_GUIDE.md)
- [JavaScript Patterns](../docs/standards/JAVASCRIPT_GUIDE.md)
- [Git Workflow](../docs/standards/GIT_WORKFLOW_GUIDE.md)

### External References
- [BEM Official Guide](http://getbem.com/)
- [MDN Web Docs](https://developer.mozilla.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [JSDoc Documentation](https://jsdoc.app/)
- [Python Type Hints](https://docs.python.org/3/library/typing.html)
- [PEP 8 Style Guide](https://peps.python.org/pep-0008/)
- [Semantic Versioning](https://semver.org/)
- [Pre-commit Hooks](https://pre-commit.com/)
- [ESLint](https://eslint.org/)
- [Prettier](https://prettier.io/)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-04 | Initial unified code standards document |

---

**Questions or Suggestions?**

File an issue with label `code-standards` or propose changes via pull request.
