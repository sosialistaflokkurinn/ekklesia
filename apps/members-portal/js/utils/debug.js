/**
 * Debug utility for conditional logging
 *
 * Only logs when DEBUG environment is enabled (dev mode).
 * Prevents console clutter in production.
 *
 * @module debug
 */

/**
 * Check if debug mode is enabled
 *
 * Debug mode is enabled if:
 * - localStorage.DEBUG is set to 'true'
 * - URL contains ?debug=true
 * - hostname is localhost
 *
 * @returns {boolean} True if debug mode enabled
 */
function isDebugEnabled() {
  // Check localStorage
  if (typeof localStorage !== 'undefined' && localStorage.getItem('DEBUG') === 'true') {
    return true;
  }

  // Check URL parameter
  if (typeof window !== 'undefined' && window.location.search.includes('debug=true')) {
    return true;
  }

  // Auto-enable on localhost
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return true;
  }

  return false;
}

/**
 * Conditional debug logger
 *
 * Only logs to console if debug mode is enabled.
 * Production builds will have silent debug calls.
 *
 * @example
 * import { debug } from './utils/debug.js';
 * debug.log('User clicked button', buttonId);
 * debug.error('Save failed', error);
 */
export const debug = {
  /**
   * Log message (only in debug mode)
   * @param {...*} args - Arguments to log
   */
  log: function(...args) {
    if (isDebugEnabled()) {
      console.log(...args);
    }
  },

  /**
   * Log error (only in debug mode)
   * @param {...*} args - Arguments to log
   */
  error: function(...args) {
    if (isDebugEnabled()) {
      console.error(...args);
    }
  },

  /**
   * Log warning (only in debug mode)
   * @param {...*} args - Arguments to log
   */
  warn: function(...args) {
    if (isDebugEnabled()) {
      console.warn(...args);
    }
  },

  /**
   * Log info (only in debug mode)
   * @param {...*} args - Arguments to log
   */
  info: function(...args) {
    if (isDebugEnabled()) {
      console.info(...args);
    }
  },

  /**
   * Enable debug mode manually
   */
  enable: function() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('DEBUG', 'true');
      console.log('Debug mode enabled');
    }
  },

  /**
   * Disable debug mode manually
   */
  disable: function() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('DEBUG');
      console.log('Debug mode disabled');
    }
  }
};
