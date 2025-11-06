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
