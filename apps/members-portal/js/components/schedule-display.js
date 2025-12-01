/**
 * Schedule Display Component (Member View)
 *
 * Read-only display of election schedule with:
 * - Status indicator (🔴 🟢 ⚫)
 * - Start/end dates
 * - Countdown timer (if active)
 *
 * Automatically syncs with electionState changes.
 *
 * Usage:
 *   import { createScheduleDisplay } from './components/schedule-display.js';
 *   import { electionState } from './utils/election-state.js';
 *
 *   const display = createScheduleDisplay({
 *     startLabel: R.string.election_starts,
 *     endLabel: R.string.election_ends
 *   });
 *
 *   container.appendChild(display.element);
 *   electionState.initialize(election);
 */

import { formatDateIcelandic } from '../utils/format.js';
import { createCountdownTimer } from './countdown-timer.js';
import { electionState } from '../utils/election-state.js';
import { debug } from '../utils/debug.js';
import { R } from '../../i18n/strings-loader.js';
import { el } from '../utils/dom.js';

/**
 * Status emoji mapping
 */
const STATUS_EMOJI = {
  upcoming: '🔴',
  active: '🟢',
  closed: '⚫'
};

/**
 * Create schedule display element
 * @param {Object} options - Display options
 * @param {string} options.startLabel - Label for start time
 * @param {string} options.endLabel - Label for end time
 * @param {boolean} options.showCountdown - Show countdown timer when active (default: true)
 * @returns {Object} Display instance with element and update methods
 */
export function createScheduleDisplay(options = {}) {
  const {
    startLabel = 'Kosning hefst',
    endLabel = 'Kosning lýkur',
    showCountdown = true
  } = options;

  // Status indicator (top of info section)
  const statusEmoji = el('span', 'schedule-display__status-emoji', {
    role: 'img',
    'aria-label': 'Status'
  });
  const statusText = el('span', 'schedule-display__status-text');

  const statusContainer = el('div', 'schedule-display__status', {},
    statusEmoji,
    statusText
  );

  // Schedule grid
  const startValue = el('span', 'election-detail__schedule-value');
  const startItem = el('div', 'election-detail__schedule-item', {},
    el('span', 'election-detail__schedule-label', {}, startLabel),
    startValue
  );

  const endValue = el('span', 'election-detail__schedule-value');
  const endItem = el('div', 'election-detail__schedule-item', {},
    el('span', 'election-detail__schedule-label', {}, endLabel),
    endValue
  );

  const scheduleGrid = el('div', 'election-detail__schedule', {},
    startItem,
    endItem
  );

  // Countdown container (shown only when active)
  const countdownContainer = el('div', 'schedule-display__countdown u-hidden');

  // Create container
  const container = el('div', 'election-detail__info', {},
    statusContainer,
    scheduleGrid,
    countdownContainer
  );

  // Countdown timer instance
  let countdownTimer = null;

  /**
   * Update status display
   * @param {string} status - Election status
   */
  function updateStatus(status) {
    statusEmoji.textContent = STATUS_EMOJI[status] || '⚪';

    const statusLabels = {
      upcoming: 'Hefur ekki byrjað',
      active: 'Kosning í gangi',
      closed: 'Kosningu lokið'
    };

    statusText.textContent = statusLabels[status] || 'Óþekkt staða';

    // Update status container class
    statusContainer.className = `schedule-display__status schedule-display__status--${status}`;

    debug.log('Schedule display status updated:', status);
  }

  /**
   * Update schedule times
   * @param {Object} state - Election state
   */
  function updateSchedule(state) {
    if (state.voting_starts_at) {
      startValue.textContent = formatDateIcelandic(state.voting_starts_at);
    }

    if (state.voting_ends_at) {
      endValue.textContent = formatDateIcelandic(state.voting_ends_at);
    }

    debug.log('Schedule display times updated');
  }

  /**
   * Show countdown timer
   * @param {string} endDate - End date/time
   */
  function showCountdownTimer(endDate) {
    if (!showCountdown) return;

    // Remove existing timer
    if (countdownTimer) {
      countdownTimer.destroy();
      countdownTimer = null;
    }

    // Create new timer
    countdownTimer = createCountdownTimer({
      endDate: endDate,
      onComplete: () => {
        // Election ended
        updateStatus('closed');
        hideCountdownTimer();
      }
    });

    // Add to container
    countdownContainer.innerHTML = '';
    countdownContainer.appendChild(countdownTimer.element);
    countdownContainer.classList.remove('u-hidden');

    debug.log('Countdown timer shown');
  }

  /**
   * Hide countdown timer
   */
  function hideCountdownTimer() {
    if (countdownTimer) {
      countdownTimer.destroy();
      countdownTimer = null;
    }

    countdownContainer.classList.add('u-hidden');
    debug.log('Countdown timer hidden');
  }

  /**
   * Handle status change event
   */
  function handleStatusChange(event) {
    const { newStatus, state } = event.detail;

    updateStatus(newStatus);

    // Show/hide countdown based on status
    if (newStatus === 'active' && state.voting_ends_at) {
      showCountdownTimer(state.voting_ends_at);
    } else {
      hideCountdownTimer();
    }
  }

  /**
   * Handle schedule change event
   */
  function handleScheduleChange(event) {
    updateSchedule(event.detail);

    // Update countdown if active
    const state = electionState.getState();
    if (state.status === 'active' && state.voting_ends_at) {
      if (countdownTimer) {
        countdownTimer.reset(state.voting_ends_at);
      } else {
        showCountdownTimer(state.voting_ends_at);
      }
    }
  }

  /**
   * Handle initialization event
   */
  function handleInitialized(event) {
    const state = event.detail;

    updateStatus(state.status);
    updateSchedule(state);

    // Show countdown if active
    if (state.status === 'active' && state.voting_ends_at) {
      showCountdownTimer(state.voting_ends_at);
    }
  }

  /**
   * Initialize with current state
   */
  function initialize() {
    const state = electionState.getState();

    if (state.id) {
      updateStatus(state.status);
      updateSchedule(state);

      if (state.status === 'active' && state.voting_ends_at) {
        showCountdownTimer(state.voting_ends_at);
      }
    }

    // Listen to state changes
    electionState.addEventListener('initialized', handleInitialized);
    electionState.addEventListener('status-changed', handleStatusChange);
    electionState.addEventListener('schedule-changed', handleScheduleChange);

    debug.log('Schedule display initialized');
  }

  /**
   * Cleanup and remove event listeners
   */
  function destroy() {
    electionState.removeEventListener('initialized', handleInitialized);
    electionState.removeEventListener('status-changed', handleStatusChange);
    electionState.removeEventListener('schedule-changed', handleScheduleChange);

    if (countdownTimer) {
      countdownTimer.destroy();
      countdownTimer = null;
    }

    container.remove();
    debug.log('Schedule display destroyed');
  }

  // Auto-initialize
  initialize();

  return {
    element: container,
    update: initialize,
    destroy
  };
}
