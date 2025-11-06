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
 * @param {string} text - Badge text
 * @param {Object} options - Configuration options
 * @param {string} options.variant - Badge variant ('success', 'error', 'warning', 'info', 'primary')
 * @param {string} options.size - Badge size ('xs', 'sm', 'md', 'lg')
 * @param {boolean} options.clickable - Make badge clickable
 * @param {Function} options.onClick - Click handler
 * @returns {HTMLElement} Badge element
 */
export function createBadge(text, options = {}) {
  const {
    variant = 'primary',
    size = 'md',
    clickable = false,
    onClick = null
  } = options;

  const badge = document.createElement('span');
  badge.className = `badge badge--${variant} badge--${size}`;
  badge.textContent = text;

  if (clickable) {
    badge.classList.add('badge--clickable');
    badge.setAttribute('role', 'button');
    badge.setAttribute('tabindex', '0');
  }

  if (onClick) {
    badge.onclick = onClick;
    badge.onkeypress = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick(e);
      }
    };
  }

  return badge;
}

/**
 * Create a status badge (semantic helper)
 *
 * @param {string} status - Status text ('active', 'closed', 'upcoming', etc.)
 * @returns {HTMLElement} Status badge
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
