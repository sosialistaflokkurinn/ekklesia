/**
 * Debug utility for conditional logging
 *
 * Only logs when DEBUG environment is enabled (dev mode).
 * Prevents console clutter in production.
 * Includes PII sanitization for GDPR compliance.
 *
 * @module debug
 */

// Fields that should be redacted in logs (PII protection)
const PII_FIELDS = [
  'kennitala', 'ssn', 'kt',
  'email', 'netfang',
  'phone', 'simi', 'foreign_phone',
  'name', 'nafn', 'full_name',
  'address', 'heimilisfang', 'street',
  'password', 'token', 'accessToken', 'idToken'
];

/**
 * Sanitize an object for safe logging (redact PII)
 * @param {*} obj - Object to sanitize
 * @param {number} depth - Current recursion depth
 * @returns {*} Sanitized object
 */
function sanitizeForLogging(obj, depth = 0) {
  // Prevent infinite recursion
  if (depth > 5) return '[MAX_DEPTH]';

  // Handle null/undefined
  if (obj === null || obj === undefined) return obj;

  // Handle primitives
  if (typeof obj !== 'object') return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLogging(item, depth + 1));
  }

  // Handle objects
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if this is a PII field
    const isPII = PII_FIELDS.some(field =>
      lowerKey === field.toLowerCase() ||
      lowerKey.includes(field.toLowerCase())
    );

    if (isPII) {
      // Redact PII but show type/length for debugging
      if (typeof value === 'string') {
        sanitized[key] = `[REDACTED:${value.length}chars]`;
      } else {
        sanitized[key] = '[REDACTED]';
      }
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeForLogging(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

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
  // Check localStorage explicitly set to true
  if (typeof localStorage !== 'undefined' && localStorage.getItem('DEBUG') === 'true') {
    return true;
  }

  // Check URL parameter
  if (typeof window !== 'undefined' && window.location.search.includes('debug=true')) {
    return true;
  }

  // Auto-enable on localhost (optional - comment out to disable)
  // if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  //   return true;
  // }

  return false;
}

/**
 * Conditional debug logger
 *
 * Only logs to console if debug mode is enabled.
 * Production builds will have silent debug calls.
 *
 * @example
 * import { debug } from './utils/util-debug.js';
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
   * Log message with PII sanitization (only in debug mode)
   * Use this when logging objects that may contain PII
   * @param {string} message - Log message
   * @param {*} data - Data to log (will be sanitized)
   */
  safe: function(message, data) {
    if (isDebugEnabled()) {
      console.log(message, sanitizeForLogging(data));
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
   * Sanitize object for logging (removes PII)
   * @param {*} obj - Object to sanitize
   * @returns {*} Sanitized object
   */
  sanitize: function(obj) {
    return sanitizeForLogging(obj);
  },

  /**
   * Enable debug mode manually
   */
  enable: function() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('DEBUG', 'true');
      console.log('✅ Debug mode enabled. Refresh page to see debug messages.');
    }
  },

  /**
   * Disable debug mode manually
   */
  disable: function() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('DEBUG');
      console.log('🛑 Debug mode disabled. Refresh page to hide debug messages.');
    }
  }
};

// Make debug available globally in browser console for manual control
if (typeof window !== 'undefined') {
  window.debug = debug;
}
