/**
 * Schedule Control Component (Admin View)
 *
 * Simplified election status display:
 * - Status indicator (upcoming/active/closed)
 * - Countdown timer (when active)
 * - Vote count display
 * - Close button (when active)
 *
 * Elections are opened from the elections list, not from this control.
 *
 * Usage:
 *   import { createScheduleControl } from './components/schedule-control.js';
 *
 *   const control = createScheduleControl({
 *     electionId: '123',
 *     voteCount: 5,
 *     onClosed: (state) => { ... }
 *   });
 *
 *   container.appendChild(control.element);
 */

import { createCountdownTimer } from './countdown-timer.js';
import { electionState } from '../utils/election-state.js';
import { debug } from '../utils/debug.js';
import { el } from '../utils/dom.js';

/**
 * Create schedule control element
 * @param {Object} options - Control options
 * @param {string} options.electionId - Election ID
 * @param {number} options.voteCount - Current vote count
 * @param {Function} options.onClosed - Callback when election is closed
 * @returns {Object} Control instance with element and methods
 */
export function createScheduleControl(options = {}) {
  const {
    electionId,
    voteCount = 0,
    onClosed = () => {}
  } = options;

  if (!electionId) {
    throw new Error('createScheduleControl: electionId is required');
  }

  // Track current vote count
  let currentVoteCount = voteCount;

  // Create sections
  const statusSection = createStatusSection();
  const infoSection = createInfoSection();
  const voteCountSection = createVoteCountSection();
  const closeSection = createCloseSection();

  // Create main container
  const container = el('div', 'schedule-control', {},
    statusSection.element,
    infoSection.element,
    voteCountSection.element,
    closeSection.element
  );

  // Countdown timer instance
  let countdownTimer = null;

  /**
   * Create status section
   */
  function createStatusSection() {
    const emoji = el('span', 'schedule-control__status-emoji', { role: 'img' });
    const text = el('span', 'schedule-control__status-text');
    const countdown = el('div', 'schedule-control__countdown u-hidden');

    const section = el('div', 'schedule-control__status', {},
      emoji,
      text,
      countdown
    );

    return {
      element: section,
      emoji,
      text,
      countdown
    };
  }

  /**
   * Create info section (shown when election hasn't started)
   */
  function createInfoSection() {
    const message = el('p', 'schedule-control__info', {},
      'Opnaðu kosningu frá kosningalistanum'
    );

    const section = el('div', 'schedule-control__section schedule-control__section--info', {},
      message
    );

    return {
      element: section,
      message
    };
  }

  /**
   * Create vote count section
   */
  function createVoteCountSection() {
    const icon = el('span', 'schedule-control__vote-icon', {}, '🗳️');
    const count = el('span', 'schedule-control__vote-count', {}, String(currentVoteCount));
    const label = el('span', 'schedule-control__vote-label', {}, ' atkvæði komin');

    const section = el('div', 'schedule-control__section schedule-control__section--votes u-hidden', {},
      icon,
      count,
      label
    );

    return {
      element: section,
      count
    };
  }

  /**
   * Create close section
   */
  function createCloseSection() {
    const heading = el('h3', 'schedule-control__heading schedule-control__heading--danger');
    heading.innerHTML = '🛑 Loka kosningu';

    const description = el('p', 'schedule-control__description', {}, 'Loka kosningu strax og útiloka frekari atkvæðagreiðslu');

    const closeButton = el('button', 'btn btn--danger schedule-control__action-btn', { type: 'button' });
    closeButton.innerHTML = '🔒 Loka kosningu núna';

    closeButton.addEventListener('click', async () => {
      if (!confirm('Ertu viss um að þú viljir loka þessari kosningu núna?\n\nEngin frekari atkvæði verða leyfð.')) {
        return;
      }

      closeButton.disabled = true;
      closeButton.textContent = 'Lokar...';

      try {
        await electionState.closeNow();
        onClosed(electionState.getState());
      } catch (error) {
        debug.error('Failed to close election:', error);
        alert('Villa kom upp við að loka kosningu: ' + error.message);
      } finally {
        closeButton.disabled = false;
        closeButton.innerHTML = '🔒 Loka kosningu núna';
      }
    });

    const section = el('div', 'schedule-control__section schedule-control__section--close u-hidden', {},
      heading,
      description,
      closeButton
    );

    return {
      element: section,
      closeButton
    };
  }

  /**
   * Update vote count display
   * @param {number} count - New vote count
   */
  function updateVoteCount(count) {
    currentVoteCount = count;
    voteCountSection.count.textContent = String(count);
  }

  /**
   * Update UI based on status
   */
  function updateUI(status) {
    // Update status display
    const statusEmojis = {
      upcoming: '🔴',
      active: '🟢',
      closed: '⚫'
    };

    const statusTexts = {
      upcoming: 'HEFUR EKKI BYRJAÐ',
      active: 'KOSNING Í GANGI',
      closed: 'KOSNINGU LOKIÐ'
    };

    statusSection.emoji.textContent = statusEmojis[status] || '⚪';
    statusSection.text.textContent = statusTexts[status] || 'ÓÞEKKT STAÐA';
    statusSection.element.className = `schedule-control__status schedule-control__status--${status}`;

    // Show/hide sections based on status
    if (status === 'upcoming') {
      infoSection.element.classList.remove('u-hidden');
      voteCountSection.element.classList.add('u-hidden');
      closeSection.element.classList.add('u-hidden');
      statusSection.countdown.classList.add('u-hidden');
    } else if (status === 'active') {
      infoSection.element.classList.add('u-hidden');
      voteCountSection.element.classList.remove('u-hidden');
      closeSection.element.classList.remove('u-hidden');
      // Countdown will be shown by showCountdown()
    } else if (status === 'closed') {
      infoSection.element.classList.add('u-hidden');
      voteCountSection.element.classList.remove('u-hidden');
      closeSection.element.classList.add('u-hidden');
      statusSection.countdown.classList.add('u-hidden');
    }

    debug.log('Schedule control UI updated for status:', status);
  }

  /**
   * Show countdown
   */
  function showCountdown(endDate) {
    // Remove existing timer
    if (countdownTimer) {
      countdownTimer.destroy();
      countdownTimer = null;
    }

    // Create new timer
    countdownTimer = createCountdownTimer({
      endDate: endDate,
      onComplete: () => {
        electionState.updateStatus('closed');
      }
    });

    statusSection.countdown.innerHTML = '';
    statusSection.countdown.appendChild(countdownTimer.element);
    statusSection.countdown.classList.remove('u-hidden');

    debug.log('Countdown shown in control panel');
  }

  /**
   * Handle status change
   */
  function handleStatusChange(event) {
    const { newStatus, state } = event.detail;
    updateUI(newStatus);

    if (newStatus === 'active' && state.voting_ends_at) {
      showCountdown(state.voting_ends_at);
    }
  }

  /**
   * Handle initialization
   */
  function handleInitialized(event) {
    const state = event.detail;
    updateUI(state.status);

    if (state.status === 'active' && state.voting_ends_at) {
      showCountdown(state.voting_ends_at);
    }
  }

  /**
   * Initialize
   */
  function initialize() {
    const state = electionState.getState();

    if (state.id) {
      updateUI(state.status);

      if (state.status === 'active' && state.voting_ends_at) {
        showCountdown(state.voting_ends_at);
      }
    }

    // Listen to events
    electionState.addEventListener('initialized', handleInitialized);
    electionState.addEventListener('status-changed', handleStatusChange);

    debug.log('Schedule control initialized');
  }

  /**
   * Destroy and cleanup
   */
  function destroy() {
    electionState.removeEventListener('initialized', handleInitialized);
    electionState.removeEventListener('status-changed', handleStatusChange);

    if (countdownTimer) {
      countdownTimer.destroy();
      countdownTimer = null;
    }

    container.remove();
    debug.log('Schedule control destroyed');
  }

  // Auto-initialize
  initialize();

  return {
    element: container,
    destroy,
    updateVoteCount
  };
}
