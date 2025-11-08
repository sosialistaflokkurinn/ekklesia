// @ts-nocheck
/**
 * Modal Dialog Component
 * 
 * Unified modal/dialog system for confirmations, forms, and alerts.
 * Provides consistent modal behavior across member portal and admin portal.
 * 
 * Features:
 * - Confirmation dialogs
 * - Alert dialogs
 * - Custom content modals
 * - Keyboard support (ESC to close)
 * - Click outside to close
 * - Accessibility (ARIA, focus trap)
 * 
 * @module components/modal
 */

import { debug } from '../utils/debug.js';

/**
 * Active modal instance (only one modal at a time)
 */
let activeModal = null;

/**
 * Show a modal dialog
 * 
 * @param {Object} options - Modal configuration
 * @param {string} options.title - Modal title
 * @param {string|HTMLElement} options.content - Modal content (HTML string or element)
 * @param {Array<Object>} options.buttons - Button configurations
 * @param {boolean} options.closeOnOverlay - Close when clicking overlay (default: true)
 * @param {boolean} options.closeOnEscape - Close on ESC key (default: true)
 * @param {Function} options.onClose - Callback when modal closes
 * @param {string} options.size - Modal size: 'sm', 'md', 'lg', 'xl' (default: 'md')
 * @returns {Object} Modal instance with close() method
 * 
 * @example
 * const modal = showModal({
 *   title: 'Confirmation',
 *   content: 'Are you sure?',
 *   buttons: [
 *     { text: 'Yes', onClick: () => { doSomething(); modal.close(); }, primary: true },
 *     { text: 'No', onClick: () => modal.close() }
 *   ]
 * });
 */
export function showModal(options = {}) {
  const {
    title = '',
    content = '',
    buttons = [],
    closeOnOverlay = true,
    closeOnEscape = true,
    onClose = null,
    size = 'md'
  } = options;

  // Close existing modal if any
  if (activeModal) {
    activeModal.close();
  }

  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'modal-title');

  // Create modal container
  const modal = document.createElement('div');
  modal.className = `modal modal--${size}`;

  // Create modal header
  const header = document.createElement('div');
  header.className = 'modal__header';

  const titleElement = document.createElement('h2');
  titleElement.id = 'modal-title';
  titleElement.className = 'modal__title';
  titleElement.textContent = title;
  header.appendChild(titleElement);

  const closeButton = document.createElement('button');
  closeButton.className = 'modal__close';
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.innerHTML = '×';
  closeButton.onclick = () => instance.close();
  header.appendChild(closeButton);

  modal.appendChild(header);

  // Create modal body
  const body = document.createElement('div');
  body.className = 'modal__body';

  if (typeof content === 'string') {
    body.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    body.appendChild(content);
  }

  modal.appendChild(body);

  // Create modal footer (if buttons provided)
  if (buttons.length > 0) {
    const footer = document.createElement('div');
    footer.className = 'modal__footer';

    buttons.forEach(buttonConfig => {
      const button = document.createElement('button');
      button.className = buttonConfig.primary ? 'btn btn--primary' : 'btn btn--secondary';
      button.textContent = buttonConfig.text;
      button.onclick = buttonConfig.onClick;
      footer.appendChild(button);
    });

    modal.appendChild(footer);
  }

  overlay.appendChild(modal);

  // Modal instance API
  const instance = {
    element: overlay,
    close: () => {
      // Trigger close animation
      overlay.classList.remove('modal-overlay--show');
      
      // Remove from DOM after animation
      setTimeout(() => {
        if (overlay.parentElement) {
          overlay.remove();
        }
        activeModal = null;
        
        // Call onClose callback
        if (onClose) {
          onClose();
        }
      }, 200);
    }
  };

  // Click overlay to close
  if (closeOnOverlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        instance.close();
      }
    });
  }

  // ESC key to close
  if (closeOnEscape) {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && activeModal === instance) {
        instance.close();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  // Add to DOM
  document.body.appendChild(overlay);

  // Trigger show animation (slight delay for CSS transition)
  setTimeout(() => {
    overlay.classList.add('modal-overlay--show');
  }, 10);

  // Focus first button or close button
  setTimeout(() => {
    const firstButton = modal.querySelector('button');
    if (firstButton) {
      firstButton.focus();
    }
  }, 100);

  activeModal = instance;
  return instance;
}

/**
 * Show confirmation dialog
 * 
 * Returns a Promise that resolves to true if confirmed, false if canceled.
 * 
 * @param {string} title - Dialog title
 * @param {string} message - Confirmation message
 * @param {Object} options - Additional options
 * @param {string} options.confirmText - Confirm button text (default: 'Confirm')
 * @param {string} options.cancelText - Cancel button text (default: 'Cancel')
 * @param {string} options.confirmStyle - 'primary', 'danger' (default: 'primary')
 * @returns {Promise<boolean>} True if confirmed, false if canceled
 * 
 * @example
 * const confirmed = await showConfirm(
 *   'Delete member?',
 *   'This action cannot be undone',
 *   { confirmStyle: 'danger', confirmText: 'Delete' }
 * );
 * if (confirmed) {
 *   deleteMember();
 * }
 */
export function showConfirm(title, message, options = {}) {
  const {
    confirmText = 'Staðfesta',
    cancelText = 'Hætta við',
    confirmStyle = 'primary'
  } = options;

  return new Promise((resolve) => {
    const modal = showModal({
      title,
      content: `<p class="modal__message">${message}</p>`,
      buttons: [
        {
          text: cancelText,
          onClick: () => {
            modal.close();
            resolve(false);
          }
        },
        {
          text: confirmText,
          primary: confirmStyle === 'primary',
          onClick: () => {
            modal.close();
            resolve(true);
          }
        }
      ],
      onClose: () => resolve(false)
    });
  });
}

/**
 * Show alert dialog
 * 
 * Returns a Promise that resolves when user clicks OK.
 * 
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 * @param {Object} options - Additional options
 * @param {string} options.okText - OK button text (default: 'OK')
 * @returns {Promise<void>}
 * 
 * @example
 * await showAlert('Success', 'Member saved successfully');
 * console.log('User acknowledged');
 */
export function showAlert(title, message, options = {}) {
  const { okText = 'Í lagi' } = options;

  return new Promise((resolve) => {
    const modal = showModal({
      title,
      content: `<p class="modal__message">${message}</p>`,
      buttons: [
        {
          text: okText,
          primary: true,
          onClick: () => {
            modal.close();
            resolve();
          }
        }
      ],
      onClose: () => resolve()
    });
  });
}

/**
 * Close active modal (if any)
 */
export function closeModal() {
  if (activeModal) {
    activeModal.close();
  }
}
