# Election Feature Development - Overview

**Purpose:** Comprehensive guide for implementing election-related features
**Status:** ✅ Active
**Last Updated:** 2025-11-24 (v4.0 - Split into focused checklists)
**Related:** Component Library (Epic #191), i18n System, Real-time Election State, Epic #186

---

## 📋 Overview

This guide provides comprehensive checklists for implementing election features in the Ekklesia members portal. The guide has been split into **6 focused checklists** to improve usability and reduce cognitive load.

**Original file:** 1,441 lines, 198 TODOs → **Now:** 6 focused files (~200-400 lines each)

---

## 📚 Focused Checklists

### 1. [i18n Checklist](./i18n-checklist.md) 🌍
**Purpose:** Internationalization requirements
**TODOs:** ~25 items
**Focus:** String management, i18n testing, common issues

**When to use:** Before starting any frontend work, ensure all user-facing text uses i18n strings.

**Key topics:**
- String naming conventions
- i18n testing procedures
- Common i18n issues & solutions

---

### 2. [Components Checklist](./components-checklist.md) 🎨
**Purpose:** Component usage and integration
**TODOs:** ~50 items
**Focus:** Reusable components, date formatting, state management

**When to use:** When building UI features that use voting forms, modals, badges, or election schedules.

**Key components:**
- Modal, Loading State, Error State
- Badge, Card, Voting Form
- Schedule Display, Schedule Control
- Election State Manager, Countdown Timer
- Date formatting utilities

---

### 3. [Accessibility Checklist](./accessibility-checklist.md) ♿
**Purpose:** WCAG AA compliance and responsive design
**TODOs:** ~30 items
**Focus:** Color contrast, keyboard navigation, screen readers, mobile-first design

**When to use:** Throughout development - accessibility should be built in, not bolted on.

**Key topics:**
- WCAG AA requirements
- Responsive design patterns
- Typography and spacing standards
- Accessibility testing procedures

---

### 4. [Backend Checklist](./backend-checklist.md) 🔧
**Purpose:** Backend API and data model requirements
**TODOs:** ~40 items
**Focus:** Data models, security, authentication, state management

**When to use:** When defining data structures, integrating with APIs, or implementing state machines.

**Key topics:**
- Data model planning
- Security and validation
- Authentication patterns
- Election state machine
- API integration patterns

---

### 5. [Testing Checklist](./testing-checklist.md) 🧪
**Purpose:** Testing and code quality standards
**TODOs:** ~35 items
**Focus:** Manual testing, code quality, security validation

**When to use:** Throughout development and before deployment.

**Key topics:**
- Manual testing procedures
- Functionality testing
- Accessibility testing
- Code quality standards
- Security validation

---

### 6. [Deployment Checklist](./deployment-checklist.md) 🚀
**Purpose:** Pre-deployment and performance optimization
**TODOs:** ~18 items
**Focus:** Performance, pre-deployment verification, debugging

**When to use:** Before committing code and before deploying to production.

**Key topics:**
- Performance optimization
- Pre-deployment checklist
- Debugging common issues
- Git commit conventions

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
    await R.load('is');
    await initAuthenticatedPage();
    const electionId = getElectionIdFromURL();
    await loadElection(electionId);
  } catch (error) {
    debug.error('Error initializing:', error);
  }
}

async function loadElection(id) {
  const container = document.getElementById('election-content');
  showLoadingIn(container, R.string.loading_election);

  try {
    const election = await getElectionById(id);
    hideLoadingIn(container);
    displayElection(election);
  } catch (error) {
    hideLoadingIn(container);
    showErrorIn(container, R.string.error_load_election, () => loadElection(id));
  }
}

document.addEventListener('DOMContentLoaded', init);
```

---

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

---

### Pattern 3: Voting Form with Confirmation

```javascript
import { createVotingForm } from './components/voting-form.js';
import { showModal } from './components/modal.js';
import { escapeHTML } from './utils/format.js';
import { R } from '../i18n/strings-loader.js';

const votingForm = createVotingForm({
  question: election.question,
  answers: election.answers,
  questionLabel: R.string.election_question_label,
  votingTitle: R.string.voting_select_answer,
  voteButtonText: R.string.btn_vote,

  onSubmit: (answerIds) => {
    const selectedAnswer = election.answers.find(a => a.id === answerIds[0]);
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
            votingForm.showLoading(R.string.submitting_vote);

            try {
              await submitVoteAPI(election.id, answerIds[0]);
              showToast(R.string.vote_submitted_success, 'success');
              votingForm.disable();
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

container.appendChild(votingForm.element);
```

---

### Pattern 4: Election Schedule Display (Member View)

```javascript
import { electionState } from './utils/election-state.js';
import { createScheduleDisplay } from './components/schedule-display.js';
import { R } from '../i18n/strings-loader.js';

// Initialize election state (ONCE per page)
electionState.initialize(election);

// Create schedule display
const scheduleDisplay = createScheduleDisplay({
  startLabel: R.string.election_starts,
  endLabel: R.string.election_ends,
  showCountdown: true
});

container.appendChild(scheduleDisplay.element);

// Component automatically:
// - Shows status emoji (🔴 upcoming, 🟢 active, ⚫ closed)
// - Displays start/end times in Icelandic format
// - Shows live countdown when election is active
```

---

### Pattern 5: Admin Election Control Panel

```javascript
import { electionState } from './utils/election-state.js';
import { createScheduleControl } from './components/schedule-control.js';
import { updateElectionAPI } from './api/elections-api.js';
import { showToast } from './components/toast.js';

electionState.initialize(election);

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
```

---

### Pattern 6: Custom Event Listeners on Election State

```javascript
import { electionState } from './utils/election-state.js';

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

  if (minutes === 5) {
    showNotification('5 mínútur eftir!', 'warning');
  }
});
```

---

## 📊 Progress Tracking

Use this checklist to track your progress through the implementation:

- [ ] **Phase 1: Planning**
  - [ ] Review [Backend Checklist](./backend-checklist.md) - Define data models
  - [ ] Review [i18n Checklist](./i18n-checklist.md) - Plan string keys
  - [ ] Review [Accessibility Checklist](./accessibility-checklist.md) - Identify requirements

- [ ] **Phase 2: Implementation**
  - [ ] Follow [Components Checklist](./components-checklist.md) - Build UI
  - [ ] Follow [Backend Checklist](./backend-checklist.md) - Integrate APIs
  - [ ] Follow [i18n Checklist](./i18n-checklist.md) - Add strings

- [ ] **Phase 3: Testing**
  - [ ] Complete [Testing Checklist](./testing-checklist.md) - Verify functionality
  - [ ] Complete [Accessibility Checklist](./accessibility-checklist.md) - WCAG AA audit

- [ ] **Phase 4: Deployment**
  - [ ] Complete [Deployment Checklist](./deployment-checklist.md) - Pre-deployment verification
  - [ ] Deploy and monitor

---

## 📚 Reference Documentation

### Component Library
- **Modal:** `/js/components/modal.js`
- **Loading State:** `/js/components/loading-state.js`
- **Error State:** `/js/components/error-state.js`
- **Badge:** `/js/components/badge.js`
- **Card:** `/js/components/card.js`
- **Voting Form:** `/js/components/voting-form.js`
- **Schedule Display:** `/js/components/schedule-display.js`
- **Schedule Control:** `/js/components/schedule-control.js`

### Utilities
- **Date Formatting:** `/js/utils/format.js` - `formatDateIcelandic()`
- **HTML Escaping:** `/js/utils/format.js` - `escapeHTML()`
- **Debounce:** `/js/utils/debounce.js`
- **Debug Logging:** `/js/utils/debug.js`
- **Election State:** `/js/utils/election-state.js`

### i18n
- **Strings File:** `/i18n/values-is/strings.xml`
- **Loader:** `/i18n/strings-loader.js`
- **Usage:** `import { R } from '../i18n/strings-loader.js'`

### Styles
- **Global:** `/styles/global.css` - CSS variables, reset
- **Button:** `/styles/components/button.css`
- **Modal:** `/styles/components/modal.css`
- **Voting Form:** `/styles/components/voting-form.css`
- **Countdown Timer:** `/styles/components/countdown-timer.css`

---

## 🎓 For New Developers

**Start here:**
1. Read this overview to understand the structure
2. Review [i18n Checklist](./i18n-checklist.md) first (impacts all work)
3. Skim [Components Checklist](./components-checklist.md) to see available components
4. Read relevant checklists for your specific task

**Tips:**
- Each checklist is self-contained and can be read independently
- Use the quick reference patterns as starting templates
- Check the related checklists links at the bottom of each file
- All checklists use the same component examples for consistency

---

## 📝 Changelog

### v4.0 (2025-11-24) - Split into Focused Checklists
- **Breaking:** Split 1,441-line file into 6 focused checklists
- **Added:** OVERVIEW.md with navigation and quick reference
- **Improved:** Each checklist now 200-400 lines (manageable size)
- **Improved:** Cross-referencing between checklists
- **Result:** 198 TODOs → 6 files with ~25-50 TODOs each

### v3.0 (2025-11-06) - Typography & Multi-Choice Support
- Added typography hierarchy standards
- Added spacing guidelines
- Added multi-choice voting form support

### v2.0 (2025-10-31) - Component Library Integration
- Initial comprehensive checklist
- All reusable components documented

---

## 📞 Questions & Support

**Need help?**
- See [Component Library README](../../../../apps/members-portal/js/components/README.md)
- Check [Code Standards Map](../../../CODE_STANDARDS_MAP.md)
- Review [Development Map](../../../DEVELOPMENT_MAP.md)

**Found an issue?**
- Create a GitHub issue
- Tag with `documentation` label

---

**Last Updated:** 2025-11-24 (v4.0)
**Maintained By:** Development Team
**Original File:** Archived at `archive/election-feature/ELECTION_FEATURE_CHECKLIST_2025-11-24.md`
