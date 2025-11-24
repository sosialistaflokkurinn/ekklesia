# Election Feature Components Checklist

**Purpose:** Component usage guidelines and integration patterns
**Part of:** [Election Feature Development Guide](./OVERVIEW.md)
**Last Updated:** 2025-11-24

---

## 🎨 Component Overview

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

## 🪟 Modal Component

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

## ⏳ Loading State Component

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

## ❌ Error State Component

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

## 🏷️ Badge Component

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

## 📇 Card Component

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

## 🗳️ Voting Form Component

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

## 📅 Schedule Display Component (Member View)

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

## ⚙️ Schedule Control Component (Admin View)

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

## 🔄 Election State Manager

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

## ⏱️ Countdown Timer Component

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

## 📚 Reference

### Component Documentation
- **Component Library README:** [apps/members-portal/js/components/README.md](../../../../apps/members-portal/js/components/README.md)
- **Utilities README:** Available in component source files

### Related Checklists
- [i18n Checklist](./i18n-checklist.md) - All components use i18n strings
- [Accessibility](./accessibility-checklist.md) - Component accessibility features
- [Testing](./testing-checklist.md) - Component testing
- [Overview](./OVERVIEW.md) - Back to main guide

---

**Last Updated:** 2025-11-24
**Maintained By:** Development Team
