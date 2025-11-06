/**
 * Status Feedback Component
 * 
 * Provides visual feedback for loading, success, and error states.
 * Used for inline status indicators (e.g., next to form fields, buttons).
 * 
 * Usage:
 *   import { showStatus, createStatusIcon } from '../../js/components/status.js';
 *   const statusIcon = createStatusIcon();
 *   showStatus(statusIcon, 'loading');
 *   showStatus(statusIcon, 'success', { clearDelay: 2000 });
 * 
 * @module components/status
 */

/**
 * Show status feedback on an element
 * 
 * Updates element's CSS classes to show loading, success, or error state.
 * Success and error states auto-clear after a delay.
 * 
 * @param {HTMLElement} element - Element to show status on
 * @param {string} state - Status state: 'loading', 'success', 'error', or 'idle'
 * @param {Object} options - Optional configuration
 * @param {number} options.clearDelay - Milliseconds before clearing (default: 2000)
 * @param {string} options.baseClass - Base CSS class (default: 'status')
 * 
 * @example
 * const statusIcon = document.createElement('span');
 * showStatus(statusIcon, 'loading');
 * // ... perform async operation ...
 * showStatus(statusIcon, 'success');
 */
export function showStatus(element, state, options = {}) {
  if (!element) {
    console.warn('showStatus: element is null or undefined');
    return;
  }

  const {
    clearDelay = 2000,
    baseClass = 'status'
  } = options;

  // Clear all state classes first
  element.className = baseClass;

  // Set new state
  if (state === 'loading') {
    element.className = `${baseClass} ${baseClass}--loading`;
  } else if (state === 'success') {
    element.className = `${baseClass} ${baseClass}--success`;

    // Auto-clear after delay
    setTimeout(() => {
      element.className = baseClass;
    }, clearDelay);
  } else if (state === 'error') {
    element.className = `${baseClass} ${baseClass}--error`;

    // Auto-clear after delay (longer for errors)
    setTimeout(() => {
      element.className = baseClass;
    }, clearDelay * 1.5);
  } else if (state === 'idle') {
    // Explicitly clear to idle state
    element.className = baseClass;
  }
}

/**
 * Create a status icon element
 * 
 * Creates a span element ready for status feedback.
 * Can be inserted into forms, buttons, or other UI elements.
 * 
 * @param {Object} options - Optional configuration
 * @param {string} options.baseClass - Base CSS class (default: 'status')
 * @param {string} options.ariaLabel - ARIA label for accessibility
 * @returns {HTMLElement} Status icon span element
 * 
 * @example
 * const statusIcon = createStatusIcon({ baseClass: 'form-field__status' });
 * inputContainer.appendChild(statusIcon);
 */
export function createStatusIcon(options = {}) {
  const {
    baseClass = 'status',
    ariaLabel = 'Status indicator'
  } = options;

  const statusIcon = document.createElement('span');
  statusIcon.className = baseClass;
  statusIcon.setAttribute('role', 'status');
  statusIcon.setAttribute('aria-label', ariaLabel);
  statusIcon.setAttribute('aria-live', 'polite');

  return statusIcon;
}

/**
 * Show loading status (convenience method)
 * 
 * @param {HTMLElement} element - Element to show loading state on
 * @param {Object} options - Optional configuration
 */
export function showLoading(element, options = {}) {
  showStatus(element, 'loading', options);
}

/**
 * Show success status (convenience method)
 * 
 * @param {HTMLElement} element - Element to show success state on
 * @param {Object} options - Optional configuration
 */
export function showSuccess(element, options = {}) {
  showStatus(element, 'success', options);
}

/**
 * Show error status (convenience method)
 * 
 * @param {HTMLElement} element - Element to show error state on
 * @param {Object} options - Optional configuration
 */
export function showError(element, options = {}) {
  showStatus(element, 'error', options);
}

/**
 * Clear status (convenience method)
 * 
 * @param {HTMLElement} element - Element to clear status from
 * @param {Object} options - Optional configuration
 */
export function clearStatus(element, options = {}) {
  showStatus(element, 'idle', options);
}

/**
 * Toggle button loading state
 * 
 * Disables button and shows loading state with optional spinner.
 * 
 * @param {HTMLButtonElement} button - Button element
 * @param {boolean} loading - Whether to show loading state
 * @param {Object} options - Optional configuration
 * @param {string} options.loadingText - Text to show while loading
 * @param {string} options.originalText - Original button text (auto-detected if not provided)
 * 
 * @example
 * const saveBtn = document.getElementById('btn-save');
 * toggleButtonLoading(saveBtn, true, { loadingText: 'Saving...' });
 * // ... perform save ...
 * toggleButtonLoading(saveBtn, false);
 */
export function toggleButtonLoading(button, loading, options = {}) {
  if (!button) {
    console.warn('toggleButtonLoading: button is null or undefined');
    return;
  }

  const {
    loadingText = 'Loading...',
    originalText = button.getAttribute('data-original-text') || button.textContent
  } = options;

  if (loading) {
    // Store original text and state
    button.setAttribute('data-original-text', originalText);
    button.disabled = true;
    button.classList.add('btn--loading');
    button.textContent = loadingText;
  } else {
    // Restore original text and state
    button.disabled = false;
    button.classList.remove('btn--loading');
    button.textContent = originalText;
    button.removeAttribute('data-original-text');
  }
}
