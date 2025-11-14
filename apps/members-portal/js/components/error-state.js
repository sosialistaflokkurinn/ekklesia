/**
 * Error State Component
 *
 * Reusable error state UI component for displaying
 * error messages with optional retry buttons.
 *
 * Created: Nov 6, 2025
 * Part of: Component Library Extraction (Epic #186)
 */

/**
 * Create an error state element
 *
 * @param {string} message - Error message text
 * @param {Object} options - Configuration options
 * @param {string} options.retryText - Retry button text
 * @param {Function} options.onRetry - Retry click handler
 * @returns {Object} Component API with {element, setMessage, setRetryHandler, destroy}
 */
export function createErrorState(message, options = {}) {
  const {
    retryText = 'Retry',
    onRetry = null
  } = options;

  const container = document.createElement('div');
  container.className = 'error-state';

  const messageEl = document.createElement('p');
  messageEl.className = 'error-state__message';
  messageEl.textContent = message;

  container.appendChild(messageEl);

  let retryBtn = null;
  if (onRetry) {
    retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn--primary';
    retryBtn.textContent = retryText;
    retryBtn.onclick = onRetry;
    container.appendChild(retryBtn);
  }

  // Return component API
  return {
    element: container,
    setMessage: (newMessage) => {
      messageEl.textContent = newMessage;
    },
    setRetryHandler: (handler, text = 'Retry') => {
      if (!retryBtn) {
        retryBtn = document.createElement('button');
        retryBtn.className = 'btn btn--primary';
        container.appendChild(retryBtn);
      }
      retryBtn.textContent = text;
      retryBtn.onclick = handler;
    },
    destroy: () => {
      container.remove();
    }
  };
}

/**
 * Show error state in a container
 *
 * @param {HTMLElement} container - Target container
 * @param {string} message - Error message
 * @param {Function} onRetry - Retry click handler
 */
export function showErrorIn(container, message, onRetry = null) {
  container.innerHTML = '';
  const errorState = createErrorState(message, { onRetry });
  container.appendChild(errorState.element);
}
