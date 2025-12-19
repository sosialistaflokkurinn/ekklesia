/**
 * Lazy Image Loading Utility
 *
 * Uses IntersectionObserver to load images only when
 * they enter the viewport. Improves initial page load.
 *
 * @module utils/lazy-images
 */

import { debug } from './util-debug.js';

/** @type {IntersectionObserver|null} */
let observer = null;

/** Options for IntersectionObserver */
const OBSERVER_OPTIONS = {
  root: null,
  rootMargin: '50px 0px', // Start loading 50px before visible
  threshold: 0.01
};

/**
 * Initialize lazy loading for images.
 * Call once on page load.
 *
 * @example
 * // In your page initialization
 * import { initLazyImages } from './utils/util-lazy-images.js';
 * initLazyImages();
 */
export function initLazyImages() {
  if (observer) {
    debug.debug('Lazy image observer already initialized');
    return;
  }

  if (!('IntersectionObserver' in window)) {
    debug.warn('IntersectionObserver not supported, loading all images');
    loadAllImages();
    return;
  }

  observer = new IntersectionObserver(handleIntersection, OBSERVER_OPTIONS);

  // Observe all lazy images
  const lazyImages = document.querySelectorAll('img[data-src]');
  lazyImages.forEach(img => observer.observe(img));

  debug.debug('Lazy image observer initialized', { imageCount: lazyImages.length });
}

/**
 * Handle intersection events
 * @param {IntersectionObserverEntry[]} entries
 */
function handleIntersection(entries) {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      loadImage(entry.target);
      observer.unobserve(entry.target);
    }
  });
}

/**
 * Load a single lazy image
 * @param {HTMLImageElement} img - Image element
 */
function loadImage(img) {
  const src = img.dataset.src;
  const srcset = img.dataset.srcset;

  if (!src) return;

  // Add loading class for transition
  img.classList.add('lazy-loading');

  // Handle load event
  img.onload = () => {
    img.classList.remove('lazy-loading');
    img.classList.add('lazy-loaded');
    img.removeAttribute('data-src');
    img.removeAttribute('data-srcset');
  };

  // Handle error
  img.onerror = () => {
    img.classList.remove('lazy-loading');
    img.classList.add('lazy-error');
    debug.warn('Failed to load image', { src });
  };

  // Set source to trigger load
  if (srcset) {
    img.srcset = srcset;
  }
  img.src = src;
}

/**
 * Fallback: Load all lazy images immediately
 * Used when IntersectionObserver is not available
 */
function loadAllImages() {
  const lazyImages = document.querySelectorAll('img[data-src]');
  lazyImages.forEach(loadImage);
}

/**
 * Observe a new lazy image (for dynamically added images)
 *
 * @param {HTMLImageElement} img - Image element with data-src
 *
 * @example
 * // When adding new images dynamically
 * const img = document.createElement('img');
 * img.dataset.src = '/images/photo.jpg';
 * img.alt = 'Photo';
 * container.appendChild(img);
 * observeLazyImage(img);
 */
export function observeLazyImage(img) {
  if (!observer) {
    initLazyImages();
  }

  if (observer && img.dataset.src) {
    observer.observe(img);
  }
}

/**
 * Stop observing an image
 *
 * @param {HTMLImageElement} img - Image element
 */
export function unobserveLazyImage(img) {
  if (observer) {
    observer.unobserve(img);
  }
}

/**
 * Create a lazy image element
 *
 * @param {Object} options - Image options
 * @param {string} options.src - Image source URL
 * @param {string} options.alt - Alt text
 * @param {string} options.srcset - Optional srcset
 * @param {string} options.sizes - Optional sizes
 * @param {string} options.className - Optional CSS class
 * @param {string} options.placeholder - Optional placeholder image
 * @returns {HTMLImageElement} Lazy image element
 *
 * @example
 * const img = createLazyImage({
 *   src: '/images/member-photo.jpg',
 *   alt: 'Member photo',
 *   className: 'member-avatar'
 * });
 * container.appendChild(img);
 */
export function createLazyImage(options = {}) {
  const {
    src,
    alt = '',
    srcset,
    sizes,
    className,
    placeholder = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
  } = options;

  const img = document.createElement('img');
  img.src = placeholder;
  img.dataset.src = src;
  img.alt = alt;
  img.className = `lazy-image ${className || ''}`.trim();

  if (srcset) {
    img.dataset.srcset = srcset;
  }
  if (sizes) {
    img.sizes = sizes;
  }

  // Start observing
  observeLazyImage(img);

  return img;
}

/**
 * Disconnect the observer and clean up
 * Call when leaving a page or cleaning up
 */
export function destroyLazyImages() {
  if (observer) {
    observer.disconnect();
    observer = null;
    debug.debug('Lazy image observer destroyed');
  }
}

/**
 * Refresh lazy images (useful after DOM changes)
 * Re-observes all unloaded lazy images
 */
export function refreshLazyImages() {
  if (!observer) {
    initLazyImages();
    return;
  }

  const lazyImages = document.querySelectorAll('img[data-src]');
  lazyImages.forEach(img => {
    if (!img.classList.contains('lazy-loaded')) {
      observer.observe(img);
    }
  });

  debug.debug('Lazy images refreshed', { count: lazyImages.length });
}
