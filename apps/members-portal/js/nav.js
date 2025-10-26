/**
 * Navigation Module
 *
 * Handles mobile hamburger menu behavior:
 * - Open/close drawer
 * - Overlay click handling
 * - Keyboard accessibility (Escape to close, Tab/Shift+Tab focus trap)
 * - Focus management with returnFocus parameter
 * - aria-hidden toggling for accessibility
 * - Body scroll lock
 *
 * @module nav
 */

// Module-level variables to store listener references (prevents memory leak)
let keypressHandler = null;
let resizeHandler = null;

/**
 * Initialize navigation menu behavior
 * Call this on every authenticated page after DOM is loaded
 *
 * NOTE: This function is called every time a user navigates to a new authenticated page.
 * We must clean up old listeners before adding new ones to prevent memory leaks.
 */
export function initNavigation() {
  // Get elements
  const hamburger = document.getElementById('nav-hamburger');
  const drawer = document.getElementById('nav-drawer');
  const overlay = document.getElementById('nav-overlay');
  const closeBtn = document.getElementById('nav-close');
  const navLinks = document.querySelectorAll('.nav__link');

  // Check if elements exist (safety check)
  if (!hamburger || !drawer || !overlay || !closeBtn) {
    console.warn('[Nav] Navigation elements not found');
    return;
  }

  // FIX #1: Clean up old listeners before adding new ones (prevents memory leak)
  if (keypressHandler) {
    document.removeEventListener('keydown', keypressHandler);
  }
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
  }

  /**
   * Open drawer
   */
  function openDrawer() {
    drawer.classList.add('is-open');
    overlay.classList.add('is-visible');
    hamburger.classList.add('is-active');
    hamburger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('nav-open'); // Prevent body scroll

    // FIX #4: Set aria-hidden="false" when drawer opens
    drawer.setAttribute('aria-hidden', 'false');

    // FIX #5: Update ARIA label to "Close menu" when drawer is open
    const closeLabel = hamburger.getAttribute('data-close-label') || 'Loka valmynd';
    hamburger.setAttribute('aria-label', closeLabel);

    // Focus first link for keyboard accessibility
    const firstLink = drawer.querySelector('.nav__link');
    if (firstLink) {
      firstLink.focus();
    }
  }

  /**
   * Close drawer
   *
   * @param {boolean} returnFocus - If true, return focus to hamburger button.
   *                                Only return focus when closed via overlay/close button/Escape.
   *                                Don't return focus when closing due to navigation link click.
   */
  function closeDrawer(returnFocus = true) {
    drawer.classList.remove('is-open');
    overlay.classList.remove('is-visible');
    hamburger.classList.remove('is-active');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open'); // Restore body scroll

    // FIX #4: Set aria-hidden="true" when drawer closes
    drawer.setAttribute('aria-hidden', 'true');

    // FIX #5: Update ARIA label to "Open menu" when drawer is closed
    const openLabel = hamburger.getAttribute('data-open-label') || 'Opna valmynd';
    hamburger.setAttribute('aria-label', openLabel);

    // FIX #3: Only return focus to hamburger when explicitly requested
    if (returnFocus) {
      hamburger.focus();
    }
  }

  /**
   * Toggle drawer
   */
  function toggleDrawer() {
    if (drawer.classList.contains('is-open')) {
      closeDrawer(true);
    } else {
      openDrawer();
    }
  }

  /**
   * Focus Trap: Prevent Tab key from escaping the drawer
   * When drawer is open, Tab/Shift+Tab cycle within focusable elements only
   * FIX #2: Implement focus trap for accessibility compliance
   */
  function trapFocus(e) {
    // Only trap focus if drawer is open
    if (!drawer.classList.contains('is-open')) return;

    // Only handle Tab key
    if (e.key !== 'Tab') return;

    // Get all focusable elements within the drawer
    const focusableElements = drawer.querySelectorAll(
      'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return; // No focusable elements

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (e.shiftKey) {
      // Shift+Tab: if on first focusable, wrap to last
      if (activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      }
    } else {
      // Tab: if on last focusable, wrap to first
      if (activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  }

  // Event Listeners

  // Hamburger button click
  hamburger.addEventListener('click', toggleDrawer);

  // Close button click (FIX #3: return focus = true)
  closeBtn.addEventListener('click', () => closeDrawer(true));

  // Overlay click (click outside drawer to close) (FIX #3: return focus = true)
  overlay.addEventListener('click', () => closeDrawer(true));

  // Navigation link click (FIX #3: return focus = false - don't return focus when navigating)
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      // Small delay to allow navigation to start
      setTimeout(() => closeDrawer(false), 100);
    });
  });

  // FIX #1: Store keydown handler in module scope (prevents memory leak)
  // FIX #2: Combine Escape key and focus trap in single keydown handler
  keypressHandler = (e) => {
    // Handle Escape key to close drawer (FIX #3: return focus = true)
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
      closeDrawer(true);
    }

    // Handle focus trap for Tab key
    trapFocus(e);
  };

  document.addEventListener('keydown', keypressHandler);

  // FIX #1: Store resize handler in module scope (prevents memory leak)
  // Window resize: Close drawer if resized to desktop
  let resizeTimer;
  resizeHandler = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.innerWidth > 768 && drawer.classList.contains('is-open')) {
        closeDrawer(true);
      }
    }, 250);
  };

  window.addEventListener('resize', resizeHandler);
}
