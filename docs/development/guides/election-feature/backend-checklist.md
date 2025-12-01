# Election Feature Backend Checklist

**Purpose:** Backend, API, and data model requirements for election features
**Part of:** [Election Feature Development Guide](./OVERVIEW.md)
**Last Updated:** 2025-11-24

---

## 📋 Data Model

### Database & API Planning
- [ ] Election data structure defined
- [ ] Question/answer format specified
- [ ] API endpoints identified
- [ ] Database schema reviewed
- [ ] Vote submission payload defined
- [ ] Results data structure defined

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

## 🔄 State Management Concepts

### Election State Machine

**State Definitions:**
```javascript
const STATES = {
  LOADING: 'loading',      // Initial page load
  ERROR: 'error',          // API failure, network error
  EMPTY: 'empty',          // No election data
  ACTIVE: 'active',        // Election open for voting
  VOTED: 'voted',          // User already voted
  CLOSED: 'closed',        // Election ended, show results
  UPCOMING: 'upcoming'     // Election not started yet
};
```

**State Transitions:**
```javascript
function determineState(election, user) {
  if (!election) return STATES.EMPTY;
  if (election.status === 'closed') return STATES.CLOSED;
  if (election.status === 'upcoming') return STATES.UPCOMING;
  if (election.has_voted) return STATES.VOTED;
  if (election.status === 'active') return STATES.ACTIVE;
  return STATES.ERROR;
}
```

### State Checklist
- [ ] Loading state (initial page load)
- [ ] Error state (API failure, network error)
- [ ] Empty state (no election data)
- [ ] Active state (election open for voting)
- [ ] Voted state (user already voted)
- [ ] Closed state (election ended, show results)
- [ ] Upcoming state (election not started yet)

---

## 📡 API Integration Pattern

### Standard API Call Pattern

```javascript
import { initAuthenticatedPage } from './page-init.js';
import { R } from '../i18n/strings-loader.js';
import { formatDateIcelandic } from './utils/format.js';
import { getElectionById } from './api/elections-api.js';
import { showLoadingIn, hideLoadingIn } from './components/loading-state.js';
import { showErrorIn } from './components/error-state.js';
import { debug } from './utils/debug.js';

async function init() {
  try {
    // Load i18n
    await R.load('is');

    // Auth check
    await initAuthenticatedPage();

    // Get election ID
    const electionId = getElectionIdFromURL();
    if (!electionId) {
      showError(R.string.error_missing_election_id);
      return;
    }

    // Load election
    await loadElection(electionId);

  } catch (error) {
    debug.error('Error initializing:', error);
    showError(R.string.error_generic);
  }
}

async function loadElection(id) {
  const container = document.getElementById('election-content');

  // Show loading
  showLoadingIn(container, R.string.loading_election);

  try {
    const election = await getElectionById(id);
    hideLoadingIn(container);
    displayElection(election);
  } catch (error) {
    debug.error('Failed to load election:', error);
    hideLoadingIn(container);
    showErrorIn(container, R.string.error_load_election, () => loadElection(id));
  }
}

function displayElection(election) {
  // Display with i18n and date formatting
  document.getElementById('title').textContent = election.title;
  document.getElementById('start-time').textContent = formatDateIcelandic(election.voting_starts_at);
  // ... rest of display logic
}

document.addEventListener('DOMContentLoaded', init);
```

---

## 🧪 Backend Testing

### API Testing Checklist
- [ ] Test successful data retrieval
- [ ] Test API error handling (404, 500, network failure)
- [ ] Test authentication (valid token, expired token, no token)
- [ ] Test data validation (missing fields, invalid data)
- [ ] Test rate limiting (if applicable)
- [ ] Test CORS configuration

---

## 📚 Reference

### API Documentation
- **Elections API:** `/services/elections/` - Election CRUD operations
- **Authentication:** Firebase Auth tokens
- **Error Handling:** Standard HTTP status codes

### Related Checklists
- [Components](./components-checklist.md) - Frontend components that consume APIs
- [Testing](./testing-checklist.md) - Backend testing procedures
- [Overview](./OVERVIEW.md) - Back to main guide

---

**Last Updated:** 2025-11-24
**Maintained By:** Development Team
