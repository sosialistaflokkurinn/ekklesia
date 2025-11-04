/**
 * UI State Manager
 *
 * Generic state management for admin pages with multiple UI states
 * (loading, error, empty, content).
 *
 * Usage:
 *   const uiStates = new UIStateManager({
 *     loading: document.getElementById('loading'),
 *     error: document.getElementById('error'),
 *     empty: document.getElementById('empty'),
 *     content: document.getElementById('content')
 *   }, {
 *     errorMessage: document.getElementById('error-message')
 *   });
 *
 *   uiStates.showLoading();
 *   uiStates.showError('Something went wrong');
 *   uiStates.showContent();
 */

export class UIStateManager {
  /**
   * @param {Object} stateElements - Map of state names to DOM elements
   * @param {Object} messageElements - Optional map of message element names to DOM elements
   */
  constructor(stateElements, messageElements = {}) {
    this.stateElements = stateElements;
    this.messageElements = messageElements;
    this.currentState = null;
  }

  /**
   * Hide all state elements
   * @private
   */
  _hideAll() {
    Object.values(this.stateElements).forEach(element => {
      if (element) {
        element.style.display = 'none';
      }
    });
  }

  /**
   * Show a specific state
   * @param {string} stateName - Name of state to show
   * @private
   */
  _showState(stateName) {
    this._hideAll();
    const element = this.stateElements[stateName];
    if (element) {
      element.style.display = 'block';
      this.currentState = stateName;
    }
  }

  /**
   * Set text content of a message element
   * @param {string} messageName - Name of message element
   * @param {string} text - Text to set
   * @private
   */
  _setMessage(messageName, text) {
    const element = this.messageElements[messageName];
    if (element && text !== undefined) {
      element.textContent = text;
    }
  }

  /**
   * Show loading state
   * @param {string} message - Optional loading message
   */
  showLoading(message) {
    this._showState('loading');
    if (message) {
      this._setMessage('loadingMessage', message);
    }
  }

  /**
   * Show error state
   * @param {string} message - Error message to display
   */
  showError(message) {
    this._showState('error');
    this._setMessage('errorMessage', message);
  }

  /**
   * Show empty state
   * @param {string} message - Optional empty state message
   */
  showEmpty(message) {
    this._showState('empty');
    if (message) {
      this._setMessage('emptyMessage', message);
    }
  }

  /**
   * Show content state
   */
  showContent() {
    this._showState('content');
  }

  /**
   * Show a custom state by name
   * @param {string} stateName - Name of state to show
   */
  show(stateName) {
    this._showState(stateName);
  }

  /**
   * Get current state
   * @returns {string|null} Current state name
   */
  getCurrentState() {
    return this.currentState;
  }
}

/**
 * Create a UI state manager for member detail/edit pages
 * (Convenience factory for common pattern)
 *
 * @param {Object} elements - DOM elements object
 * @returns {UIStateManager}
 */
export function createMemberPageStates(elements) {
  return new UIStateManager(
    {
      loading: elements.loading,
      error: elements.error,
      notFound: elements.notFound,
      content: elements.details || elements.form
    },
    {
      errorMessage: elements.errorMessage
    }
  );
}

/**
 * Create a UI state manager for list pages
 * (Convenience factory for common pattern)
 *
 * @param {Object} elements - DOM elements object
 * @returns {UIStateManager}
 */
export function createListPageStates(elements) {
  return new UIStateManager(
    {
      loading: elements.loadingState,
      error: elements.errorState,
      empty: elements.emptyState,
      content: elements.tableContainer
    },
    {
      loadingMessage: elements.loadingMessage,
      errorMessage: elements.errorMessage,
      emptyMessage: elements.emptyMessage
    }
  );
}
