/**
 * Debounce utility
 * 
 * Delays function execution until after a specified wait time has elapsed
 * since the last time it was invoked. Useful for rate-limiting expensive
 * operations like auto-save, search queries, or resize handlers.
 * 
 * @example
 * // Auto-save after user stops typing for 500ms
 * const debouncedSave = debounce(saveField, 500);
 * input.addEventListener('input', () => debouncedSave('name', input.value));
 * 
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait before executing
 * @param {boolean} [immediate=false] - Execute on leading edge instead of trailing
 * @returns {Function} Debounced function
 */
export function debounce(func, wait, immediate = false) {
  let timeout;
  
  return function executedFunction(...args) {
    const context = this;
    
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    
    const callNow = immediate && !timeout;
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func.apply(context, args);
  };
}

/**
 * Throttle utility
 * 
 * Ensures a function is called at most once per specified time period.
 * Unlike debounce, throttle guarantees execution at regular intervals.
 * 
 * @example
 * // Limit scroll handler to once per 100ms
 * const throttledScroll = throttle(handleScroll, 100);
 * window.addEventListener('scroll', throttledScroll);
 * 
 * @param {Function} func - Function to throttle
 * @param {number} limit - Milliseconds between executions
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
  let inThrottle;

  return function executedFunction(...args) {
    const context = this;

    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Create a debounced async function that only keeps
 * the most recent call's promise.
 *
 * Useful for search-as-you-type where you want to
 * cancel previous API calls when a new one starts.
 *
 * @param {Function} fn - Async function to debounce
 * @param {number} wait - Delay in milliseconds (default: 300)
 * @returns {Function} Debounced async function
 *
 * @example
 * const debouncedSearch = debounceAsync(async (query) => {
 *   const response = await fetch(`/api/search?q=${query}`);
 *   return response.json();
 * }, 300);
 *
 * // Only the last call will resolve
 * debouncedSearch('h');
 * debouncedSearch('he');
 * const results = await debouncedSearch('hello'); // Only this resolves
 */
export function debounceAsync(fn, wait = 300) {
  let timeoutId = null;
  let currentController = null;

  return async function debouncedAsyncFn(...args) {
    // Cancel previous pending call
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (currentController) {
      currentController.abort();
    }

    return new Promise((resolve, reject) => {
      currentController = new AbortController();
      const controller = currentController;

      timeoutId = setTimeout(async () => {
        timeoutId = null;
        try {
          if (controller.signal.aborted) {
            return;
          }
          const result = await fn(...args);
          if (!controller.signal.aborted) {
            resolve(result);
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            reject(error);
          }
        }
      }, wait);

      // Handle abort
      controller.signal.addEventListener('abort', () => {
        reject(new DOMException('Debounced call cancelled', 'AbortError'));
      });
    });
  };
}
