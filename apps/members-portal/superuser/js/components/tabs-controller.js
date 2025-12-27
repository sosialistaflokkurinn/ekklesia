/**
 * Tabs Controller - Tab Switching Logic
 *
 * Reusable tab management for the system overview page.
 *
 * Module cleanup not needed - tab controller persists for page lifetime.
 */

// Module state
let activeTab = 'architecture';

/**
 * Get currently active tab ID
 */
export function getActiveTab() {
  return activeTab;
}

/**
 * Switch to a different tab
 * @param {string} tabId - Tab to switch to
 * @param {Object} callbacks - Optional callbacks
 * @param {Function} callbacks.onSwitch - Called after tab switch
 */
export function switchTab(tabId, callbacks = {}) {
  activeTab = tabId;

  // Update tab buttons
  document.querySelectorAll('.tab').forEach(btn => {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle('tab--active', isActive);
    btn.setAttribute('aria-selected', isActive);
  });

  // Update tab content panels
  document.querySelectorAll('.tab-content').forEach(content => {
    const isActive = content.id === `tab-${tabId}`;
    content.classList.toggle('tab-content--active', isActive);
  });

  // Call optional callback
  if (callbacks.onSwitch) {
    callbacks.onSwitch(tabId);
  }
}

/**
 * Setup click listeners for tab buttons
 * @param {Object} callbacks - Optional callbacks
 * @param {Function} callbacks.onSwitch - Called after tab switch
 */
export function setupTabListeners(callbacks = {}) {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      if (tabId) switchTab(tabId, callbacks);
    });
  });
}
