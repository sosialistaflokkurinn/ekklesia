/**
 * Cold Start Detection Utility
 *
 * Shows user-friendly notifications when API requests take longer than expected,
 * indicating that a Cloud Run service might be experiencing a cold start.
 */

import { debug } from './util-debug.js';

// Configuration
const COLD_START_THRESHOLD_MS = 3000;  // Show message after 3 seconds
const SLOW_REQUEST_THRESHOLD_MS = 8000; // Update message after 8 seconds

// State
let activeRequests = 0;
let coldStartTimer = null;
let slowRequestTimer = null;
let toastElement = null;

/**
 * Create toast element if not exists
 */
function ensureToastElement() {
  if (toastElement) return toastElement;

  // Add styles
  const style = document.createElement('style');
  style.id = 'cold-start-styles';
  style.textContent = `
    .cold-start-toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: var(--color-surface, #fff);
      color: var(--color-text, #333);
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 10000;
      opacity: 0;
      transition: transform 0.3s ease, opacity 0.3s ease;
      font-size: 0.9rem;
    }

    .cold-start-toast--visible {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }

    .cold-start-toast__spinner {
      width: 20px;
      height: 20px;
      border: 2px solid var(--color-border, #ddd);
      border-top-color: var(--color-burgundy, #722f37);
      border-radius: 50%;
      animation: cold-start-spin 0.8s linear infinite;
    }

    @keyframes cold-start-spin {
      to { transform: rotate(360deg); }
    }

    .cold-start-toast__text {
      white-space: nowrap;
    }
  `;
  document.head.appendChild(style);

  // Create toast element
  toastElement = document.createElement('div');
  toastElement.className = 'cold-start-toast';
  // SECURITY: Static HTML only - no user input
  toastElement.innerHTML = `
    <div class="cold-start-toast__spinner"></div>
    <span class="cold-start-toast__text">Þjónustan er að vakna...</span>
  `;
  document.body.appendChild(toastElement);

  return toastElement;
}

/**
 * Show cold start toast with message
 */
function showToast(message) {
  const toast = ensureToastElement();
  const textEl = toast.querySelector('.cold-start-toast__text');
  if (textEl) textEl.textContent = message;
  toast.classList.add('cold-start-toast--visible');
}

/**
 * Hide cold start toast
 */
function hideToast() {
  if (toastElement) {
    toastElement.classList.remove('cold-start-toast--visible');
  }
}

/**
 * Start tracking a request for cold start detection
 * Call this when starting an API request
 * @returns {Function} Cleanup function to call when request completes
 */
export function trackRequest() {
  activeRequests++;

  // Only set timers for first request
  if (activeRequests === 1) {
    coldStartTimer = setTimeout(() => {
      showToast('Þjónustan er að vakna...');
    }, COLD_START_THRESHOLD_MS);

    slowRequestTimer = setTimeout(() => {
      showToast('Sæki gögn, vinsamlegast bíðið...');
    }, SLOW_REQUEST_THRESHOLD_MS);
  }

  // Return cleanup function
  return () => {
    activeRequests = Math.max(0, activeRequests - 1);

    // Hide toast and clear timers when all requests complete
    if (activeRequests === 0) {
      if (coldStartTimer) {
        clearTimeout(coldStartTimer);
        coldStartTimer = null;
      }
      if (slowRequestTimer) {
        clearTimeout(slowRequestTimer);
        slowRequestTimer = null;
      }
      hideToast();
    }
  };
}

/**
 * Wrap a fetch call with cold start detection
 * @param {Promise} fetchPromise - The fetch promise to wrap
 * @returns {Promise} The original promise result
 */
export async function withColdStartDetection(fetchPromise) {
  const cleanup = trackRequest();
  try {
    return await fetchPromise;
  } finally {
    cleanup();
  }
}

/**
 * Create a fetch wrapper with cold start detection
 * @param {string} url - URL to fetch
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export async function fetchWithColdStart(url, options = {}) {
  return withColdStartDetection(fetch(url, options));
}

debug.log('Cold start detection utility loaded');
