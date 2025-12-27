/**
 * Analytics Tracking Utility
 *
 * Tracks user activity for understanding portal usage.
 * Automatically excludes admin users on the backend.
 *
 * @module utils/util-analytics
 */

import { getFirebaseAuth } from '../../firebase/app.js';

const EVENTS_API_BASE = 'https://events-service-521240388393.europe-west1.run.app';

// Generate a session ID that persists across page navigations
function getSessionId() {
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
}

/**
 * Track an event
 * @param {string} eventType - 'page_view', 'click', 'action'
 * @param {string} eventName - Name of the event (e.g., 'home', 'elections', 'chat_open')
 * @param {object} eventData - Optional additional data
 */
export async function trackEvent(eventType, eventName, eventData = null) {
  try {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;

    if (!user) {
      // Not logged in, don't track
      return;
    }

    const token = await user.getIdToken();

    const payload = {
      eventType,
      eventName,
      eventData,
      pagePath: window.location.pathname,
      referrer: document.referrer || null,
      sessionId: getSessionId(),
    };

    // Fire and forget - don't wait for response
    fetch(`${EVENTS_API_BASE}/api/analytics/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silently ignore errors - analytics should never break the app
    });
  } catch (e) {
    // Silently ignore - analytics should never break the app
  }
}

/**
 * Track a page view
 * @param {string} pageName - Name of the page
 */
export function trackPageView(pageName) {
  trackEvent('page_view', pageName);
}

/**
 * Track a click event
 * @param {string} elementName - Name of the clicked element
 * @param {object} data - Optional additional data
 */
export function trackClick(elementName, data = null) {
  trackEvent('click', elementName, data);
}

/**
 * Track an action
 * @param {string} actionName - Name of the action
 * @param {object} data - Optional additional data
 */
export function trackAction(actionName, data = null) {
  trackEvent('action', actionName, data);
}

/**
 * Auto-track page views on navigation
 * Call this once on app initialization
 */
export function initAutoTracking() {
  // Track initial page view
  const pageName = getPageName();
  trackPageView(pageName);

  // Track navigation changes (for SPAs)
  let lastPath = window.location.pathname;

  // Use MutationObserver to detect SPA navigation
  const observer = new MutationObserver(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      trackPageView(getPageName());
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Also listen for popstate (back/forward navigation)
  window.addEventListener('popstate', () => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      trackPageView(getPageName());
    }
  });
}

/**
 * Get a friendly page name from the current path
 */
function getPageName() {
  const path = window.location.pathname;

  // Map paths to friendly names
  const pageNames = {
    '/': 'home',
    '/index.html': 'home',
    '/members-area/': 'members_area',
    '/members-area/index.html': 'members_area',
    '/members-area/heatmap.html': 'heatmap',
    '/elections/': 'elections',
    '/elections/index.html': 'elections',
    '/events/': 'events',
    '/events/index.html': 'events',
    '/admin/': 'admin',
    '/admin/index.html': 'admin',
    '/nomination/': 'nomination',
    '/nomination/index.html': 'nomination',
    '/policy-session/': 'policy_session',
    '/session/': 'session',
    '/superuser/': 'superuser',
  };

  return pageNames[path] || path.replace(/\//g, '_').replace(/\.html$/, '') || 'unknown';
}

export default {
  trackEvent,
  trackPageView,
  trackClick,
  trackAction,
  initAutoTracking,
};
