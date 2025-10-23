/**
 * Navigation Module
 *
 * Handles mobile hamburger menu behavior:
 * - Open/close drawer
 * - Overlay click handling
 * - Keyboard accessibility (Escape to close)
 * - Focus management
 * - Body scroll lock
 *
 * @module nav
 */

/**
 * Initialize navigation menu behavior
 * Call this on every authenticated page after DOM is loaded
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

  /**
   * Open drawer
   */
  function openDrawer() {
    drawer.classList.add('is-open');
    overlay.classList.add('is-visible');
    hamburger.classList.add('is-active');
    hamburger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('nav-open'); // Prevent body scroll

    // Focus first link for keyboard accessibility
    const firstLink = drawer.querySelector('.nav__link');
    if (firstLink) {
      firstLink.focus();
    }
  }

  /**
   * Close drawer
   */
  function closeDrawer() {
    drawer.classList.remove('is-open');
    overlay.classList.remove('is-visible');
    hamburger.classList.remove('is-active');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open'); // Restore body scroll

    // Return focus to hamburger button
    hamburger.focus();
  }

  /**
   * Toggle drawer
   */
  function toggleDrawer() {
    if (drawer.classList.contains('is-open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  }

  // Event Listeners

  // Hamburger button click
  hamburger.addEventListener('click', toggleDrawer);

  // Close button click
  closeBtn.addEventListener('click', closeDrawer);

  // Overlay click (click outside drawer to close)
  overlay.addEventListener('click', closeDrawer);

  // Navigation link click (close drawer when navigating)
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      // Small delay to allow navigation to start
      setTimeout(closeDrawer, 100);
    });
  });

  // Keyboard: Escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
      closeDrawer();
    }
  });

  // Window resize: Close drawer if resized to desktop
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.innerWidth > 768 && drawer.classList.contains('is-open')) {
        closeDrawer();
      }
    }, 250);
  });
}
