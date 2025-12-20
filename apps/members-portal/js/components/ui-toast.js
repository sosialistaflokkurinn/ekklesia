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
 * Toast configuration
 */
const TOAST_CONFIG = {
  maxToasts: 5,
  gap: 10 // pixels between toasts
};

/**
 * Track active toasts for stacking
 */
const activeToasts = [];

/**
 * Get or create toast container
 * @returns {HTMLElement} Toast container element
 */
function getToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Reposition all active toasts
 */
function repositionToasts() {
  let offset = TOAST_CONFIG.gap;
  for (const entry of activeToasts) {
    if (entry.element && entry.element.parentElement) {
      entry.element.style.transform = `translateY(-${offset}px)`;
      offset += entry.element.offsetHeight + TOAST_CONFIG.gap;
    }
  }
}

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

  // Remove oldest toast if at max limit
  while (activeToasts.length >= TOAST_CONFIG.maxToasts) {
    const oldest = activeToasts.shift();
    if (oldest && oldest.element) {
      hideToast(oldest.element);
    }
  }

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

  // Track this toast
  const toastEntry = {
    id: Date.now(),
    element: toast,
    timeout: null
  };
  activeToasts.push(toastEntry);

  // Add to container (creates container if needed)
  const container = getToastContainer();
  container.appendChild(toast);

  // Trigger animation and position (slight delay for CSS transition)
  setTimeout(() => {
    toast.classList.add('toast--show');
    repositionToasts();
  }, 10);

  // Auto-hide timeout reference
  if (duration > 0) {
    toastEntry.timeout = setTimeout(() => {
      hideToast(toast);
    }, duration);
  }

  // Return component API
  return {
    element: toast,
    hide: () => {
      if (toastEntry.timeout) {
        clearTimeout(toastEntry.timeout);
      }
      hideToast(toast);
    },
    destroy: () => {
      if (toastEntry.timeout) {
        clearTimeout(toastEntry.timeout);
      }
      removeToastFromTracking(toast);
      if (toast.parentElement) {
        toast.remove();
      }
    }
  };
}

/**
 * Remove toast from tracking array
 * @param {HTMLElement} toast - Toast element to remove from tracking
 */
function removeToastFromTracking(toast) {
  const index = activeToasts.findIndex(entry => entry.element === toast);
  if (index !== -1) {
    const entry = activeToasts[index];
    if (entry.timeout) {
      clearTimeout(entry.timeout);
    }
    activeToasts.splice(index, 1);
  }
}

/**
 * Hide and remove a toast notification
 *
 * @param {HTMLElement} toast - Toast element to hide
 */
function hideToast(toast) {
  if (!toast || !toast.parentElement) return;

  // Remove from tracking
  removeToastFromTracking(toast);

  // Remove show class (triggers fade-out animation)
  toast.classList.remove('toast--show');

  // Remove from DOM after animation completes
  setTimeout(() => {
    if (toast.parentElement) {
      toast.remove();
    }
    // Reposition remaining toasts
    repositionToasts();
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
  // Clear all tracked toasts
  while (activeToasts.length > 0) {
    const entry = activeToasts.pop();
    if (entry.timeout) {
      clearTimeout(entry.timeout);
    }
    if (entry.element && entry.element.parentElement) {
      entry.element.remove();
    }
  }

  // Also clear any orphaned toasts not in tracking
  const container = document.getElementById('toast-container');
  if (container) {
    container.innerHTML = '';
  }
}
