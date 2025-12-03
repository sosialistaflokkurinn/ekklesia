/**
 * Countdown Timer Component
 *
 * Displays countdown in two formats:
 * 1. Stopwatch format: "0:15:32"
 * 2. Human-readable Icelandic: "15 mínútur eftir"
 *
 * Usage:
 *   const timer = createCountdownTimer({
 *     endDate: election.voting_ends_at,
 *     onTick: (timeRemaining) => { ... },
 *     onComplete: () => { ... },
 *     showBoth: true,
 *     strings: {
 *       hourRemaining: '1 klukkustund eftir',
 *       hoursMinutesRemaining: '%h klst %m mín eftir',
 *       // ...
 *     }
 *   });
 *   container.appendChild(timer.element);
 */

import { debug } from '../utils/util-debug.js';
import { el } from '../utils/util-dom.js';

/**
 * Default i18n strings for countdown timer
 * Can be overridden via options.strings
 */
const DEFAULT_STRINGS = {
  hourRemaining: '1 klukkustund eftir',
  hourMinutesRemaining: '1 klst %m mín eftir',
  hoursMinutesRemaining: '%h klst %m mín eftir',
  minuteRemaining: '1 mínúta eftir',
  minutesRemaining: '%m mínútur eftir',
  secondRemaining: '1 sekúnda eftir',
  secondsRemaining: '%s sekúndur eftir',
  timerExpired: 'Kosningu lokið'
};

/**
 * Create countdown timer element
 * @param {Object} options - Timer options
 * @param {Date|string} options.endDate - End date/time
 * @param {Function} options.onTick - Callback fired every second with time remaining
 * @param {Function} options.onComplete - Callback fired when timer reaches zero
 * @param {boolean} options.showBoth - Show both formats (default: true)
 * @param {boolean} options.showStopwatch - Show stopwatch format (default: true)
 * @param {boolean} options.showHumanReadable - Show human-readable format (default: true)
 * @param {Object} options.strings - i18n strings to override defaults
 * @returns {Object} Timer instance with element and control methods
 */
export function createCountdownTimer(options = {}) {
  const {
    endDate,
    onTick = () => {},
    onComplete = () => {},
    showBoth = true,
    showStopwatch = true,
    showHumanReadable = true,
    strings = {}
  } = options;

  // Merge provided strings with defaults
  const i18n = { ...DEFAULT_STRINGS, ...strings };

  if (!endDate) {
    throw new Error('createCountdownTimer: endDate is required');
  }

  const end = endDate instanceof Date ? endDate : new Date(endDate);

  // Create container
  const container = el('div', 'countdown-timer');

  // Stopwatch display
  const stopwatchEl = el('div', 'countdown-timer__stopwatch');
  if (showStopwatch || showBoth) {
    container.appendChild(stopwatchEl);
  }

  // Human-readable display
  const humanEl = el('div', 'countdown-timer__human');
  if (showHumanReadable || showBoth) {
    container.appendChild(humanEl);
  }

  let interval = null;

  /**
   * Calculate time remaining
   * @returns {Object|null} Time remaining object or null if expired
   */
  function calculateTimeRemaining() {
    const now = new Date();
    const diff = end - now;

    if (diff <= 0) {
      return null;
    }

    const hours = Math.floor(diff / 1000 / 60 / 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    return {
      total: diff,
      hours,
      minutes,
      seconds,
      stopwatch: formatStopwatch(hours, minutes, seconds),
      humanReadable: formatHumanReadable(hours, minutes, seconds)
    };
  }

  /**
   * Format as stopwatch (0:15:32)
   */
  function formatStopwatch(hours, minutes, seconds) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * Format as human-readable Icelandic (using i18n strings)
   */
  function formatHumanReadable(hours, minutes, seconds) {
    if (hours > 0) {
      if (hours === 1 && minutes === 0) {
        return i18n.hourRemaining;
      } else if (hours === 1) {
        return i18n.hourMinutesRemaining.replace('%m', minutes);
      } else {
        return i18n.hoursMinutesRemaining.replace('%h', hours).replace('%m', minutes);
      }
    } else if (minutes > 0) {
      if (minutes === 1) {
        return i18n.minuteRemaining;
      } else {
        return i18n.minutesRemaining.replace('%m', minutes);
      }
    } else {
      if (seconds === 1) {
        return i18n.secondRemaining;
      } else {
        return i18n.secondsRemaining.replace('%s', seconds);
      }
    }
  }

  /**
   * Update display
   */
  function update() {
    const remaining = calculateTimeRemaining();

    if (!remaining) {
      // Timer expired
      stop();
      stopwatchEl.textContent = '0:00:00';
      humanEl.textContent = i18n.timerExpired;
      container.classList.add('countdown-timer--expired');
      onComplete();
      return;
    }

    // Update displays
    if (showStopwatch || showBoth) {
      stopwatchEl.textContent = remaining.stopwatch;
    }

    if (showHumanReadable || showBoth) {
      humanEl.textContent = remaining.humanReadable;
    }

    // Add warning class if less than 5 minutes
    if (remaining.total < 5 * 60 * 1000) {
      container.classList.add('countdown-timer--warning');
    }

    // Add critical class if less than 1 minute
    if (remaining.total < 60 * 1000) {
      container.classList.add('countdown-timer--critical');
    }

    // Callback
    onTick(remaining);
  }

  /**
   * Start timer
   */
  function start() {
    if (interval) {
      return; // Already running
    }

    // Update immediately
    update();

    // Start interval
    interval = setInterval(update, 1000);

    debug.log('Countdown timer started');
  }

  /**
   * Stop timer
   */
  function stop() {
    if (interval) {
      clearInterval(interval);
      interval = null;
      debug.log('Countdown timer stopped');
    }
  }

  /**
   * Reset timer with new end date
   * @param {Date|string} newEndDate - New end date
   */
  function reset(newEndDate) {
    stop();
    end.setTime(newEndDate instanceof Date ? newEndDate.getTime() : new Date(newEndDate).getTime());
    container.classList.remove('countdown-timer--expired', 'countdown-timer--warning', 'countdown-timer--critical');
    start();
  }

  /**
   * Destroy timer and cleanup
   */
  function destroy() {
    stop();
    container.remove();
  }

  // Auto-start
  start();

  return {
    element: container,
    start,
    stop,
    reset,
    destroy,
    getTimeRemaining: calculateTimeRemaining
  };
}
