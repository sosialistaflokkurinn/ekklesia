import { el } from '../utils/dom.js';

/**
 * Button Component
 *
 * Reusable button factory function with consistent styling and behavior.
 * Supports all button variants, sizes, loading states, and event handling.
 *
 * @module components/button
 */

/**
 * Create button element with BEM classes and lifecycle methods
 *
 * @param {Object} options - Button configuration
 * @param {string} [options.text=''] - Button text content
 * @param {string} [options.variant='primary'] - Button style variant
 *   - 'primary': Red background, white text (default)
 *   - 'secondary': Light red background, white text
 *   - 'outline': White background, red text, red border
 *   - 'danger': Dark red background, white text
 * @param {string} [options.size='medium'] - Button size
 *   - 'small': Compact button
 *   - 'medium': Standard size (default)
 *   - 'large': Prominent button
 * @param {string} [options.type='button'] - HTML button type
 *   - 'button': Regular button (default)
 *   - 'submit': Form submit button
 *   - 'reset': Form reset button
 * @param {boolean} [options.disabled=false] - Initial disabled state
 * @param {string} [options.id=''] - Element ID attribute
 * @param {string} [options.className=''] - Additional CSS classes (space-separated)
 * @param {Function} [options.onClick=null] - Click event handler
 *
 * @returns {Object} Button instance with element and methods
 * @returns {HTMLButtonElement} return.element - The button DOM element
 * @returns {Function} return.disable - Disable the button
 * @returns {Function} return.enable - Enable the button
 * @returns {Function} return.setLoading - Set loading state with custom text
 * @returns {Function} return.setText - Update button text
 * @returns {Function} return.destroy - Remove event listeners and cleanup
 *
 * @example
 * // Primary button with click handler
 * const saveButton = createButton({
 *   text: 'Save Changes',
 *   variant: 'primary',
 *   onClick: () => saveData()
 * });
 * container.appendChild(saveButton.element);
 *
 * @example
 * // Outline button with loading state
 * const verifyButton = createButton({
 *   text: 'Verify Membership',
 *   variant: 'outline',
 *   onClick: async () => {
 *     verifyButton.setLoading(true, 'Verifying...');
 *     await verifyMembership();
 *     verifyButton.setLoading(false);
 *   }
 * });
 *
 * @example
 * // Small danger button
 * const deleteButton = createButton({
 *   text: 'Delete',
 *   variant: 'danger',
 *   size: 'small',
 *   onClick: () => confirmDelete()
 * });
 */
export function createButton(options = {}) {
  const {
    text = '',
    variant = 'primary',
    size = 'medium',
    type = 'button',
    disabled = false,
    id = '',
    className = '',
    onClick = null
  } = options;

  // Build BEM classes
  const classes = ['btn'];

  // Variant class (only add if not primary, since .btn defaults to primary)
  if (variant !== 'primary') {
    classes.push(`btn--${variant}`);
  }

  // Size classes
  if (size === 'small') {
    classes.push('btn--sm');
  } else if (size === 'large') {
    classes.push('btn--lg');
  }

  // Additional custom classes
  if (className) {
    classes.push(className);
  }

  const attrs = { type };
  if (disabled) attrs.disabled = true;
  if (id) attrs.id = id;

  const button = el('button', classes.join(' '), attrs, text);

  // Store onClick handler reference for cleanup
  let clickHandler = null;

  if (onClick) {
    clickHandler = (event) => {
      onClick(event, instance);
    };
    button.addEventListener('click', clickHandler);
  }

  // Button instance with public API
  const instance = {
    /**
     * The button DOM element
     * @type {HTMLButtonElement}
     */
    element: button,

    /**
     * Disable the button
     */
    disable() {
      button.disabled = true;
    },

    /**
     * Enable the button
     */
    enable() {
      button.disabled = false;
    },

    /**
     * Set loading state
     *
     * @param {boolean} loading - Whether button is in loading state
     * @param {string} [loadingText='Loading...'] - Text to show during loading
     *
     * @example
     * button.setLoading(true, 'Saving...');
     * await saveData();
     * button.setLoading(false);
     */
    setLoading(loading, loadingText = 'Loading...') {
      button.disabled = loading;

      if (loading) {
        // Store original text for restoration
        if (!button.dataset.originalText) {
          button.dataset.originalText = button.textContent;
        }
        button.textContent = loadingText;
        button.classList.add('btn--loading');
      } else {
        // Restore original text
        button.textContent = button.dataset.originalText || text;
        delete button.dataset.originalText;
        button.classList.remove('btn--loading');
      }
    },

    /**
     * Update button text
     *
     * @param {string} newText - New text content
     */
    setText(newText) {
      button.textContent = newText;
      // Clear stored original text if it exists
      delete button.dataset.originalText;
    },

    /**
     * Remove event listeners and cleanup
     *
     * Call this when removing button from DOM to prevent memory leaks.
     */
    destroy() {
      if (clickHandler) {
        button.removeEventListener('click', clickHandler);
        clickHandler = null;
      }
    }
  };

  return instance;
}

/**
 * Create primary button (convenience function)
 *
 * @param {Object} options - Button options (see createButton)
 * @returns {Object} Button instance
 */
export function createPrimaryButton(options = {}) {
  return createButton({ ...options, variant: 'primary' });
}

/**
 * Create secondary button (convenience function)
 *
 * @param {Object} options - Button options (see createButton)
 * @returns {Object} Button instance
 */
export function createSecondaryButton(options = {}) {
  return createButton({ ...options, variant: 'secondary' });
}

/**
 * Create outline button (convenience function)
 *
 * @param {Object} options - Button options (see createButton)
 * @returns {Object} Button instance
 */
export function createOutlineButton(options = {}) {
  return createButton({ ...options, variant: 'outline' });
}

/**
 * Create danger button (convenience function)
 *
 * @param {Object} options - Button options (see createButton)
 * @returns {Object} Button instance
 */
export function createDangerButton(options = {}) {
  return createButton({ ...options, variant: 'danger' });
}

export default createButton;
