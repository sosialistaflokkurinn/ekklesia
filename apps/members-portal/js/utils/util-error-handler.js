/**
 * Error Handler Utility
 *
 * Provides consistent error handling and display across the application.
 *
 * @module utils/error-handler
 */

import { R } from '../../i18n/strings-loader.js';

/**
 * Display error message in a container
 *
 * Uses DOM manipulation with textContent to prevent XSS attacks.
 * Never use innerHTML with user-provided or untrusted content.
 *
 * @param {HTMLElement} container - Container to display error in
 * @param {string} message - Error message to display
 * @param {Function} [retryCallback] - Optional callback for retry button
 */
export function showErrorIn(container, message, retryCallback = null) {
  if (!container) return;

  // Clear container safely
  container.innerHTML = '';

  // Create error state container
  const errorState = document.createElement('div');
  errorState.className = 'error-state';

  // Create message element - textContent is XSS-safe
  const errorMessage = document.createElement('p');
  errorMessage.className = 'error-state__message';
  errorMessage.textContent = message;
  errorState.appendChild(errorMessage);

  // Add retry button if callback provided
  if (retryCallback) {
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn--secondary btn--sm error-state__retry';
    retryBtn.textContent = R.string.btn_retry;
    retryBtn.addEventListener('click', retryCallback);
    errorState.appendChild(retryBtn);
  }

  container.appendChild(errorState);

  // Ensure container is visible
  container.classList.remove('u-hidden');
  container.style.display = 'block';
}

/**
 * Clear error message from container
 * 
 * @param {HTMLElement} container - Container to clear error from
 */
export function clearErrorIn(container) {
  if (!container) return;
  
  container.innerHTML = '';
  container.classList.add('u-hidden');
}

/**
 * Log error to console with context
 * 
 * @param {string} context - Context where error occurred
 * @param {Error} error - Error object
 */
export function logError(context, error) {
  console.error(`[${context}] Error:`, error);
}
