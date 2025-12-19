/**
 * Remote Error Reporting Utility
 *
 * Reports JavaScript errors to a remote endpoint for production monitoring.
 * Designed to be non-blocking and fail-safe (never breaks the app).
 *
 * Features:
 * - Rate limiting to prevent spam
 * - PII sanitization (removes kennitala, email, etc.)
 * - Only reports in production
 * - Batches errors to reduce network calls
 *
 * @module utils/error-reporter
 */

import { SERVICES } from '../config/config.js';
import { debug } from './util-debug.js';

/**
 * Configuration
 */
const CONFIG = {
  // Endpoint for error reporting (uses events service)
  endpoint: `${SERVICES.EVENTS}/api/errors`,

  // Rate limiting: max errors per time window
  maxErrorsPerWindow: 10,
  windowMs: 60 * 1000, // 1 minute

  // Batch settings
  batchSize: 5,
  batchDelayMs: 2000,

  // Only report in production
  enabled: window.location.hostname !== 'localhost' &&
           !window.location.hostname.includes('127.0.0.1')
};

/**
 * Rate limiting state
 */
let errorCount = 0;
let windowStart = Date.now();
let errorBatch = [];
let batchTimeout = null;

/**
 * Patterns to sanitize from error data (PII protection)
 */
const PII_PATTERNS = [
  // Kennitala patterns (with or without hyphen)
  /\b\d{6}[-–]?\d{4}\b/g,
  // Email addresses
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // Phone numbers (Icelandic format)
  /\b\d{3}[-–\s]?\d{4}\b/g,
  // Names after common prefixes (basic heuristic)
  /(?:nafn|name|user|notandi)[:\s]+[A-ZÁÉÍÓÚÝÞÆÖ][a-záéíóúýþæö]+(?:\s+[A-ZÁÉÍÓÚÝÞÆÖ][a-záéíóúýþæö]+)*/gi
];

/**
 * Sanitize string to remove PII
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizePII(str) {
  if (typeof str !== 'string') return str;

  let sanitized = str;
  for (const pattern of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

/**
 * Sanitize error object recursively
 * @param {Object} obj - Object to sanitize
 * @param {number} depth - Current recursion depth
 * @returns {Object} Sanitized object
 */
function sanitizeObject(obj, depth = 0) {
  if (depth > 3) return '[MAX_DEPTH]';
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizePII(obj);
  }

  if (Array.isArray(obj)) {
    return obj.slice(0, 10).map(item => sanitizeObject(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    const keys = Object.keys(obj).slice(0, 20); // Limit keys
    for (const key of keys) {
      // Skip sensitive keys entirely
      if (/password|token|secret|auth|credential|kennitala|ssn/i.test(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeObject(obj[key], depth + 1);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Check if we're within rate limits
 * @returns {boolean} True if we can report
 */
function checkRateLimit() {
  const now = Date.now();

  // Reset window if expired
  if (now - windowStart > CONFIG.windowMs) {
    errorCount = 0;
    windowStart = now;
  }

  // Check limit
  if (errorCount >= CONFIG.maxErrorsPerWindow) {
    debug.warn('Error reporting rate limit exceeded');
    return false;
  }

  errorCount++;
  return true;
}

/**
 * Send batched errors to endpoint
 */
async function sendBatch() {
  if (errorBatch.length === 0) return;

  const batch = errorBatch.splice(0, CONFIG.batchSize);
  batchTimeout = null;

  try {
    const response = await fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        errors: batch,
        clientTimestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: sanitizePII(window.location.href)
      })
    });

    if (!response.ok) {
      debug.warn('Error reporting failed:', response.status);
    }
  } catch (e) {
    // Silently fail - don't break the app
    debug.warn('Error reporting network failure');
  }

  // If more errors pending, schedule next batch
  if (errorBatch.length > 0 && !batchTimeout) {
    batchTimeout = setTimeout(sendBatch, CONFIG.batchDelayMs);
  }
}

/**
 * Report an error to the remote endpoint
 *
 * @param {Error|string} error - Error object or message
 * @param {Object} context - Additional context (will be sanitized)
 * @returns {void}
 *
 * @example
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   reportError(error, { operation: 'profile_update' });
 *   showErrorToUser('Villa kom upp');
 * }
 */
export function reportError(error, context = {}) {
  // Only report in production
  if (!CONFIG.enabled) {
    debug.error('Error (not reported - dev mode):', error, context);
    return;
  }

  // Check rate limit
  if (!checkRateLimit()) {
    return;
  }

  // Build error report
  const report = {
    timestamp: new Date().toISOString(),
    message: sanitizePII(error?.message || String(error)),
    stack: sanitizePII(error?.stack || ''),
    name: error?.name || 'Error',
    context: sanitizeObject(context),
    page: window.location.pathname
  };

  // Add to batch
  errorBatch.push(report);

  // Schedule batch send
  if (!batchTimeout) {
    batchTimeout = setTimeout(sendBatch, CONFIG.batchDelayMs);
  }
}

/**
 * Report a warning (lower severity than error)
 *
 * @param {string} message - Warning message
 * @param {Object} context - Additional context
 */
export function reportWarning(message, context = {}) {
  reportError({ message, name: 'Warning' }, { severity: 'warning', ...context });
}

/**
 * Set up global error handlers
 *
 * Call this once on app initialization to catch unhandled errors.
 *
 * @example
 * // In app initialization
 * import { setupGlobalErrorHandlers } from './utils/util-error-reporter.js';
 * setupGlobalErrorHandlers();
 */
export function setupGlobalErrorHandlers() {
  // Unhandled errors
  window.addEventListener('error', (event) => {
    reportError(event.error || event.message, {
      source: 'window.onerror',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, {
      source: 'unhandledrejection'
    });
  });

  debug.log('Global error handlers installed');
}

/**
 * Flush any pending error reports immediately
 * Useful before page unload
 */
export function flushErrors() {
  if (batchTimeout) {
    clearTimeout(batchTimeout);
    batchTimeout = null;
  }
  sendBatch();
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushErrors);
}
