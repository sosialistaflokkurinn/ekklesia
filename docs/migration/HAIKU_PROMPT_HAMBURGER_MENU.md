# Haiku Implementation Prompt: Hamburger Menu for Mobile Navigation

**Task**: Implement hamburger menu for mobile devices (≤768px) across all authenticated pages.

**Reference Documentation**: `/docs/migration/HAMBURGER_MENU_IMPLEMENTATION_PLAN.md`

---

## Overview

You need to convert the current desktop navigation bar to use a hamburger menu on mobile devices. The desktop version stays unchanged, but mobile users (≤768px) will see a ☰ hamburger icon that opens a slide-in drawer.

**Current State**: Navigation links wrap vertically on mobile (poor UX)
**Target State**: Hamburger icon + slide-in drawer (professional mobile UX)

---

## Step 1: Create Navigation JavaScript Module (15 minutes)

**File**: `/apps/members-portal/js/nav.js` (NEW FILE)

Create this file with the following content:

```javascript
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
```

---

## Step 2: Update page-init.js (5 minutes)

**File**: `/apps/members-portal/js/page-init.js`

**Change**: Add import and call to `initNavigation()`

**Find this section** (lines 17-18):
```javascript
import { R } from '../i18n/strings-loader.js';
import { requireAuth, signOut, getUserData } from '../session/auth.js';
```

**Change to**:
```javascript
import { R } from '../i18n/strings-loader.js';
import { requireAuth, signOut, getUserData } from '../session/auth.js';
import { initNavigation } from './nav.js';
```

**Then find the `initAuthenticatedPage()` function** (around line 72):

**Find this section**:
```javascript
export async function initAuthenticatedPage() {
  // Load i18n strings
  await initI18n();

  // Update navigation
  updateNavigation();

  // Setup logout handler
  setupLogout();

  // Auth guard - redirect if not authenticated
  const user = await requireAuth();
```

**Change to**:
```javascript
export async function initAuthenticatedPage() {
  // Load i18n strings
  await initI18n();

  // Update navigation
  updateNavigation();

  // Setup logout handler
  setupLogout();

  // Initialize mobile hamburger menu
  initNavigation();

  // Auth guard - redirect if not authenticated
  const user = await requireAuth();
```

---

## Step 3: Update CSS (30 minutes)

**File**: `/apps/members-portal/styles/components/nav.css`

**Replace the entire file** with this content:

```css
/**
 * Navigation Component Styles
 *
 * Shared navigation bar for authenticated pages
 * - Desktop: Horizontal navigation (unchanged)
 * - Mobile: Hamburger menu with slide-in drawer
 */

/* ========================================== */
/* BASE STYLES (Desktop) */
/* ========================================== */

.nav {
  background: var(--color-primary);
  padding: var(--spacing-md) var(--spacing-xl);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.nav__container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav__brand {
  color: white;
  font-size: 20px;
  font-weight: 600;
  text-decoration: none;
}

.nav__brand:hover {
  opacity: 0.9;
}

/* Hamburger Button - Hidden on desktop */
.nav__hamburger {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: 10px;
  z-index: 1001;
  position: relative;
}

.nav__hamburger-line {
  display: block;
  width: 24px;
  height: 3px;
  background: white;
  margin: 5px 0;
  transition: all 0.3s ease;
  border-radius: 2px;
}

/* Hamburger animation when open */
.nav__hamburger.is-active .nav__hamburger-line:nth-child(1) {
  transform: rotate(45deg) translateY(10px);
}

.nav__hamburger.is-active .nav__hamburger-line:nth-child(2) {
  opacity: 0;
}

.nav__hamburger.is-active .nav__hamburger-line:nth-child(3) {
  transform: rotate(-45deg) translateY(-10px);
}

/* Overlay - Dark background behind drawer */
.nav__overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.nav__overlay.is-visible {
  display: block;
  opacity: 1;
}

/* Drawer - Slide-in menu container */
.nav__drawer {
  display: flex;
  align-items: center;
}

.nav__close {
  display: none;
}

.nav__links {
  display: flex;
  gap: var(--spacing-lg);
  align-items: center;
}

.nav__link {
  color: white;
  text-decoration: none;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  transition: background 0.2s;
}

.nav__link:hover {
  background: var(--color-primary-dark);
}

.nav__link.nav__link--active {
  background: rgba(255, 255, 255, 0.2);
  font-weight: 500;
}

.nav__link--logout {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.nav__link--logout:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* ========================================== */
/* MOBILE RESPONSIVE (≤768px) */
/* ========================================== */

@media (max-width: 768px) {

  /* Show hamburger button */
  .nav__hamburger {
    display: block;
  }

  /* Drawer becomes slide-in panel */
  .nav__drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 280px;
    max-width: 85vw;
    background: var(--color-white);
    box-shadow: -4px 0 12px rgba(0, 0, 0, 0.15);
    transform: translateX(100%);
    transition: transform 0.3s ease-in-out;
    z-index: 1000;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding: var(--spacing-xl) 0;
  }

  /* Drawer open state */
  .nav__drawer.is-open {
    transform: translateX(0);
  }

  /* Close button inside drawer */
  .nav__close {
    display: block;
    position: absolute;
    top: var(--spacing-md);
    right: var(--spacing-md);
    background: none;
    border: none;
    font-size: 32px;
    color: var(--color-gray-600);
    cursor: pointer;
    padding: var(--spacing-sm);
    line-height: 1;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nav__close:hover {
    color: var(--color-primary);
  }

  /* Navigation links - vertical stack */
  .nav__links {
    flex-direction: column;
    gap: 0;
    width: 100%;
    margin-top: var(--spacing-xl);
  }

  .nav__link {
    width: 100%;
    padding: var(--spacing-md) var(--spacing-xl);
    color: var(--color-gray-800);
    border-bottom: 1px solid var(--color-border-light);
    text-align: left;
    font-size: 16px;
    min-height: 44px;
    display: flex;
    align-items: center;
    border-radius: 0;
  }

  .nav__link:hover {
    background: var(--color-gray-50);
  }

  .nav__link.nav__link--active {
    background: var(--color-primary);
    color: white;
    font-weight: 600;
  }

  .nav__link--logout {
    background: var(--color-gray-50);
    border: none;
    border-top: 2px solid var(--color-border-medium);
    margin-top: auto;
    color: var(--color-primary);
    font-weight: 500;
  }

  .nav__link--logout:hover {
    background: var(--color-primary);
    color: white;
  }
}

/* Small Mobile (≤400px) - Full width drawer */
@media (max-width: 400px) {
  .nav__drawer {
    width: 100%;
    max-width: 100%;
  }
}

/* ========================================== */
/* ACCESSIBILITY */
/* ========================================== */

/* Focus styles for keyboard navigation */
.nav__hamburger:focus-visible,
.nav__close:focus-visible {
  outline: 2px solid var(--color-white);
  outline-offset: 2px;
}

@media (max-width: 768px) {
  .nav__hamburger:focus-visible {
    outline-color: var(--color-white);
  }

  .nav__close:focus-visible {
    outline-color: var(--color-primary);
  }

  .nav__link:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }
}

/* Prevent body scroll when drawer open */
body.nav-open {
  overflow: hidden;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .nav__drawer,
  .nav__overlay,
  .nav__hamburger-line {
    transition: none !important;
  }
}
```

---

## Step 4: Update HTML for All Pages (45 minutes)

You need to update the `<nav>` section in **7 HTML files**:

1. `/apps/members-portal/dashboard.html`
2. `/apps/members-portal/profile.html`
3. `/apps/members-portal/events.html`
4. `/apps/members-portal/elections.html`
5. `/apps/members-portal/election-detail.html`
6. `/apps/members-portal/test-events.html`

**For each file**:

**Find the current navigation** (looks like this):
```html
<nav class="nav">
  <div class="nav__container">
    <a href="/dashboard.html" class="nav__brand" id="nav-brand">Loading...</a>
    <div class="nav__links">
      <a href="/dashboard.html" class="nav__link nav__link--active" id="nav-dashboard">Loading...</a>
      <a href="/profile.html" class="nav__link" id="nav-profile">Loading...</a>
      <a href="/events.html" class="nav__link" id="nav-events">Loading...</a>
      <a href="/elections.html" class="nav__link" id="nav-voting">Loading...</a>
      <a href="#" class="nav__link nav__link--logout" id="nav-logout">Loading...</a>
    </div>
  </div>
</nav>
```

**Replace with this**:
```html
<nav class="nav">
  <div class="nav__container">
    <a href="/dashboard.html" class="nav__brand" id="nav-brand">Loading...</a>

    <!-- Hamburger Button (mobile only) -->
    <button class="nav__hamburger" id="nav-hamburger" aria-label="Open menu" aria-expanded="false">
      <span class="nav__hamburger-line"></span>
      <span class="nav__hamburger-line"></span>
      <span class="nav__hamburger-line"></span>
    </button>

    <!-- Overlay for mobile menu -->
    <div class="nav__overlay" id="nav-overlay"></div>

    <!-- Navigation Drawer -->
    <div class="nav__drawer" id="nav-drawer">
      <!-- Close button (mobile only) -->
      <button class="nav__close" id="nav-close" aria-label="Close menu">
        <span class="nav__close-icon">✕</span>
      </button>

      <div class="nav__links">
        <a href="/dashboard.html" class="nav__link nav__link--active" id="nav-dashboard">Loading...</a>
        <a href="/profile.html" class="nav__link" id="nav-profile">Loading...</a>
        <a href="/events.html" class="nav__link" id="nav-events">Loading...</a>
        <a href="/elections.html" class="nav__link" id="nav-voting">Loading...</a>
        <a href="#" class="nav__link nav__link--logout" id="nav-logout">Loading...</a>
      </div>
    </div>
  </div>
</nav>
```

**IMPORTANT**: Make sure to preserve the correct active state for each page:
- `dashboard.html`: `nav__link--active` on `#nav-dashboard`
- `profile.html`: `nav__link--active` on `#nav-profile`
- `events.html`: `nav__link--active` on `#nav-events`
- `elections.html` and `election-detail.html`: `nav__link--active` on `#nav-voting`
- `test-events.html`: `nav__link--active` on `#nav-events`

---

## Step 5: Testing (30 minutes)

After making all changes, test thoroughly:

### Desktop Testing (>768px)

Open each page in Chrome DevTools (desktop view):

1. ✅ Navigation displays horizontally (no hamburger icon visible)
2. ✅ All links work correctly
3. ✅ Active state shows on current page
4. ✅ Hover states work
5. ✅ Logout button works
6. ✅ No visual regressions

**Test pages**:
- http://localhost:5000/dashboard.html
- http://localhost:5000/profile.html
- http://localhost:5000/events.html
- http://localhost:5000/elections.html
- http://localhost:5000/election-detail.html

### Mobile Testing (≤768px)

Open Chrome DevTools → Toggle device toolbar → iPhone SE / Pixel 5:

1. ✅ Hamburger icon (☰) visible in top right
2. ✅ Click hamburger → drawer slides in from right
3. ✅ Overlay appears (semi-transparent black)
4. ✅ All 5 navigation links visible in drawer
5. ✅ Links stack vertically
6. ✅ Active link highlighted (red background)
7. ✅ Click link → drawer closes + navigation works
8. ✅ Click overlay → drawer closes
9. ✅ Click X button → drawer closes
10. ✅ Hamburger animates to X when drawer open

### Keyboard Testing

1. ✅ Tab to hamburger button → Enter opens drawer
2. ✅ Tab through links in drawer
3. ✅ Press Escape → drawer closes
4. ✅ Focus visible on all interactive elements

### Console Check

Open DevTools console, check for:
- ✅ No JavaScript errors
- ✅ `[Nav]` module loads successfully
- ✅ No missing imports

---

## Step 6: Deploy (10 minutes)

After all tests pass:

1. **Commit changes**:
   ```bash
   cd /home/gudro/Development/projects/ekklesia
   git add apps/members-portal/js/nav.js
   git add apps/members-portal/js/page-init.js
   git add apps/members-portal/styles/components/nav.css
   git add apps/members-portal/*.html
   git commit -m "feat: add hamburger menu for mobile navigation

   - Created nav.js module for hamburger menu behavior
   - Updated page-init.js to initialize navigation
   - Updated nav.css with mobile-responsive styles
   - Updated all authenticated pages with new nav structure
   - Hamburger icon (☰) on mobile, horizontal nav on desktop
   - Slide-in drawer with smooth animations
   - Full accessibility (keyboard + screen reader support)
   - Tested on desktop, tablet, and mobile breakpoints"
   ```

2. **Deploy to Firebase**:
   ```bash
   cd /home/gudro/Development/projects/ekklesia/services/members
   firebase deploy --only hosting
   ```

3. **Verify deployment**:
   - Open: https://ekklesia-prod-10-2025.web.app/dashboard.html
   - Test on desktop (Chrome DevTools)
   - Test on mobile (Chrome DevTools → iPhone SE)
   - Check console for errors

---

## Common Issues & Solutions

### Issue 1: Hamburger icon not visible on mobile

**Cause**: CSS media query not applied
**Solution**: Hard refresh (Ctrl+Shift+R) to clear cache

### Issue 2: Drawer doesn't slide in

**Cause**: JavaScript not loaded or element IDs missing
**Solution**: Check console for errors, verify all IDs match (nav-hamburger, nav-drawer, etc.)

### Issue 3: Navigation links not working

**Cause**: Event listener preventing default navigation
**Solution**: Verify `nav.js` has 100ms delay before closing drawer

### Issue 4: Body scroll not locked

**Cause**: `nav-open` class not applied to body
**Solution**: Check `openDrawer()` function adds class correctly

### Issue 5: Focus not returning to hamburger

**Cause**: Focus management missing
**Solution**: Verify `closeDrawer()` calls `hamburger.focus()`

---

## Success Criteria

✅ **Desktop (>768px)**:
- Navigation horizontal (unchanged from current)
- No hamburger icon visible
- All links work
- No visual regressions

✅ **Mobile (≤768px)**:
- Hamburger icon visible (top right)
- Click hamburger → drawer slides in
- Smooth animation (300ms)
- Overlay appears
- Links stack vertically
- Active link highlighted
- Click outside → drawer closes
- Escape key → drawer closes

✅ **Accessibility**:
- Keyboard navigable (Tab, Enter, Escape)
- Focus visible
- ARIA labels present
- Screen reader compatible

✅ **All Pages**:
- Dashboard, Profile, Events, Elections, Election Detail, Test Events all work

---

## Final Checklist

Before marking as complete:

- [ ] `/apps/members-portal/js/nav.js` created
- [ ] `/apps/members-portal/js/page-init.js` updated (import + call)
- [ ] `/apps/members-portal/styles/components/nav.css` updated (full replacement)
- [ ] `dashboard.html` updated (nav structure)
- [ ] `profile.html` updated (nav structure)
- [ ] `events.html` updated (nav structure)
- [ ] `elections.html` updated (nav structure)
- [ ] `election-detail.html` updated (nav structure)
- [ ] `test-events.html` updated (nav structure)
- [ ] Desktop testing passed (all pages)
- [ ] Mobile testing passed (all pages)
- [ ] Keyboard testing passed
- [ ] Console errors checked (none)
- [ ] Git commit created
- [ ] Deployed to Firebase
- [ ] Production testing passed

---

## Estimated Time

- **Step 1**: Create nav.js (15 min)
- **Step 2**: Update page-init.js (5 min)
- **Step 3**: Update nav.css (30 min)
- **Step 4**: Update 6 HTML files (45 min)
- **Step 5**: Testing (30 min)
- **Step 6**: Deploy (10 min)

**Total**: ~2 hours 15 minutes

---

## Reference

Full implementation details: `/docs/migration/HAMBURGER_MENU_IMPLEMENTATION_PLAN.md`

---

**Ready to implement? Follow the steps above in order. Good luck! 🚀**
