/**
 * Error Handler Utility
 * 
 * Provides consistent error handling and display across the application.
 * 
 * @module utils/error-handler
 */

/**
 * Display error message in a container
 * 
 * @param {HTMLElement} container - Container to display error in
 * @param {string} message - Error message to display
 * @param {Function} [retryCallback] - Optional callback for retry button
 */
export function showErrorIn(container, message, retryCallback = null) {
  if (!container) return;
  
  container.innerHTML = `
    <div class="error-state">
      <p class="error-state__message">${message}</p>
      ${retryCallback ? `
        <button class="btn btn--secondary btn--sm error-state__retry">
          Reyna aftur
        </button>
      ` : ''}
    </div>
  `;
  
  if (retryCallback) {
    const retryBtn = container.querySelector('.error-state__retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', retryCallback);
    }
  }
  
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
