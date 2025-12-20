/**
 * API Error Handling Utility
 *
 * Provides centralized error handling for API calls with
 * user-friendly error messages and toast notifications.
 *
 * @module utils/api-error
 */

import { debug } from './util-debug.js';

/**
 * API Error class with additional metadata
 *
 * @extends Error
 */
export class ApiError extends Error {
  /**
   * Create an API error
   *
   * @param {string} message - Error message
   * @param {number} status - HTTP status code
   * @param {string} code - Error code (optional)
   */
  constructor(message, status, code = null) {
    super(message);
    this.name = 'ApiError';
    /** @type {number} */
    this.status = status;
    /** @type {string|null} */
    this.code = code;
    /** @type {boolean} */
    this.isRetryable = status >= 500 || status === 429;
  }
}

/**
 * User-friendly error messages by status code
 */
const ERROR_MESSAGES = {
  400: 'Ógild beiðni. Athugaðu gögnin og reyndu aftur.',
  401: 'Þú þarft að skrá þig inn aftur.',
  403: 'Þú hefur ekki aðgang að þessari aðgerð.',
  404: 'Gögn fundust ekki.',
  408: 'Beiðnin tók of langan tíma. Reyndu aftur.',
  429: 'Of margar beiðnir. Bíddu aðeins og reyndu aftur.',
  500: 'Villa á þjóni. Reyndu aftur síðar.',
  502: 'Þjónustan er tímabundið óaðgengileg.',
  503: 'Þjónustan er tímabundið óaðgengileg.',
  504: 'Þjónustan svaraði ekki. Reyndu aftur.'
};

/** Default error message */
const DEFAULT_ERROR = 'Villa kom upp. Reyndu aftur síðar.';

/**
 * Get user-friendly error message for status code
 *
 * @param {number} status - HTTP status code
 * @returns {string} User-friendly message in Icelandic
 */
export function getErrorMessage(status) {
  return ERROR_MESSAGES[status] || DEFAULT_ERROR;
}

/**
 * Create API error from fetch response
 *
 * @param {Response} response - Fetch response
 * @param {string} operation - Description of the operation
 * @returns {Promise<ApiError>} API error
 */
export async function createApiError(response, operation = 'API call') {
  let message = getErrorMessage(response.status);
  let code = null;

  try {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const body = await response.json();
      if (body.message) {
        message = body.message;
      }
      if (body.code) {
        code = body.code;
      }
    }
  } catch {
    // Use default message if we can't parse the body
  }

  debug.warn(`${operation} failed:`, { status: response.status, message });

  return new ApiError(message, response.status, code);
}

/**
 * Show error toast notification
 *
 * Uses the existing toast component if available,
 * otherwise creates a simple error banner.
 *
 * @param {string} message - Error message to display
 * @param {number} duration - Duration in ms (default: 5000)
 */
export function showErrorToast(message, duration = 5000) {
  // Try to use existing toast component
  if (typeof window.showToast === 'function') {
    window.showToast(message, 'error', duration);
    return;
  }

  // Fallback: create simple error banner
  const banner = document.createElement('div');
  banner.className = 'api-error-banner';
  banner.setAttribute('role', 'alert');
  banner.textContent = message;

  // Style the banner
  Object.assign(banner.style, {
    position: 'fixed',
    top: '1rem',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'var(--color-error, #dc3545)',
    color: 'white',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.25rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    zIndex: '9999',
    maxWidth: '90%',
    textAlign: 'center'
  });

  document.body.appendChild(banner);

  // Remove after duration
  setTimeout(() => {
    banner.remove();
  }, duration);
}

/**
 * Handle API error with user notification
 *
 * @param {Error} error - Error to handle
 * @param {Object} options - Options
 * @param {boolean} options.showToast - Whether to show toast (default: true)
 * @param {boolean} options.redirectOn401 - Whether to redirect on 401 (default: true)
 */
export function handleApiError(error, options = {}) {
  const { showToast = true, redirectOn401 = true } = options;

  // Log error for debugging
  debug.error('API Error:', error);

  // Handle 401 - redirect to login
  if (redirectOn401 && error.status === 401) {
    window.location.replace('/');
    return;
  }

  // Show toast notification
  if (showToast) {
    const message = error instanceof ApiError
      ? error.message
      : getErrorMessage(error.status) || DEFAULT_ERROR;

    showErrorToast(message);
  }
}

/**
 * Wrap an async function with error handling
 *
 * @param {Function} fn - Async function to wrap
 * @param {Object} options - Error handling options
 * @returns {Function} Wrapped function
 *
 * @example
 * const safeGetElections = withErrorHandling(getElections);
 * const elections = await safeGetElections(); // Shows toast on error
 */
export function withErrorHandling(fn, options = {}) {
  return async function wrappedFn(...args) {
    try {
      return await fn(...args);
    } catch (error) {
      handleApiError(error, options);
      throw error;
    }
  };
}
