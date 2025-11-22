/**
 * Schedule Control Component (Admin View)
 *
 * Interactive election schedule controls with:
 * - Status display with countdown
 * - "Start Now" instant launch
 * - Scheduled start with date/time picker
 * - Duration presets (1, 2, 3 minutes, custom) - aligned with real meeting patterns
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

import { formatDateIcelandic, formatDateTimeLocal } from '../utils/format.js';
import { createCountdownTimer } from './countdown-timer.js';
import { electionState } from '../utils/election-state.js';
import { debug } from '../utils/debug.js';
import { escapeHTML } from '../utils/format.js';
import { 
  DURATION_PRESETS, 
  DEFAULT_DURATION_MINUTES 
} from '../utils/election-constants.js';
import { el } from '../utils/dom.js';

/**
 * Duration presets imported from shared constants
 * Per commit 50cf8d9: Aligned with real meeting patterns (1-3 minutes)
 * See: utils/election-constants.js for full documentation
 */

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

  // Create sections
  const statusSection = createStatusSection();
  const startNowSection = createStartNowSection();
  const scheduleSection = createScheduleSection();
  const closeSection = createCloseSection();

  // Create main container
  const container = el('div', 'schedule-control', {},
    statusSection.element,
    startNowSection.element,
    scheduleSection.element,
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
   * Create "Start Now" section
   */
  function createStartNowSection() {
    const heading = el('h3', 'schedule-control__heading');
    heading.innerHTML = '⚡ Byrja núna';

    const description = el('p', 'schedule-control__description', {}, 'Opna kosningu strax og velja tímalengd');

    // Duration selector
    const durationLabel = el('label', 'schedule-control__label', {}, 'Tímalengd:');
    const durationButtons = el('div', 'schedule-control__duration-buttons');

    // Custom duration input
    const customInput = el('input', 'schedule-control__custom-input u-hidden', {
      type: 'number',
      min: '1',
      max: '480',
      value: String(DEFAULT_DURATION_MINUTES),
      placeholder: 'Mínútur'
    });

    let selectedDuration = DEFAULT_DURATION_MINUTES; // Default from shared constants (2 minutes)

    DURATION_PRESETS.forEach(preset => {
      const button = el('button', 'schedule-control__duration-btn', {
        type: 'button',
        'data-value': preset.value
      }, preset.label);

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
          selectedDuration = parseInt(customInput.value) || DEFAULT_DURATION_MINUTES;
        } else {
          customInput.classList.add('u-hidden');
          selectedDuration = preset.value;
        }
      });

      durationButtons.appendChild(button);
    });

    customInput.addEventListener('input', () => {
      selectedDuration = parseInt(customInput.value) || DEFAULT_DURATION_MINUTES;
    });

    const durationGroup = el('div', 'schedule-control__duration-group', {},
      durationLabel,
      durationButtons,
      customInput
    );

    // Start button
    const startButton = el('button', 'btn btn--primary schedule-control__action-btn', { type: 'button' });
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

    const section = el('div', 'schedule-control__section', {},
      heading,
      description,
      durationGroup,
      startButton
    );

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
    // Collapsible header (click to expand/collapse)
    const headerButton = el('button', 'schedule-control__heading schedule-control__heading--collapsible', {
      type: 'button',
      'aria-expanded': 'false'
    });
    headerButton.innerHTML = '<span class="schedule-control__toggle-icon">▶</span> Áætla kosningu (valfrjálst)';
    
    const description = el('p', 'schedule-control__description schedule-control__description--hint');
    description.innerHTML = '<small>Sjaldgæft - flestir byrja kosningar strax með "Byrja núna"</small>';

    // Date/time inputs
    const dateLabel = el('label', 'schedule-control__label', {}, 'Byrjar:');
    const dateInput = el('input', 'schedule-control__input', { type: 'datetime-local' });

    // Set default to now + 1 hour
    const defaultStart = new Date();
    defaultStart.setHours(defaultStart.getHours() + 1);
    dateInput.value = formatDateTimeLocal(defaultStart);

    const durationLabel = el('label', 'schedule-control__label', {}, 'Tímalengd (mínútur):');
    const durationInput = el('input', 'schedule-control__input', {
      type: 'number',
      min: '1',
      max: '480',
      value: String(DEFAULT_DURATION_MINUTES)
    });

    const scheduleInputs = el('div', 'schedule-control__inputs', {},
      dateLabel,
      dateInput,
      durationLabel,
      durationInput
    );

    // Schedule button
    const scheduleButton = el('button', 'btn schedule-control__action-btn', { type: 'button' });
    scheduleButton.innerHTML = '📅 Áætla kosningu';

    scheduleButton.addEventListener('click', async () => {
      const startDate = new Date(dateInput.value);
      const duration = parseInt(durationInput.value) || DEFAULT_DURATION_MINUTES;

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

    // Add toggle functionality to header
    headerButton.addEventListener('click', () => {
      const isExpanded = headerButton.getAttribute('aria-expanded') === 'true';
      
      if (isExpanded) {
        // Collapse
        collapsibleContent.classList.add('u-hidden');
        collapsibleContent.setAttribute('aria-hidden', 'true');
        headerButton.setAttribute('aria-expanded', 'false');
        headerButton.querySelector('.schedule-control__toggle-icon').textContent = '▶';
      } else {
        // Expand
        collapsibleContent.classList.remove('u-hidden');
        collapsibleContent.setAttribute('aria-hidden', 'false');
        headerButton.setAttribute('aria-expanded', 'true');
        headerButton.querySelector('.schedule-control__toggle-icon').textContent = '▼';
      }
    });

    // Assemble collapsible content
    collapsibleContent.appendChild(scheduleInputs);
    collapsibleContent.appendChild(scheduleButton);

    // Assemble section
    section.appendChild(headerButton);
    section.appendChild(description);
    section.appendChild(collapsibleContent);

    return {
      element: section,
      scheduleButton
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
