/**
 * DOM Utilities
 *
 * Safe DOM manipulation helpers with validation and helpful error messages.
 * Prevents null reference errors and provides debugging context.
 *
 * @module ui/dom
 */

/**
 * Get element by ID with validation
 *
 * @param {string} id - Element ID
 * @param {string} [context] - Context for error message (e.g., "navigation menu")
 * @returns {HTMLElement} DOM element
 * @throws {Error} If element not found
 */
export function getElementByIdSafe(id, context = 'page') {
  const element = document.getElementById(id);

  if (!element) {
    const contextMsg = context ? ` in ${context}` : '';
    throw new Error(
      `Required DOM element not found${contextMsg}: #${id}\n` +
      `Check that the HTML contains: <... id="${id}">`
    );
  }

  return element;
}

/**
 * Set text content safely
 *
 * @param {string} id - Element ID
 * @param {string} text - Text content
 * @param {string} [context] - Context for error message
 */
export function setTextContent(id, text, context) {
  const element = getElementByIdSafe(id, context);
  element.textContent = text;
}

/**
 * Set inner HTML safely
 *
 * @param {string} id - Element ID
 * @param {string} html - HTML content
 * @param {string} [context] - Context for error message
 */
export function setInnerHTML(id, html, context) {
  const element = getElementByIdSafe(id, context);
  element.innerHTML = html;
}

/**
 * Add event listener safely
 *
 * @param {string} id - Element ID
 * @param {string} event - Event name (e.g., 'click')
 * @param {Function} handler - Event handler
 * @param {string} [context] - Context for error message
 */
export function addEventListener(id, event, handler, context) {
  const element = getElementByIdSafe(id, context);
  element.addEventListener(event, handler);
}

/**
 * Set element disabled state
 *
 * @param {string} id - Element ID
 * @param {boolean} disabled - Whether element should be disabled
 * @param {string} [context] - Context for error message
 */
export function setDisabled(id, disabled, context) {
  const element = getElementByIdSafe(id, context);
  element.disabled = disabled;
}

/**
 * Validate required DOM elements exist
 *
 * Throws helpful error if any element is missing.
 *
 * @param {string[]} ids - Array of element IDs to validate
 * @param {string} [context] - Context for error message
 * @throws {Error} If any element not found
 */
export function validateElements(ids, context = 'page') {
  const missing = ids.filter(id => !document.getElementById(id));

  if (missing.length > 0) {
    throw new Error(
      `Missing required DOM elements in ${context}:\n` +
      missing.map(id => `  - #${id}`).join('\n') +
      `\n\nCheck that the HTML contains these elements.`
    );
  }
}
