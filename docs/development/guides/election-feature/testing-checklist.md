# Election Feature Testing Checklist

**Purpose:** Testing procedures and code quality standards
**Part of:** [Election Feature Development Guide](./OVERVIEW.md)
**Last Updated:** 2025-11-24

---

## 🧪 Testing Checklist

### Manual Testing
- [ ] Test on Chrome (latest)
- [ ] Test on Firefox (latest)
- [ ] Test on Safari (if possible)
- [ ] Test on mobile device (iOS or Android)
- [ ] Test with slow network (Chrome DevTools > Network > Slow 3G)
- [ ] Test with JavaScript disabled (graceful degradation)

### Functionality Testing
- [ ] Happy path works (user can complete task)
- [ ] Error path works (API failure shows error, retry works)
- [ ] Edge cases handled (empty data, missing fields, etc.)
- [ ] Can't submit invalid data (client-side validation)
- [ ] Can't submit twice (disable button after click)
- [ ] Can navigate back without losing state

### Accessibility Testing
- [ ] Tab through all interactive elements
- [ ] Use screen reader (NVDA on Windows, VoiceOver on Mac)
- [ ] Run Lighthouse accessibility audit (score 90+)
- [ ] Check color contrast (all text 4.5:1 minimum)

### i18n Testing
- [ ] All text in Icelandic (no English leaking through)
- [ ] Dates formatted correctly (`6. nóvember 2025 kl. 13:30`)
- [ ] Numbers formatted correctly (Icelandic uses `.` for thousands)
- [ ] No console warnings about missing strings

---

## 📝 Code Quality

### Code Style
- [ ] Consistent naming (camelCase for variables/functions)
- [ ] Descriptive names (not `x`, `temp`, `data`)
- [ ] JSDoc comments on exported functions
- [ ] Constants in UPPER_CASE
- [ ] No magic numbers (use named constants)

**Example:**
```javascript
// Good ✓
const MAX_VOTE_DURATION_HOURS = 24;
const MIN_ANSWERS_REQUIRED = 2;

// Bad ✗
if (hours > 24) { ... }  // What does 24 mean?
```

### File Organization
- [ ] One component per file
- [ ] Related files grouped in directories
- [ ] CSS files match JS files (election-detail.js → election-detail.css)
- [ ] Utilities in `/js/utils/`
- [ ] Components in `/js/components/`
- [ ] Styles in `/styles/components/`

---

## 🔒 Security & Data Validation

### Input Validation
- [ ] All user input escaped with `escapeHTML()` utility
- [ ] No innerHTML with unsanitized data
- [ ] URL parameters validated before use
- [ ] API responses validated (check for required fields)

**Example:**
```javascript
import { escapeHTML } from './utils/format.js';

// Good ✓
const safeAnswer = escapeHTML(selectedAnswer.text);
element.innerHTML = `<p>${safeAnswer}</p>`;

// Bad ✗
element.innerHTML = `<p>${selectedAnswer.text}</p>`;  // XSS vulnerability!
```

### Authentication
- [ ] Page uses `initAuthenticatedPage()` from `page-init.js`
- [ ] Firebase token validated before API calls
- [ ] Unauthenticated users redirected to login

**Example:**
```javascript
import { initAuthenticatedPage } from './page-init.js';

async function init() {
  await initAuthenticatedPage();  // Handles auth check + redirect
  // ... rest of initialization
}
```

---

## 🔄 State Management

### Election State Checklist
- [ ] Loading state (initial page load)
- [ ] Error state (API failure, network error)
- [ ] Empty state (no election data)
- [ ] Active state (election open for voting)
- [ ] Voted state (user already voted)
- [ ] Closed state (election ended, show results)
- [ ] Upcoming state (election not started yet)

**State Transitions:**
```javascript
// State machine
const STATES = {
  LOADING: 'loading',
  ERROR: 'error',
  ACTIVE: 'active',
  VOTED: 'voted',
  CLOSED: 'closed',
  UPCOMING: 'upcoming'
};

function determineState(election, user) {
  if (election.status === 'closed') return STATES.CLOSED;
  if (election.status === 'upcoming') return STATES.UPCOMING;
  if (election.has_voted) return STATES.VOTED;
  if (election.status === 'active') return STATES.ACTIVE;
  return STATES.ERROR;
}
```

---

## 📚 Reference

### Testing Tools
- **Lighthouse:** Chrome DevTools > Lighthouse
- **axe DevTools:** Browser extension for accessibility
- **Screen Readers:**
  - NVDA (Windows) - Free
  - VoiceOver (Mac) - Built-in
- **Network Throttling:** Chrome DevTools > Network > Slow 3G

### Related Checklists
- [Accessibility Checklist](./accessibility-checklist.md) - Detailed a11y testing
- [Deployment Checklist](./deployment-checklist.md) - Pre-deployment checks
- [i18n Checklist](./i18n-checklist.md) - i18n testing procedures
- [Overview](./OVERVIEW.md) - Back to main guide

---

**Last Updated:** 2025-11-24
**Maintained By:** Development Team
