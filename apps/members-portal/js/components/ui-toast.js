/**
 * Toast Notification System
 * 
 * Unified notification component for both member portal and admin portal.
 * Provides consistent toast notifications for success, error, info, and warning messages.
 * 
 * Usage:
 *   import { showToast } from '../../js/components/ui-toast.js';
 *   showToast('Vistað!', 'success');
 *   showToast('Villa kom upp', 'error');
 * 
 * @module components/toast
 */

import { el } from '../utils/util-dom.js';
import { R } from '../../i18n/strings-loader.js';

/**
 * Default i18n strings for the component
 */
const DEFAULT_STRINGS = {
  close_aria: 'Loka'
};

/**
 * Show a toast notification
 * 
 * @param {string} message - Message to display
 * @param {string} type - Toast type: 'success', 'error', 'info', 'warning'
 * @param {Object} options - Optional configuration
 * @param {number} options.duration - Duration in milliseconds (default: 3000)
 * @param {boolean} options.dismissible - Allow manual dismissal (default: true)
 * 
 * @example
 * showToast('Profile updated!', 'success');
 * showToast('Invalid input', 'error', { duration: 5000 });
 * showToast('Processing...', 'info', { dismissible: false });
 */
export function showToast(message, type = 'success', options = {}) {
  const {
    duration = 3000,
    dismissible = true
  } = options;

  // Create message span
  const messageSpan = el('span', 'toast__message', {}, message);

  // Create dismiss button if dismissible
  let dismissBtn = null;
  if (dismissible) {
    dismissBtn = el('button', 'toast__dismiss', {
      'aria-label': R.string?.toast_close_aria || DEFAULT_STRINGS.close_aria,
      onclick: () => hideToast(toast)
    }, '×');
  }

  // Determine ARIA role based on type
  const role = type === 'error' ? 'alert' : 'status';
  const ariaLive = type === 'error' ? 'assertive' : 'polite';

  // Create toast element
  const toast = el('div', `toast toast--${type}`, {
    role: role,
    'aria-live': ariaLive
  }, messageSpan, dismissBtn);

  // Add to DOM
  document.body.appendChild(toast);

  // Trigger animation (slight delay for CSS transition)
  setTimeout(() => {
    toast.classList.add('toast--show');
  }, 10);

  // Auto-hide timeout reference
  let autoHideTimeout;
  if (duration > 0) {
    autoHideTimeout = setTimeout(() => {
      hideToast(toast);
    }, duration);
  }

  // Return component API
  return {
    element: toast,
    hide: () => {
      if (autoHideTimeout) {
        clearTimeout(autoHideTimeout);
      }
      hideToast(toast);
    },
    destroy: () => {
      if (autoHideTimeout) {
        clearTimeout(autoHideTimeout);
      }
      if (toast.parentElement) {
        toast.remove();
      }
    }
  };
}

/**
 * Hide and remove a toast notification
 * 
 * @param {HTMLElement} toast - Toast element to hide
 */
function hideToast(toast) {
  if (!toast || !toast.parentElement) return;

  // Remove show class (triggers fade-out animation)
  toast.classList.remove('toast--show');

  // Remove from DOM after animation completes
  setTimeout(() => {
    if (toast.parentElement) {
      toast.remove();
    }
  }, 300);
}

/**
 * Show success toast (convenience method)
 * 
 * @param {string} message - Success message
 * @param {Object} options - Optional configuration
 */
export function showSuccess(message, options = {}) {
  return showToast(message, 'success', options);
}

/**
 * Show error toast (convenience method)
 * 
 * @param {string} message - Error message
 * @param {Object} options - Optional configuration
 */
export function showError(message, options = {}) {
  return showToast(message, 'error', { duration: 5000, ...options });
}

/**
 * Show info toast (convenience method)
 * 
 * @param {string} message - Info message
 * @param {Object} options - Optional configuration
 */
export function showInfo(message, options = {}) {
  return showToast(message, 'info', options);
}

/**
 * Show warning toast (convenience method)
 * 
 * @param {string} message - Warning message
 * @param {Object} options - Optional configuration
 */
export function showWarning(message, options = {}) {
  return showToast(message, 'warning', { duration: 4000, ...options });
}

/**
 * Clear all active toasts
 */
export function clearAllToasts() {
  const toasts = document.querySelectorAll('.toast');
  toasts.forEach(toast => hideToast(toast));
}
