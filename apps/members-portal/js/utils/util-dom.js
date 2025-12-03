/**
 * DOM Utilities
 * 
 * Helper functions for creating and manipulating DOM elements efficiently.
 * Reduces verbosity of document.createElement patterns.
 * 
 * Usage:
 *   import { el } from '../utils/util-dom.js';
 *   
 *   const btn = el('button', 'btn btn--primary', { 
 *     type: 'button', 
 *     'aria-label': 'Close',
 *     onclick: handleClick 
 *   }, 'Click Me');
 */

/**
 * Create a DOM element with attributes and children.
 *
 * @param {string} tag - The tag name (e.g., 'div', 'button').
 * @param {string|Array} [classes] - Class name(s). Can be string or array.
 * @param {Object} [attributes] - Attributes and properties.
 * @param {...(string|Node|Array)} children - Child nodes or text content.
 * @returns {HTMLElement} The created element.
 */
export function el(tag, classes, attributes = {}, ...children) {
  const element = document.createElement(tag);

  // Add classes
  if (classes) {
    if (Array.isArray(classes)) {
      element.classList.add(...classes.filter(Boolean));
    } else if (typeof classes === 'string' && classes.trim()) {
      element.className = classes;
    }
  }

  // Add attributes and properties
  if (attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) {
        return;
      }

      if (key === 'dataset' && typeof value === 'object') {
        Object.assign(element.dataset, value);
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        // Event listeners (onclick -> click)
        const eventName = key.substring(2).toLowerCase();
        element.addEventListener(eventName, value);
      } else {
        // Handle boolean attributes (checked, disabled, etc.)
        if (value === true) {
          element.setAttribute(key, '');
          if (key in element) element[key] = true;
        } else {
          // Try setting as property first for standard props (value, id, etc)
          if (key in element) {
            element[key] = value;
          }
          // Always set attribute for styling/selectors/ARIA
          element.setAttribute(key, String(value));
        }
      }
    });
  }

  // Add children
  const appendChild = (child) => {
    if (child === null || child === undefined || child === false) return;
    
    if (Array.isArray(child)) {
      child.forEach(appendChild);
    } else if (child instanceof Node) {
      element.appendChild(child);
    } else {
      element.appendChild(document.createTextNode(String(child)));
    }
  };

  children.forEach(appendChild);

  return element;
}

/**
 * Clear all children from an element
 * @param {HTMLElement} element 
 */
export function clear(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}
