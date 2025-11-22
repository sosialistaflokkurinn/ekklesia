import { el } from '../utils/dom.js';

/**
 * Badge Component
 *
 * Reusable badge UI component for status indicators,
 * tags, and labels with proper contrast.
 *
 * Created: Nov 6, 2025
 * Part of: Component Library Extraction (Epic #186)
 */

/**
 * Create a badge element
 *
 * Matches createButton API pattern for consistency.
 *
 * @param {string} text - Badge text
 * @param {Object} options - Configuration options
 * @param {string} options.variant - Badge variant ('success', 'error', 'warning', 'info', 'primary')
 * @param {string} options.size - Badge size ('xs', 'sm', 'md', 'lg')
 * @param {boolean} options.clickable - Make badge clickable
 * @param {Function} options.onClick - Click handler
 * @returns {Object} Badge API {element, setText, setVariant}
 */
export function createBadge(text, options = {}) {
  const {
    variant = 'primary',
    size = 'md',
    clickable = false,
    onClick = null
  } = options;

  const classes = `badge badge--${variant} badge--${size}${clickable ? ' badge--clickable' : ''}`;
  const attrs = {};
  
  if (clickable) {
    attrs.role = 'button';
    attrs.tabindex = '0';
  }

  const badge = el('span', classes, attrs, text);

  if (onClick) {
    badge.onclick = onClick;
    badge.onkeypress = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick(e);
      }
    };
  }

  // Badge instance with public API (matches createButton pattern)
  return {
    /**
     * The badge DOM element
     * @type {HTMLSpanElement}
     */
    element: badge,

    /**
     * Update badge text
     * @param {string} newText - New text to display
     */
    setText(newText) {
      badge.textContent = newText;
    },

    /**
     * Update badge variant
     * @param {string} newVariant - New variant ('success', 'error', 'warning', 'info', 'primary')
     */
    setVariant(newVariant) {
      badge.className = badge.className.replace(/badge--\w+/, `badge--${newVariant}`);
    }
  };
}

/**
 * Create a status badge (semantic helper)
 *
 * @param {string} status - Status text ('active', 'closed', 'upcoming', etc.)
 * @returns {Object} Badge API {element, setText, setVariant}
 */
export function createStatusBadge(status) {
  const variantMap = {
    'active': 'success',
    'closed': 'error',
    'upcoming': 'info',
    'voted': 'success'
  };

  const variant = variantMap[status.toLowerCase()] || 'primary';
  return createBadge(status, { variant });
}
