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
 * - i18n support for button labels and ARIA attributes
 *
 * @module components/modal
 */

import { debug } from '../utils/debug.js';
import { R } from '../../i18n/strings-loader.js';
import { el } from '../utils/dom.js';

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
 *   ⚠️  SECURITY: If passing HTML string, content MUST be trusted/sanitized to prevent XSS.
 *   Prefer HTMLElement or use textContent for user-generated content.
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

  // Store previously focused element to restore later
  const previousActiveElement = document.activeElement;

  // Create modal header
  const titleElement = el('h2', 'modal__title', { id: 'modal-title' }, title);
  const closeButton = el('button', 'modal__close', {
    'aria-label': R.string?.modal_close_aria || 'Loka',
    onclick: () => instance.close()
  }, '×');

  const header = el('div', 'modal__header', {}, titleElement, closeButton);

  // Create modal body
  const body = el('div', 'modal__body');
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    body.appendChild(content);
  }

  // Create modal container
  const modal = el('div', `modal modal--${size}`, {}, header, body);

  // Create modal footer (if buttons provided)
  if (buttons.length > 0) {
    const footer = el('div', 'modal__footer');
    buttons.forEach(buttonConfig => {
      const button = el('button', 
        buttonConfig.primary ? 'btn btn--primary' : 'btn btn--secondary',
        { onclick: buttonConfig.onClick },
        buttonConfig.text
      );
      footer.appendChild(button);
    });
    modal.appendChild(footer);
  }

  // Create modal overlay
  const overlay = el('div', 'modal-overlay', {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'modal-title'
  }, modal);

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
        
        // Restore focus to previous element
        if (previousActiveElement && previousActiveElement.focus) {
          previousActiveElement.focus();
        }
        
        // Call onClose callback
        if (onClose) {
          onClose();
        }

        // Restore focus to previously focused element
        if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
          previousActiveElement.focus();
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

  // Focus trap
  const handleTab = (e) => {
    if (e.key === 'Tab') {
      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  };
  
  overlay.addEventListener('keydown', handleTab);

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
    confirmText = R.string?.modal_confirm_btn || 'Staðfesta',
    cancelText = R.string?.modal_cancel_btn || 'Hætta við',
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
  const { okText = R.string?.modal_ok_btn || 'Í lagi' } = options;

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
