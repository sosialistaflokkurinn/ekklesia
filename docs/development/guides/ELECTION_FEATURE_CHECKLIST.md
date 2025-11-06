# Election Feature Development Checklist

**Purpose:** Comprehensive checklist for implementing election-related features using reusable components.

**Last Updated:** Nov 6, 2025 (v3.0 - Typography & Spacing Standards, Multi-Choice Support)
**Status:** ✅ Active
**Related:** Component Library (Epic #191), i18n System, Real-time Election State, Epic #186

---

## 📋 Pre-Development Checklist

### 1. Requirements & Design
- [ ] User story defined and approved
- [ ] UI mockups/wireframes available
- [ ] Accessibility requirements identified (WCAG AA)
- [ ] Mobile vs desktop differences noted
- [ ] Error states defined (network failure, validation errors, etc.)
- [ ] Loading states defined (initial load, submission, etc.)
- [ ] Success states defined (confirmation, feedback)

### 2. Data Model
- [ ] Election data structure defined
- [ ] Question/answer format specified
- [ ] API endpoints identified
- [ ] Database schema reviewed
- [ ] Vote submission payload defined
- [ ] Results data structure defined

---

## 🌍 i18n (Internationalization)

### All User-Facing Text MUST Use i18n

**Location:** `/i18n/values-is/strings.xml`

**Checklist:**
- [ ] **NO hardcoded Icelandic text in HTML**
- [ ] **NO hardcoded Icelandic text in JavaScript**
- [ ] All strings added to `strings.xml` with descriptive names
- [ ] String names follow naming convention: `{page}_{element}_{purpose}`
- [ ] Strings tested with actual content (not Lorem Ipsum)

**Examples:**
```xml
<!-- Good naming convention -->
<string name="election_detail_title">Kosning</string>
<string name="election_status_active">Virk</string>
<string name="election_confirm_message">Ertu viss um að þú viljir kjósa þetta svar?</string>

<!-- Bad naming convention -->
<string name="text1">Kosning</string>
<string name="msg">Ertu viss?</string>
```

**JavaScript Usage:**
```javascript
import { R } from '../i18n/strings-loader.js';

// Good
document.getElementById('title').textContent = R.string.election_detail_title;

// Bad
document.getElementById('title').textContent = 'Kosning';
```

**Common i18n Strings Needed:**
- [ ] Page title
- [ ] Section headings
- [ ] Button labels (Submit, Cancel, Confirm, etc.)
- [ ] Status labels (Active, Closed, Upcoming)
- [ ] Error messages (Load failed, Network error, Validation errors)
- [ ] Success messages (Vote submitted, Saved successfully)
- [ ] Loading messages (Loading election..., Submitting vote...)
- [ ] Empty states (No elections available, No results yet)
- [ ] Confirmation messages (Are you sure...?)
- [ ] Help text / tooltips

---

## 🎨 Component Usage

### Component Overview

**Available Components:**

| Component | Purpose | Import | CSS Required |
|-----------|---------|--------|--------------|
| `showModal` | Confirmation dialogs | `./components/modal.js` | `modal.css` |
| `createVotingForm` | Question + answer options + vote button | `./components/voting-form.js` | `voting-form.css` |
| `createScheduleDisplay` | Member election schedule view | `./components/schedule-display.js` | `countdown-timer.css` |
| `createScheduleControl` | Admin election control panel | `./components/schedule-control.js` | `countdown-timer.css`, `schedule-control.css` |
| `createCountdownTimer` | Live countdown timer | `./components/countdown-timer.js` | `countdown-timer.css` |
| `createBadge` | Status badges | `./components/badge.js` | `badge.css` |
| `createCard` | Content cards | `./components/card.js` | Built-in to page.css` |
| `electionState` | Centralized state manager | `./utils/election-state.js` | None |

**Utility Functions:**

| Function | Purpose | Import |
|----------|---------|--------|
| `formatDateIcelandic()` | Format dates in Icelandic | `./utils/format.js` |
| `formatDateOnlyIcelandic()` | Format date without time | `./utils/format.js` |
| `escapeHTML()` | Prevent XSS attacks | `./utils/format.js` |
| `debug.log/error()` | Console logging | `./utils/debug.js` |

---

## 📐 Typography & Spacing Standards

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

### Modal Component

**Import:**
```javascript
import { showModal } from './components/modal.js';
```

**Usage Checklist:**
- [ ] Import `modal.css` in HTML (`<link rel="stylesheet" href="/styles/components/modal.css">`)
- [ ] All modal text uses i18n strings (`R.string.*`)
- [ ] Modal title is descriptive and clear
- [ ] Modal content uses semantic HTML (not just text)
- [ ] Buttons have clear labels (not just "Yes/No")
- [ ] Primary action is visually distinct (`.btn--primary`)
- [ ] ESC key closes modal (default behavior)
- [ ] Clicking overlay closes modal (default behavior)
- [ ] Modal size appropriate for content (`sm`, `md`, `lg`, `xl`)

**Example - Confirmation Modal:**
```javascript
const modal = showModal({
  title: R.string.confirm_vote_title,         // i18n ✓
  content: `
    <p>${R.string.confirm_vote_message}</p>
    <p class="modal__selected-answer">
      <strong>${R.string.your_answer}:</strong> ${escapeHTML(answer)}
    </p>
  `,
  buttons: [
    {
      text: R.string.btn_cancel,              // i18n ✓
      onClick: () => modal.close(),
      primary: false
    },
    {
      text: R.string.btn_confirm,             // i18n ✓
      onClick: () => {
        modal.close();
        submitVote();
      },
      primary: true
    }
  ],
  size: 'md'
});
```

---

### Loading State Component

**Import:**
```javascript
import { showLoadingIn, hideLoadingIn } from './components/loading-state.js';
```

**Usage Checklist:**
- [ ] Loading message uses i18n string
- [ ] Loading state shown BEFORE async operation starts
- [ ] Loading state hidden AFTER operation completes (success or error)
- [ ] Spinner size appropriate for context (`sm`, `md`, `lg`)
- [ ] Loading state prevents user interaction (disable buttons, etc.)

**Example:**
```javascript
// Show loading
showLoadingIn(container, R.string.loading_election);  // i18n ✓

try {
  const election = await getElectionById(id);
  hideLoadingIn(container);
  displayElection(election);
} catch (error) {
  hideLoadingIn(container);
  showError(R.string.error_load_election);  // i18n ✓
}
```

---

### Error State Component

**Import:**
```javascript
import { showErrorIn } from './components/error-state.js';
```

**Usage Checklist:**
- [ ] Error message uses i18n string
- [ ] Error message is user-friendly (not technical jargon)
- [ ] Retry button provided when retry makes sense
- [ ] Error logged to console for debugging (`debug.error()`)
- [ ] User can navigate away from error state

**Example:**
```javascript
import { showErrorIn } from './components/error-state.js';
import { debug } from './utils/debug.js';

try {
  const election = await getElectionById(id);
  displayElection(election);
} catch (error) {
  debug.error('Failed to load election:', error);
  showErrorIn(
    container,
    R.string.error_load_election,  // i18n ✓
    () => loadElection(id)         // Retry handler
  );
}
```

---

### Badge Component

**Import:**
```javascript
import { createBadge, createStatusBadge } from './components/badge.js';
```

**Usage Checklist:**
- [ ] Badge text uses i18n string
- [ ] Badge variant matches semantic meaning (`success`, `error`, `warning`, `info`, `primary`)
- [ ] Badge size appropriate for context (`xs`, `sm`, `md`, `lg`)
- [ ] Badge color contrast meets WCAG AA (4.5:1 minimum)

**Example:**
```javascript
// Status badge (auto-color based on status)
const badge = createStatusBadge('active');  // Auto-maps to 'success' variant

// Manual badge
const badge = createBadge(R.string.election_status_active, {
  variant: 'success',
  size: 'md'
});
```

---

### Card Component

**Import:**
```javascript
import { createCard } from './components/card.js';
```

**Usage Checklist:**
- [ ] Card title uses i18n string
- [ ] Card content is semantic HTML (not plain text)
- [ ] Card actions (buttons) use i18n strings
- [ ] Card variant appropriate for context (`default`, `welcome`, `admin-welcome`)

**Example:**
```javascript
const card = createCard({
  title: R.string.election_detail_title,
  content: `<p>${escapeHTML(election.description)}</p>`,
  actions: [
    {
      text: R.string.btn_vote,
      onClick: () => showVotingModal(),
      primary: true
    }
  ],
  variant: 'default'
});
```

---

### Voting Form Component

**Import:**
```javascript
import { createVotingForm } from './components/voting-form.js';
```

**CSS Import:**
```html
<link rel="stylesheet" href="/styles/components/voting-form.css">
```

**Usage Checklist:**
- [ ] Import `voting-form.css` in HTML
- [ ] Question text uses election data (not hardcoded)
- [ ] All labels use i18n strings (`questionLabel`, `votingTitle`, `voteButtonText`)
- [ ] Provide `onSubmit` callback for handling vote (receives array of answer IDs)
- [ ] Answers array has at least 2 options
- [ ] Each answer has `id` and `text` properties
- [ ] Decide on single-choice (radio) or multi-choice (checkbox) mode
- [ ] If multi-choice, optionally set `maxSelections` and `minSelections`

**Example 1: Single-Choice Voting (Radio Buttons) - Default**
```javascript
import { createVotingForm } from './components/voting-form.js';
import { R } from '../i18n/strings-loader.js';

// Create single-choice voting form (radio buttons)
const votingForm = createVotingForm({
  question: election.question,              // "Hver ætti að vera formaður?"
  answers: election.answers,                // [{id: '1a', text: 'Alice'}, ...]
  allowMultiple: false,                     // Radio buttons (default)
  questionLabel: R.string.election_question_label,  // i18n ✓
  votingTitle: R.string.voting_select_answer,       // i18n ✓
  voteButtonText: R.string.btn_vote,                // i18n ✓

  // Handle vote submission (receives array of 1 ID for single-choice)
  onSubmit: (answerIds) => {
    showConfirmationModal(answerIds);  // answerIds = ['1a']
  }
});

container.appendChild(votingForm.element);
```

**Example 2: Multi-Choice Voting (Checkboxes)**
```javascript
// Create multi-choice voting form (checkboxes)
const votingForm = createVotingForm({
  question: "Veldu alla sem eiga að vera í stjórn",
  answers: [
    { id: '1a', text: 'Alice Johnson' },
    { id: '1b', text: 'Bob Smith' },
    { id: '1c', text: 'Charlie Brown' },
    { id: '1d', text: 'Diana Ross' }
  ],
  allowMultiple: true,                      // Checkboxes ✓
  maxSelections: 3,                         // Maximum 3 selections
  minSelections: 1,                         // Minimum 1 selection (default)
  questionLabel: R.string.election_question_label,
  votingTitle: R.string.voting_select_answer,
  voteButtonText: R.string.btn_vote,

  // Handle vote submission (receives array of IDs)
  onSubmit: (answerIds) => {
    showConfirmationModal(answerIds);  // answerIds = ['1a', '1b', '1c']
  }
});

container.appendChild(votingForm.element);

// Component automatically:
// - Shows selection counter: "Valið 2 af 3 valkostum"
// - Prevents selecting more than maxSelections
// - Disables vote button until minSelections met
// - Highlights counter when max reached
```

**Control Methods:**
```javascript
// Get currently selected answer IDs (always returns array)
const selected = votingForm.getSelectedAnswers();  // Returns ['1a'] or ['1a', '1b', '1c']

// Reset form (clear all selections)
votingForm.reset();

// Disable form (prevent interaction)
votingForm.disable();

// Enable form
votingForm.enable();

// Show loading state on button
votingForm.showLoading('Sendir atkvæði...');

// Hide loading state
votingForm.hideLoading();

// Cleanup
votingForm.destroy();
```

**What It Does:**
- Displays question with title
- Renders radio buttons (single-choice) or checkboxes (multi-choice)
- Auto-validates based on min/max selections
- Shows selection counter for multi-choice mode ("Valið X af Y valkostum")
- Handles form submission (returns array of answer IDs)
- Visual feedback (hover, selected state)

**Styling:**
- BEM methodology (`.voting-form__*`)
- Fully responsive
- Accessible (labels, radio buttons)
- WCAG AA color contrast

---

### Schedule Display Component (Member View)

**Import:**
```javascript
import { createScheduleDisplay } from './components/schedule-display.js';
import { electionState } from './utils/election-state.js';
```

**CSS Import:**
```html
<link rel="stylesheet" href="/styles/components/countdown-timer.css">
```

**Usage Checklist:**
- [ ] Import `countdown-timer.css` in HTML
- [ ] Initialize `electionState` with election data BEFORE creating display
- [ ] Use i18n strings for labels (`R.string.election_starts`, `R.string.election_ends`)
- [ ] Component shows status emoji (🔴 upcoming, 🟢 active, ⚫ closed)
- [ ] Countdown timer shows when election is active
- [ ] Component auto-updates when `electionState` changes

**Example:**
```javascript
// Initialize election state (REQUIRED)
electionState.initialize(election);

// Create schedule display
const display = createScheduleDisplay({
  startLabel: R.string.election_starts,    // i18n ✓
  endLabel: R.string.election_ends,        // i18n ✓
  showCountdown: true                       // Show countdown when active
});

// Add to page
container.appendChild(display.element);

// Component automatically:
// - Shows 🟢 emoji and "Kosning í gangi" when active
// - Displays countdown: "15 mínútur eftir" + "0:15:32"
// - Updates every second until election closes
// - Switches to 🔴 or ⚫ when status changes
```

**What It Does:**
- Displays election start/end times in Icelandic format
- Shows real-time countdown timer during active elections
- Auto-syncs with election state changes
- Two countdown formats: stopwatch ("0:15:32") + human-readable ("15 mínútur eftir")

---

### Schedule Control Component (Admin View)

**Import:**
```javascript
import { createScheduleControl } from './components/schedule-control.js';
import { electionState } from './utils/election-state.js';
```

**CSS Import:**
```html
<link rel="stylesheet" href="/styles/components/countdown-timer.css">
<link rel="stylesheet" href="/styles/components/schedule-control.css">
```

**Usage Checklist:**
- [ ] Import both CSS files in HTML
- [ ] Initialize `electionState` with election data BEFORE creating control
- [ ] Provide `onStarted`, `onClosed`, `onScheduled` callbacks for API integration
- [ ] Admin-only page (check permissions)
- [ ] All callbacks should update backend via API
- [ ] Test all duration presets (15, 30, 60, 90, 120 min, custom)

**Example:**
```javascript
// Initialize election state (REQUIRED)
electionState.initialize(election);

// Create admin control
const control = createScheduleControl({
  electionId: election.id,

  // Called when admin clicks "Byrja kosningu núna"
  onStarted: async (state) => {
    try {
      await updateElectionAPI(election.id, {
        status: 'active',
        voting_starts_at: state.voting_starts_at,
        voting_ends_at: state.voting_ends_at
      });
      showToast('Kosning byrjuð!', 'success');
    } catch (error) {
      showToast('Villa kom upp', 'error');
    }
  },

  // Called when admin clicks "Loka kosningu núna"
  onClosed: async (state) => {
    try {
      await updateElectionAPI(election.id, {
        status: 'closed',
        voting_ends_at: state.voting_ends_at
      });
      showToast('Kosningu lokað!', 'success');
    } catch (error) {
      showToast('Villa kom upp', 'error');
    }
  },

  // Called when admin schedules election for future
  onScheduled: async (state) => {
    try {
      await updateElectionAPI(election.id, {
        voting_starts_at: state.voting_starts_at,
        voting_ends_at: state.voting_ends_at
      });
      showToast('Kosning áætluð!', 'success');
    } catch (error) {
      showToast('Villa kom upp', 'error');
    }
  }
});

// Add to page
container.appendChild(control.element);
```

**Features:**
- ⚡ **Start Now:** Instant launch with duration presets (15, 30, 60, 90, 120 min, custom)
- 🕐 **Schedule:** Pick date/time + duration for future elections
- 🛑 **Close Now:** Manual closure with confirmation dialog
- Live countdown display when election is active
- Real-time sync with member views (via `electionState`)

**Admin Page Structure:**
```html
<!-- Admin Election Control Page -->
<div class="card">
  <h2>Kosningartíðastjórnun</h2>
  <div id="schedule-control-container">
    <!-- Schedule control component inserted here -->
  </div>
</div>

<div class="card">
  <h2>Forskoðun (þannig sjá félagsmenn þetta)</h2>
  <div id="member-preview-container">
    <!-- Schedule display component inserted here for preview -->
  </div>
</div>
```

---

### Election State Manager

**Import:**
```javascript
import { electionState } from './utils/election-state.js';
```

**Usage Checklist:**
- [ ] Initialize state with `electionState.initialize(election)` ONCE per page
- [ ] Do NOT create multiple instances (it's a singleton)
- [ ] Listen to events for custom behavior
- [ ] Call state methods for manual control (admin only)

**Example - Basic Usage:**
```javascript
// Initialize (required for all election pages)
electionState.initialize(election);

// Get current state
const state = electionState.getState();
console.log(state.status);  // 'upcoming' | 'active' | 'closed'

// Check if user voted
if (electionState.hasVoted()) {
  showAlreadyVotedMessage();
}

// Mark that user voted (after successful vote submission)
electionState.markVoted();
```

**Example - Custom Event Listeners:**
```javascript
// Listen to status changes
electionState.addEventListener('status-changed', (event) => {
  const { oldStatus, newStatus, state } = event.detail;
  console.log(`Status changed: ${oldStatus} → ${newStatus}`);

  // Custom logic
  if (newStatus === 'active') {
    showNotification('Kosning er nú opin!');
  }
});

// Listen to countdown ticks (every second during active election)
electionState.addEventListener('countdown-tick', (event) => {
  const { minutes, seconds, humanReadable } = event.detail;
  console.log(`Time remaining: ${humanReadable}`);

  // Custom warning at 5 minutes
  if (minutes === 5 && seconds === 0) {
    showNotification('5 mínútur eftir!');
  }
});

// Listen to schedule changes
electionState.addEventListener('schedule-changed', (event) => {
  const { voting_starts_at, voting_ends_at } = event.detail;
  console.log('Schedule updated');
});
```

**Admin Methods (Admin Pages Only):**
```javascript
// Start election immediately with 60 minute duration
await electionState.startNow(60);

// Close election immediately
await electionState.closeNow();

// Update schedule (for future election)
await electionState.updateSchedule({
  startDate: new Date('2025-11-10T19:00:00'),
  durationMinutes: 120
});
```

**Available Events:**
- `initialized` - Fired when state is first initialized
- `status-changed` - Fired when status changes (upcoming/active/closed)
- `schedule-changed` - Fired when start/end times change
- `countdown-tick` - Fired every second during active election
- `started` - Fired when election starts
- `closed` - Fired when election closes
- `voted` - Fired when user marks voted

---

### Countdown Timer Component

**Import:**
```javascript
import { createCountdownTimer } from './components/countdown-timer.js';
```

**CSS Import:**
```html
<link rel="stylesheet" href="/styles/components/countdown-timer.css">
```

**Usage Checklist:**
- [ ] Import `countdown-timer.css` in HTML
- [ ] Provide valid end date
- [ ] Decide which format to show (stopwatch, human-readable, or both)
- [ ] Handle `onComplete` callback (what happens when timer reaches 0)

**Example:**
```javascript
const timer = createCountdownTimer({
  endDate: election.voting_ends_at,

  // Called every second with time remaining
  onTick: (timeRemaining) => {
    console.log(timeRemaining.humanReadable);  // "15 mínútur eftir"
    console.log(timeRemaining.stopwatch);      // "0:15:32"
  },

  // Called when timer reaches 0
  onComplete: () => {
    showNotification('Kosningu lokið!');
    electionState.updateStatus('closed');
  },

  // Display options
  showBoth: true,           // Show both formats (default)
  showStopwatch: true,      // Show "0:15:32"
  showHumanReadable: true   // Show "15 mínútur eftir"
});

// Add to page
container.appendChild(timer.element);

// Manual control
timer.stop();                          // Stop countdown
timer.reset(newEndDate);               // Reset with new end time
timer.destroy();                       // Remove and cleanup
```

**Timer States (Auto-Applied):**
- **Normal:** Green border, normal display
- **Warning (<5 min):** Orange/yellow background
- **Critical (<1 min):** Red background with pulse animation
- **Expired:** Gray, shows "Kosningu lokið"

**Note:** You rarely need to use this component directly - `schedule-display` and `schedule-control` use it automatically.

---

## 📅 Date Formatting

**Always use Icelandic date format utility**

**Import:**
```javascript
import { formatDateIcelandic, formatDateOnlyIcelandic } from './utils/format.js';
```

**Usage Checklist:**
- [ ] **NO `toLocaleDateString()` in code** (use `formatDateIcelandic()`)
- [ ] **NO hardcoded date formats** (use utility functions)
- [ ] Date format: `"6. nóvember 2025 kl. 13:30"`
- [ ] Time uses 24-hour format (not AM/PM)
- [ ] Month names in Icelandic lowercase

**Example:**
```javascript
// Good ✓
const startTime = formatDateIcelandic(election.voting_starts_at);
// Output: "6. nóvember 2025 kl. 13:30"

// Date only (no time)
const date = formatDateOnlyIcelandic(election.created_at);
// Output: "6. nóvember 2025"

// Bad ✗
const startTime = new Date(election.voting_starts_at).toLocaleDateString('is-IS');
```

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

## 🚀 Performance

### Page Load Optimization
- [ ] CSS loaded in `<head>` (render-blocking is OK for CSS)
- [ ] JavaScript loaded with `type="module"` (deferred by default)
- [ ] Version parameters on all static assets (`?v=20251106-22`)
- [ ] Images optimized (WebP, lazy loading)
- [ ] Fonts preloaded if custom fonts used

### Runtime Performance
- [ ] Debounce user input (search, autocomplete)
- [ ] Throttle scroll/resize handlers
- [ ] Use `document.getElementById()` not `querySelector()` when possible
- [ ] Minimize DOM manipulation (batch updates)
- [ ] Remove event listeners when no longer needed

**Example:**
```javascript
import { debounce } from './utils/debounce.js';

// Good ✓
const handleSearch = debounce((query) => {
  searchElections(query);
}, 300);

searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
```

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

### Git Commits
- [ ] Descriptive commit messages (not "fix bug", "update code")
- [ ] Use conventional commits format:
  - `feat(elections): add vote confirmation modal`
  - `fix(elections): date format using English months`
  - `refactor(modal): extract reusable component`
  - `docs(checklist): add election feature checklist`

---

## 🔧 Debugging Checklist

### Common Issues & Solutions

**Issue: Modal not showing**
- [ ] Check `modal.css` is imported in HTML
- [ ] Check no conflicting CSS (search for `.modal {` in other files)
- [ ] Check `showModal()` is called correctly
- [ ] Check browser console for errors

**Issue: i18n strings showing as "Missing string key: ..."**
- [ ] Check string exists in `/i18n/values-is/strings.xml`
- [ ] Check string name matches exactly (case-sensitive)
- [ ] Check `R.load('is')` was called before using strings
- [ ] Hard refresh browser (Ctrl+Shift+R)

**Issue: Date showing in English**
- [ ] Using `formatDateIcelandic()` not `toLocaleDateString()`
- [ ] Check import: `import { formatDateIcelandic } from './utils/format.js'`
- [ ] Check date string is valid ISO format

**Issue: Styles not updating**
- [ ] Update version parameter (`?v=20251106-XX`)
- [ ] Hard refresh browser (Ctrl+Shift+R)
- [ ] Check CSS file path is correct
- [ ] Check for CSS specificity conflicts

**Issue: Authentication redirect loop**
- [ ] Check Firebase config is correct
- [ ] Check user is actually logged in (Firebase console)
- [ ] Check `initAuthenticatedPage()` is called only once
- [ ] Check no JavaScript errors before auth check

---

## 📚 Reference Documentation

### Component Library
- **Modal:** `/js/components/modal.js`
- **Loading State:** `/js/components/loading-state.js`
- **Error State:** `/js/components/error-state.js`
- **Badge:** `/js/components/badge.js`
- **Card:** `/js/components/card.js`

### Utilities
- **Date Formatting:** `/js/utils/format.js` - `formatDateIcelandic()`
- **HTML Escaping:** `/js/utils/format.js` - `escapeHTML()`
- **Debounce:** `/js/utils/debounce.js`
- **Debug Logging:** `/js/utils/debug.js`

### i18n
- **Strings File:** `/i18n/values-is/strings.xml`
- **Loader:** `/i18n/strings-loader.js`
- **Usage:** `import { R } from '../i18n/strings-loader.js'`

### Styles
- **Global:** `/styles/global.css` - CSS variables, reset
- **Button:** `/styles/components/button.css`
- **Modal:** `/styles/components/modal.css`
- **Navigation:** `/styles/components/nav.css`

---

## ✅ Pre-Deployment Checklist

### Before Committing
- [ ] All console.log() removed (use `debug.log()` instead)
- [ ] No commented-out code
- [ ] No TODO comments (create GitHub issues instead)
- [ ] All functions documented (JSDoc)
- [ ] Code formatted consistently

### Before Deploying
- [ ] Manual testing completed (see Testing Checklist)
- [ ] No errors in browser console
- [ ] Lighthouse score: 90+ (Performance, Accessibility, Best Practices)
- [ ] Version numbers updated in HTML
- [ ] Git commit with descriptive message
- [ ] Deploy: `firebase deploy --only hosting`

### After Deploying
- [ ] Test on production URL (hard refresh)
- [ ] Check Firebase hosting logs (no 404s)
- [ ] Check Firebase Analytics (no spike in errors)
- [ ] Monitor for 15 minutes (check for user reports)

---

## 🎯 Quick Reference - Common Patterns

### Pattern 1: Load Election & Display
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

### Pattern 2: Vote Confirmation Modal
```javascript
import { showModal } from './components/modal.js';
import { escapeHTML } from './utils/format.js';

function showConfirmationModal(answer) {
  const modal = showModal({
    title: R.string.confirm_vote_title,
    content: `
      <p>${R.string.confirm_vote_message}</p>
      <p class="modal__selected-answer">
        <strong>${R.string.your_answer}:</strong> ${escapeHTML(answer.text)}
      </p>
    `,
    buttons: [
      {
        text: R.string.btn_cancel,
        onClick: () => modal.close(),
        primary: false
      },
      {
        text: R.string.btn_confirm,
        onClick: () => {
          modal.close();
          submitVote(answer.id);
        },
        primary: true
      }
    ],
    size: 'md'
  });
}
```

### Pattern 3: Status Badge Display
```javascript
import { createStatusBadge } from './components/badge.js';

function displayStatus(election) {
  const statusContainer = document.getElementById('status');

  // Clear existing
  statusContainer.innerHTML = '';

  // Create badge
  const badge = createStatusBadge(election.status);  // 'active', 'closed', 'upcoming'
  statusContainer.appendChild(badge);
}
```

### Pattern 4: Voting Form with Confirmation
```javascript
import { createVotingForm } from './components/voting-form.js';
import { showModal } from './components/modal.js';
import { escapeHTML } from './utils/format.js';
import { R } from '../i18n/strings-loader.js';

// 1. Create voting form
const votingForm = createVotingForm({
  question: election.question,
  answers: election.answers,
  questionLabel: R.string.election_question_label,
  votingTitle: R.string.voting_select_answer,
  voteButtonText: R.string.btn_vote,

  // 2. Handle submission with confirmation
  onSubmit: (answerId) => {
    const selectedAnswer = election.answers.find(a => a.id === answerId);

    // Show confirmation modal
    const modal = showModal({
      title: R.string.confirm_vote_title,
      content: `
        <p>${R.string.confirm_vote_message}</p>
        <p class="modal__selected-answer">
          <strong>${R.string.your_answer}:</strong> ${escapeHTML(selectedAnswer.text)}
        </p>
      `,
      buttons: [
        {
          text: R.string.btn_cancel,
          onClick: () => modal.close(),
          primary: false
        },
        {
          text: R.string.btn_confirm,
          onClick: async () => {
            modal.close();

            // Show loading on form
            votingForm.showLoading(R.string.submitting_vote);

            try {
              await submitVoteAPI(election.id, answerId);
              showToast(R.string.vote_submitted_success, 'success');
              votingForm.disable();  // Prevent re-voting
            } catch (error) {
              showToast(R.string.vote_submit_error, 'error');
              votingForm.hideLoading();
            }
          },
          primary: true
        }
      ],
      size: 'md'
    });
  }
});

// 3. Add to page
container.appendChild(votingForm.element);
```

### Pattern 5: Election Schedule Display (Member View)
```javascript
import { electionState } from './utils/election-state.js';
import { createScheduleDisplay } from './components/schedule-display.js';
import { R } from '../i18n/strings-loader.js';

// 1. Initialize election state (ONCE per page)
electionState.initialize(election);

// 2. Create schedule display
const scheduleDisplay = createScheduleDisplay({
  startLabel: R.string.election_starts,
  endLabel: R.string.election_ends,
  showCountdown: true
});

// 3. Add to page
const container = document.getElementById('schedule-container');
container.appendChild(scheduleDisplay.element);

// Component automatically:
// - Shows status emoji (🔴 upcoming, 🟢 active, ⚫ closed)
// - Displays start/end times in Icelandic format
// - Shows live countdown when election is active
// - Auto-updates when state changes
```

### Pattern 6: Admin Election Control Panel
```javascript
import { electionState } from './utils/election-state.js';
import { createScheduleControl } from './components/schedule-control.js';
import { createScheduleDisplay } from './components/schedule-display.js';
import { updateElectionAPI } from './api/elections-api.js';
import { showToast } from './components/toast.js';

// 1. Initialize election state
electionState.initialize(election);

// 2. Create admin control panel
const control = createScheduleControl({
  electionId: election.id,

  onStarted: async (state) => {
    try {
      await updateElectionAPI(election.id, {
        status: 'active',
        voting_starts_at: state.voting_starts_at,
        voting_ends_at: state.voting_ends_at
      });
      showToast('Kosning byrjuð!', 'success');
    } catch (error) {
      showToast('Villa kom upp', 'error');
    }
  },

  onClosed: async (state) => {
    try {
      await updateElectionAPI(election.id, { status: 'closed' });
      showToast('Kosningu lokað!', 'success');
    } catch (error) {
      showToast('Villa kom upp', 'error');
    }
  },

  onScheduled: async (state) => {
    try {
      await updateElectionAPI(election.id, {
        voting_starts_at: state.voting_starts_at,
        voting_ends_at: state.voting_ends_at
      });
      showToast('Kosning áætluð!', 'success');
    } catch (error) {
      showToast('Villa kom upp', 'error');
    }
  }
});

document.getElementById('control-container').appendChild(control.element);

// 3. Create member preview (optional)
const preview = createScheduleDisplay({
  startLabel: R.string.election_starts,
  endLabel: R.string.election_ends,
  showCountdown: true
});

document.getElementById('preview-container').appendChild(preview.element);

// Both components sync automatically via electionState!
```

### Pattern 7: Custom Event Listeners on Election State
```javascript
import { electionState } from './utils/election-state.js';

// Initialize
electionState.initialize(election);

// Listen to status changes
electionState.addEventListener('status-changed', (event) => {
  const { oldStatus, newStatus } = event.detail;

  if (newStatus === 'active') {
    showNotification('Kosning er nú opin!');
    enableVotingButton();
  } else if (newStatus === 'closed') {
    showNotification('Kosningu lokið');
    disableVotingButton();
  }
});

// Listen to countdown (every second when active)
electionState.addEventListener('countdown-tick', (event) => {
  const { minutes, humanReadable } = event.detail;

  // Show warning at 5 minutes
  if (minutes === 5) {
    showNotification('5 mínútur eftir!', 'warning');
  }

  // Update custom UI
  updateCustomCountdown(humanReadable);
});

// Listen to schedule changes
electionState.addEventListener('schedule-changed', (event) => {
  const { voting_starts_at, voting_ends_at } = event.detail;
  console.log('Schedule updated:', voting_starts_at, voting_ends_at);
});
```

---

**Last Updated:** Nov 6, 2025 (v2.0)
**Maintained By:** Development Team
**Questions?** See [Component Library README](/js/components/README.md)
