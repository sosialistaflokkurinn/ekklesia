/**
 * Debug Logger for Ekklesia Election Creation Issue
 * Automatically captures console logs, network requests, and navigation events
 * for debugging user-specific issues.
 *
 * Module cleanup not needed - debug logger persists for page lifetime.
 *
 * Usage: Add to page with <script src="js/debug-logger.js"></script>
 * Only activates for specific devices (LM-G710) or when debug_mode is enabled.
 */

class DebugLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 200; // Increased for election creation flow
    this.enabled = this.shouldEnable();
    this.sessionId = this.generateSessionId();
    
    if (this.enabled) {
      this.init();
      console.log('[DebugLogger] Initialized - Session:', this.sessionId);
    }
  }
  
  generateSessionId() {
    return `debug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  shouldEnable() {
    // Enable for specific device
    const ua = navigator.userAgent;
    const isTargetDevice = ua.includes('LM-G710'); // Jón's LG G7 ThinQ
    
    // Or enable via localStorage flag (for testing)
    const debugMode = localStorage.getItem('ekklesia_debug_mode') === 'true';
    
    // Or enable via URL parameter ?debug=true
    const urlDebug = new URLSearchParams(window.location.search).get('debug') === 'true';
    
    return isTargetDevice || debugMode || urlDebug;
  }
  
  init() {
    // Intercept console methods
    this.interceptConsole();
    
    // Intercept fetch API
    this.interceptFetch();
    
    // Intercept XMLHttpRequest (for older code)
    this.interceptXHR();
    
    // Track navigation events
    this.trackNavigation();
    
    // Track errors
    this.trackErrors();
    
    // Track performance
    this.trackPerformance();
    
    // Add export button
    this.addExportButton();
    
    // Log initial page load
    this.capture('page-load', {
      url: window.location.href,
      referrer: document.referrer,
      timestamp: new Date().toISOString()
    });
  }
  
  interceptConsole() {
    const methods = ['log', 'warn', 'error', 'info', 'debug'];
    
    methods.forEach(method => {
      const original = console[method];
      console[method] = (...args) => {
        // Capture to our log
        this.capture(`console.${method}`, {
          args: args.map(arg => {
            if (typeof arg === 'object') {
              try {
                return JSON.parse(JSON.stringify(arg));
              } catch (e) {
                return String(arg);
              }
            }
            return arg;
          }),
          timestamp: new Date().toISOString()
        });
        
        // Call original
        original.apply(console, args);
      };
    });
  }
  
  interceptFetch() {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const requestId = Math.random().toString(36).substr(2, 9);
      const startTime = performance.now();
      
      // Log request
      const requestInfo = {
        id: requestId,
        url: args[0],
        method: args[1]?.method || 'GET',
        headers: args[1]?.headers,
        body: args[1]?.body,
        timestamp: new Date().toISOString()
      };
      
      // Don't log full body if it's too large, just summary
      if (requestInfo.body && requestInfo.body.length > 1000) {
        requestInfo.bodySize = requestInfo.body.length;
        requestInfo.body = requestInfo.body.substring(0, 200) + '... (truncated)';
      }
      
      this.capture('fetch-request', requestInfo);
      
      try {
        const response = await originalFetch(...args);
        const duration = performance.now() - startTime;
        
        // Clone response to read body without consuming it
        const clonedResponse = response.clone();
        let responseBody = null;
        
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            responseBody = await clonedResponse.json();
          } else {
            responseBody = await clonedResponse.text();
          }
        } catch (e) {
          responseBody = '[Could not read response body]';
        }
        
        // Log response
        this.capture('fetch-response', {
          id: requestId,
          url: args[0],
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
          duration: `${duration.toFixed(2)}ms`,
          timestamp: new Date().toISOString()
        });
        
        return response;
      } catch (error) {
        const duration = performance.now() - startTime;
        
        // Log error
        this.capture('fetch-error', {
          id: requestId,
          url: args[0],
          error: error.message,
          name: error.name,
          duration: `${duration.toFixed(2)}ms`,
          timestamp: new Date().toISOString()
        });
        
        throw error;
      }
    };
  }
  
  interceptXHR() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this._debugInfo = {
        method,
        url,
        startTime: performance.now()
      };
      return originalOpen.apply(this, [method, url, ...rest]);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
      const xhr = this;
      
      xhr.addEventListener('load', function() {
        const duration = performance.now() - xhr._debugInfo.startTime;
        
        window.debugLogger?.capture('xhr-response', {
          method: xhr._debugInfo.method,
          url: xhr._debugInfo.url,
          status: xhr.status,
          statusText: xhr.statusText,
          response: xhr.response,
          duration: `${duration.toFixed(2)}ms`,
          timestamp: new Date().toISOString()
        });
      });
      
      xhr.addEventListener('error', function() {
        window.debugLogger?.capture('xhr-error', {
          method: xhr._debugInfo.method,
          url: xhr._debugInfo.url,
          error: 'Network error',
          timestamp: new Date().toISOString()
        });
      });
      
      return originalSend.apply(this, args);
    };
  }
  
  trackNavigation() {
    // Track page unload (redirect/reload)
    window.addEventListener('beforeunload', (e) => {
      this.capture('beforeunload', {
        url: window.location.href,
        timestamp: new Date().toISOString()
      });
      
      // Try to save logs before leaving
      this.saveToLocalStorage();
    });
    
    // Track hash changes
    window.addEventListener('hashchange', (e) => {
      this.capture('hashchange', {
        oldURL: e.oldURL,
        newURL: e.newURL,
        timestamp: new Date().toISOString()
      });
    });
    
    // Track popstate (back/forward)
    window.addEventListener('popstate', (e) => {
      this.capture('popstate', {
        state: e.state,
        url: window.location.href,
        timestamp: new Date().toISOString()
      });
    });
  }
  
  trackErrors() {
    window.addEventListener('error', (e) => {
      this.capture('window-error', {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        error: e.error?.stack,
        timestamp: new Date().toISOString()
      });
    });
    
    window.addEventListener('unhandledrejection', (e) => {
      this.capture('unhandled-promise-rejection', {
        reason: e.reason,
        promise: String(e.promise),
        timestamp: new Date().toISOString()
      });
    });
  }
  
  trackPerformance() {
    // Track long tasks (> 50ms)
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              this.capture('long-task', {
                name: entry.name,
                duration: `${entry.duration.toFixed(2)}ms`,
                startTime: entry.startTime,
                timestamp: new Date().toISOString()
              });
            }
          }
        });
        
        observer.observe({ entryTypes: ['longtask', 'measure'] });
      } catch (e) {
        console.warn('[DebugLogger] PerformanceObserver not supported:', e);
      }
    }
  }
  
  capture(type, data) {
    const entry = {
      type,
      data,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      sessionId: this.sessionId
    };
    
    this.logs.push(entry);
    
    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    // Also save to localStorage periodically
    if (this.logs.length % 10 === 0) {
      this.saveToLocalStorage();
    }
  }
  
  saveToLocalStorage() {
    try {
      localStorage.setItem('ekklesia_debug_logs', JSON.stringify(this.logs));
    } catch (e) {
      console.warn('[DebugLogger] Could not save to localStorage:', e);
    }
  }
  
  addExportButton() {
    // Create button
    const button = document.createElement('button');
    button.id = 'debug-export-btn';
    button.innerHTML = '📋 Export Debug Logs';
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 99999;
      padding: 12px 20px;
      background: linear-gradient(135deg, var(--color-admin-blue) 0%, var(--color-admin-purple) 100%);
      color: var(--color-white);
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 15px var(--color-admin-blue-alpha-40);
      transition: all 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    
    button.onmouseover = () => {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 6px 20px var(--color-admin-blue-alpha-60)';
    };
    
    button.onmouseout = () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 4px 15px var(--color-admin-blue-alpha-40)';
    };
    
    button.onclick = () => this.export();
    
    // Add to page when DOM is ready
    if (document.body) {
      document.body.appendChild(button);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(button);
      });
    }
  }
  
  export() {
    const data = {
      sessionId: this.sessionId,
      exportTimestamp: new Date().toISOString(),
      device: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        languages: navigator.languages,
        online: navigator.onLine,
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        hardwareConcurrency: navigator.hardwareConcurrency,
        maxTouchPoints: navigator.maxTouchPoints,
        vendor: navigator.vendor,
        screenWidth: screen.width,
        screenHeight: screen.height,
        colorDepth: screen.colorDepth,
        pixelRatio: window.devicePixelRatio
      },
      session: {
        url: window.location.href,
        hostname: window.location.hostname,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        referrer: document.referrer,
        title: document.title
      },
      performance: {
        memory: performance.memory ? {
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          usedJSHeapSize: performance.memory.usedJSHeapSize
        } : null,
        timing: performance.timing ? {
          navigationStart: performance.timing.navigationStart,
          loadEventEnd: performance.timing.loadEventEnd,
          domContentLoadedEventEnd: performance.timing.domContentLoadedEventEnd,
          domInteractive: performance.timing.domInteractive
        } : null
      },
      logs: this.logs,
      logCount: this.logs.length
    };
    
    // Download as JSON
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `ekklesia-debug-${this.sessionId}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    
    // Show success message
    alert(`✅ Debug logs exported!\n\nFile: ekklesia-debug-${this.sessionId}.json\n\nSendu þessa skrá til tækniteymis.`);
    
    console.log('[DebugLogger] Logs exported:', data.logCount, 'entries');
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.debugLogger = new DebugLogger();
  });
} else {
  window.debugLogger = new DebugLogger();
}

// Expose manual controls
window.enableDebugMode = () => {
  localStorage.setItem('ekklesia_debug_mode', 'true');
  alert('Debug mode enabled! Reload page to activate.');
};

window.disableDebugMode = () => {
  localStorage.removeItem('ekklesia_debug_mode');
  alert('Debug mode disabled!');
};
