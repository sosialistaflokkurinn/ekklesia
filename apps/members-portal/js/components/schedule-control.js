/**
 * Schedule Control Component (Admin View)
 *
 * Interactive election schedule controls with:
 * - Status display with countdown
 * - "Start Now" instant launch
 * - Scheduled start with date/time picker
 * - Duration presets (15, 30, 60 minutes, custom)
 * - "Close Now" immediate closure
 *
 * Syncs with electionState and updates member views in real-time.
 *
 * Usage:
 *   import { createScheduleControl } from './components/schedule-control.js';
 *
 *   const control = createScheduleControl({
 *     electionId: '123',
 *     onStarted: (state) => { ... },
 *     onClosed: (state) => { ... }
 *   });
 *
 *   container.appendChild(control.element);
 */

import { formatDateIcelandic } from '../utils/format.js';
import { createCountdownTimer } from './countdown-timer.js';
import { electionState } from '../utils/election-state.js';
import { debug } from '../utils/debug.js';
import { escapeHTML } from '../utils/format.js';

/**
 * Duration presets in minutes
 */
const DURATION_PRESETS = [
  { value: 15, label: '15 mínútur' },
  { value: 30, label: '30 mínútur' },
  { value: 60, label: '1 klukkustund' },
  { value: 90, label: '1,5 klukkustund' },
  { value: 120, label: '2 klukkustundir' },
  { value: 'custom', label: 'Sérsníða' }
];

/**
 * Create schedule control element
 * @param {Object} options - Control options
 * @param {string} options.electionId - Election ID
 * @param {Function} options.onStarted - Callback when election is started
 * @param {Function} options.onClosed - Callback when election is closed
 * @param {Function} options.onScheduled - Callback when election is scheduled
 * @returns {Object} Control instance with element and methods
 */
export function createScheduleControl(options = {}) {
  const {
    electionId,
    onStarted = () => {},
    onClosed = () => {},
    onScheduled = () => {}
  } = options;

  if (!electionId) {
    throw new Error('createScheduleControl: electionId is required');
  }

  // Create main container
  const container = document.createElement('div');
  container.className = 'schedule-control';

  // Create sections
  const statusSection = createStatusSection();
  const startNowSection = createStartNowSection();
  const scheduleSection = createScheduleSection();
  const closeSection = createCloseSection();

  container.appendChild(statusSection.element);
  container.appendChild(startNowSection.element);
  container.appendChild(scheduleSection.element);
  container.appendChild(closeSection.element);

  // Countdown timer instance
  let countdownTimer = null;

  /**
   * Create status section
   */
  function createStatusSection() {
    const section = document.createElement('div');
    section.className = 'schedule-control__status';

    const emoji = document.createElement('span');
    emoji.className = 'schedule-control__status-emoji';
    emoji.setAttribute('role', 'img');

    const text = document.createElement('span');
    text.className = 'schedule-control__status-text';

    const countdown = document.createElement('div');
    countdown.className = 'schedule-control__countdown u-hidden';

    section.appendChild(emoji);
    section.appendChild(text);
    section.appendChild(countdown);

    return {
      element: section,
      emoji,
      text,
      countdown
    };
  }

  /**
   * Create "Start Now" section
   */
  function createStartNowSection() {
    const section = document.createElement('div');
    section.className = 'schedule-control__section';

    const heading = document.createElement('h3');
    heading.className = 'schedule-control__heading';
    heading.innerHTML = '⚡ Byrja núna';

    const description = document.createElement('p');
    description.className = 'schedule-control__description';
    description.textContent = 'Opna kosningu strax og velja tímalengd';

    // Duration selector
    const durationGroup = document.createElement('div');
    durationGroup.className = 'schedule-control__duration-group';

    const durationLabel = document.createElement('label');
    durationLabel.className = 'schedule-control__label';
    durationLabel.textContent = 'Tímalengd:';

    const durationButtons = document.createElement('div');
    durationButtons.className = 'schedule-control__duration-buttons';

    let selectedDuration = 60; // Default 1 hour

    DURATION_PRESETS.forEach(preset => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'schedule-control__duration-btn';
      button.textContent = preset.label;
      button.dataset.value = preset.value;

      if (preset.value === selectedDuration) {
        button.classList.add('schedule-control__duration-btn--active');
      }

      button.addEventListener('click', () => {
        // Remove active from all buttons
        durationButtons.querySelectorAll('.schedule-control__duration-btn').forEach(b => {
          b.classList.remove('schedule-control__duration-btn--active');
        });

        // Add active to clicked button
        button.classList.add('schedule-control__duration-btn--active');

        if (preset.value === 'custom') {
          // Show custom input
          customInput.classList.remove('u-hidden');
          selectedDuration = parseInt(customInput.value) || 60;
        } else {
          customInput.classList.add('u-hidden');
          selectedDuration = preset.value;
        }
      });

      durationButtons.appendChild(button);
    });

    // Custom duration input
    const customInput = document.createElement('input');
    customInput.type = 'number';
    customInput.min = '1';
    customInput.max = '480';
    customInput.value = '60';
    customInput.className = 'schedule-control__custom-input u-hidden';
    customInput.placeholder = 'Mínútur';

    customInput.addEventListener('input', () => {
      selectedDuration = parseInt(customInput.value) || 60;
    });

    durationGroup.appendChild(durationLabel);
    durationGroup.appendChild(durationButtons);
    durationGroup.appendChild(customInput);

    // Start button
    const startButton = document.createElement('button');
    startButton.type = 'button';
    startButton.className = 'btn btn--primary schedule-control__action-btn';
    startButton.innerHTML = '🚀 Byrja kosningu núna';

    startButton.addEventListener('click', async () => {
      startButton.disabled = true;
      startButton.textContent = 'Byrjar...';

      try {
        await electionState.startNow(selectedDuration);
        onStarted(electionState.getState());
      } catch (error) {
        debug.error('Failed to start election:', error);
        alert('Villa kom upp við að byrja kosningu: ' + error.message);
      } finally {
        startButton.disabled = false;
        startButton.innerHTML = '🚀 Byrja kosningu núna';
      }
    });

    section.appendChild(heading);
    section.appendChild(description);
    section.appendChild(durationGroup);
    section.appendChild(startButton);

    return {
      element: section,
      startButton,
      getDuration: () => selectedDuration
    };
  }

  /**
   * Create scheduled start section
   */
  function createScheduleSection() {
    const section = document.createElement('div');
    section.className = 'schedule-control__section';

    const heading = document.createElement('h3');
    heading.className = 'schedule-control__heading';
    heading.innerHTML = '🕐 Áætla kosningu';

    const description = document.createElement('p');
    description.className = 'schedule-control__description';
    description.textContent = 'Velja hvenær kosning byrjar og tímalengd';

    // Date/time inputs
    const scheduleInputs = document.createElement('div');
    scheduleInputs.className = 'schedule-control__inputs';

    const dateLabel = document.createElement('label');
    dateLabel.className = 'schedule-control__label';
    dateLabel.textContent = 'Byrjar:';

    const dateInput = document.createElement('input');
    dateInput.type = 'datetime-local';
    dateInput.className = 'schedule-control__input';

    // Set default to now + 1 hour
    const defaultStart = new Date();
    defaultStart.setHours(defaultStart.getHours() + 1);
    dateInput.value = formatDateTimeLocal(defaultStart);

    const durationLabel = document.createElement('label');
    durationLabel.className = 'schedule-control__label';
    durationLabel.textContent = 'Tímalengd (mínútur):';

    const durationInput = document.createElement('input');
    durationInput.type = 'number';
    durationInput.min = '1';
    durationInput.max = '480';
    durationInput.value = '60';
    durationInput.className = 'schedule-control__input';

    scheduleInputs.appendChild(dateLabel);
    scheduleInputs.appendChild(dateInput);
    scheduleInputs.appendChild(durationLabel);
    scheduleInputs.appendChild(durationInput);

    // Schedule button
    const scheduleButton = document.createElement('button');
    scheduleButton.type = 'button';
    scheduleButton.className = 'btn schedule-control__action-btn';
    scheduleButton.innerHTML = '📅 Áætla kosningu';

    scheduleButton.addEventListener('click', async () => {
      const startDate = new Date(dateInput.value);
      const duration = parseInt(durationInput.value) || 60;

      if (!dateInput.value || isNaN(startDate.getTime())) {
        alert('Vinsamlegast veldu gildan dagsetningu og tíma');
        return;
      }

      scheduleButton.disabled = true;
      scheduleButton.textContent = 'Áætlar...';

      try {
        await electionState.updateSchedule({
          startDate,
          durationMinutes: duration
        });

        onScheduled(electionState.getState());
        alert('Kosning áætluð fyrir: ' + formatDateIcelandic(startDate));
      } catch (error) {
        debug.error('Failed to schedule election:', error);
        alert('Villa kom upp við að áætla kosningu: ' + error.message);
      } finally {
        scheduleButton.disabled = false;
        scheduleButton.innerHTML = '📅 Áætla kosningu';
      }
    });

    section.appendChild(heading);
    section.appendChild(description);
    section.appendChild(scheduleInputs);
    section.appendChild(scheduleButton);

    return {
      element: section,
      scheduleButton
    };
  }

  /**
   * Create close section
   */
  function createCloseSection() {
    const section = document.createElement('div');
    section.className = 'schedule-control__section schedule-control__section--close u-hidden';

    const heading = document.createElement('h3');
    heading.className = 'schedule-control__heading schedule-control__heading--danger';
    heading.innerHTML = '🛑 Loka kosningu';

    const description = document.createElement('p');
    description.className = 'schedule-control__description';
    description.textContent = 'Loka kosningu strax og útiloka frekari atkvæðagreiðslu';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn btn--danger schedule-control__action-btn';
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

    section.appendChild(heading);
    section.appendChild(description);
    section.appendChild(closeButton);

    return {
      element: section,
      closeButton
    };
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
      startNowSection.element.classList.remove('u-hidden');
      scheduleSection.element.classList.remove('u-hidden');
      closeSection.element.classList.add('u-hidden');
      statusSection.countdown.classList.add('u-hidden');
    } else if (status === 'active') {
      startNowSection.element.classList.add('u-hidden');
      scheduleSection.element.classList.add('u-hidden');
      closeSection.element.classList.remove('u-hidden');
      // Countdown will be shown by showCountdown()
    } else if (status === 'closed') {
      startNowSection.element.classList.add('u-hidden');
      scheduleSection.element.classList.add('u-hidden');
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
    destroy
  };
}

/**
 * Format date for datetime-local input
 * @param {Date} date - Date to format
 * @returns {string} Formatted as "YYYY-MM-DDTHH:MM"
 */
function formatDateTimeLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
