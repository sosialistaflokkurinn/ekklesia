import { el } from '../utils/dom.js';

/**
 * Card Component
 *
 * Reusable card UI component for content containers.
 *
 * Created: Nov 6, 2025
 * Part of: Component Library Extraction (Epic #186)
 */

/**
 * Create a card element
 *
 * @param {Object} options - Card configuration
 * @param {string} options.title - Card title
 * @param {string|HTMLElement} options.content - Card content (HTML string or element)
 *   ⚠️  SECURITY: If passing HTML string, content MUST be trusted/sanitized to prevent XSS.
 *   Prefer HTMLElement or use textContent for user-generated content.
 * @param {string} options.variant - Card variant ('default', 'welcome', 'admin-welcome')
 * @param {Array} options.actions - Action buttons [{text, onClick, primary}]
 * @returns {Object} Component API with {element, setTitle, setContent, destroy}
 */
export function createCard(options = {}) {
  const {
    title,
    content,
    variant = 'default',
    actions = []
  } = options;

  const card = el('div', `card${variant !== 'default' ? ' card--' + variant : ''}`);

  let titleEl = null;
  if (title) {
    titleEl = el('h2', 'card__title', {}, title);
    card.appendChild(titleEl);
  }

  const contentEl = el('div', 'card__content');

  if (typeof content === 'string') {
    contentEl.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    contentEl.appendChild(content);
  }

  card.appendChild(contentEl);

  if (actions.length > 0) {
    const actionsEl = el('div', 'card__actions');

    actions.forEach(action => {
      const btn = el('button', `btn${action.primary ? ' btn--primary' : ' btn--secondary'}`, {
        onclick: action.onClick
      }, action.text);
      actionsEl.appendChild(btn);
    });

    card.appendChild(actionsEl);
  }

  // Return component API
  return {
    element: card,
    setTitle: (newTitle) => {
      if (!titleEl) {
        titleEl = el('h2', 'card__title');
        card.insertBefore(titleEl, card.firstChild);
      }
      titleEl.textContent = newTitle;
    },
    setContent: (newContent) => {
      contentEl.innerHTML = '';
      if (typeof newContent === 'string') {
        contentEl.innerHTML = newContent;
      } else if (newContent instanceof HTMLElement) {
        contentEl.appendChild(newContent);
      }
    },
    destroy: () => {
      card.remove();
    }
  };
}
