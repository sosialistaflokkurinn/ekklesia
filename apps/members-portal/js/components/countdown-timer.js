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
 *     showBoth: true
 *   });
 *   container.appendChild(timer.element);
 */

import { debug } from '../utils/debug.js';
import { el } from '../utils/dom.js';

/**
 * Create countdown timer element
 * @param {Object} options - Timer options
 * @param {Date|string} options.endDate - End date/time
 * @param {Function} options.onTick - Callback fired every second with time remaining
 * @param {Function} options.onComplete - Callback fired when timer reaches zero
 * @param {boolean} options.showBoth - Show both formats (default: true)
 * @param {boolean} options.showStopwatch - Show stopwatch format (default: true)
 * @param {boolean} options.showHumanReadable - Show human-readable format (default: true)
 * @returns {Object} Timer instance with element and control methods
 */
export function createCountdownTimer(options = {}) {
  const {
    endDate,
    onTick = () => {},
    onComplete = () => {},
    showBoth = true,
    showStopwatch = true,
    showHumanReadable = true
  } = options;

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
   * Format as human-readable Icelandic
   */
  function formatHumanReadable(hours, minutes, seconds) {
    if (hours > 0) {
      if (hours === 1 && minutes === 0) {
        return '1 klukkustund eftir';
      } else if (hours === 1) {
        return `1 klst ${minutes} mín eftir`;
      } else {
        return `${hours} klst ${minutes} mín eftir`;
      }
    } else if (minutes > 0) {
      if (minutes === 1) {
        return '1 mínúta eftir';
      } else {
        return `${minutes} mínútur eftir`;
      }
    } else {
      if (seconds === 1) {
        return '1 sekúnda eftir';
      } else {
        return `${seconds} sekúndur eftir`;
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
      humanEl.textContent = 'Kosningu lokið';
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
