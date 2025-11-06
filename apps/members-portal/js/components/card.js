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
 * @param {string} options.variant - Card variant ('default', 'welcome', 'admin-welcome')
 * @param {Array} options.actions - Action buttons [{text, onClick, primary}]
 * @returns {HTMLElement} Card element
 */
export function createCard(options = {}) {
  const {
    title,
    content,
    variant = 'default',
    actions = []
  } = options;

  const card = document.createElement('div');
  card.className = `card${variant !== 'default' ? ' card--' + variant : ''}`;

  if (title) {
    const titleEl = document.createElement('h2');
    titleEl.className = 'card__title';
    titleEl.textContent = title;
    card.appendChild(titleEl);
  }

  const contentEl = document.createElement('div');
  contentEl.className = 'card__content';

  if (typeof content === 'string') {
    contentEl.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    contentEl.appendChild(content);
  }

  card.appendChild(contentEl);

  if (actions.length > 0) {
    const actionsEl = document.createElement('div');
    actionsEl.className = 'card__actions';

    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.className = `btn${action.primary ? ' btn--primary' : ' btn--secondary'}`;
      btn.textContent = action.text;
      btn.onclick = action.onClick;
      actionsEl.appendChild(btn);
    });

    card.appendChild(actionsEl);
  }

  return card;
}
