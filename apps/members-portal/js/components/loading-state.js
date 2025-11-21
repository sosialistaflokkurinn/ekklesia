/**
 * Loading State Component
 *
 * Reusable loading state UI component for displaying
 * loading spinners with optional messages.
 *
 * Created: Nov 6, 2025
 * Part of: Component Library Extraction (Epic #186)
 */

/**
 * Create a loading state element
 *
 * @param {string} message - Loading message text
 * @param {string} size - Spinner size ('sm', 'md', 'lg')
 * @returns {Object} Component API with {element, setMessage, destroy}
 */
export function createLoadingState(message = 'Loading...', size = 'md') {
  const container = document.createElement('div');
  container.className = 'loading-state';

  const spinner = document.createElement('div');
  spinner.className = `spinner${size !== 'md' ? ' spinner--' + size : ''}`;

  const text = document.createElement('p');
  text.className = 'loading-state__text';
  text.textContent = message;

  container.appendChild(spinner);
  container.appendChild(text);

  // Return component API
  return {
    element: container,
    setMessage: (newMessage) => {
      text.textContent = newMessage;
    },
    destroy: () => {
      container.remove();
    }
  };
}

/**
 * Show loading state in a container
 *
 * @param {HTMLElement} container - Target container
 * @param {string} message - Loading message
 */
export function showLoadingIn(container, message = 'Loading...') {
  container.innerHTML = '';
  const loadingState = createLoadingState(message);
  container.appendChild(loadingState.element);
}

/**
 * Hide loading state in a container
 *
 * @param {HTMLElement} container - Target container
 */
export function hideLoadingIn(container) {
  const loadingState = container.querySelector('.loading-state');
  if (loadingState) {
    loadingState.remove();
  }
}
