/**
 * Audit Logs Viewer - Superuser Console
 *
 * Frontend for viewing system audit logs from Cloud Logging.
 *
 * Module cleanup not needed - page reloads on navigation.
 *
 * Backend: Requires Cloud Function `get-audit-logs` (to be implemented)
 */

import { initSession, showAuthenticatedContent } from '../../session/init.js';
import { AuthenticationError } from '../../session/auth.js';
import { debug } from '../../js/utils/util-debug.js';
import { httpsCallable } from '../../firebase/app.js';
import { requireSuperuser } from '../../js/rbac.js';
import { showToast } from '../../js/components/ui-toast.js';
import { R } from '../../i18n/strings-loader.js';
import { superuserStrings } from './i18n/superuser-strings-loader.js';
import { escapeHTML } from '../../js/utils/util-format.js';

// Use centralized escapeHTML from util-format.js
const escapeHtml = escapeHTML;

// Mock data for demonstration (until Cloud Function is implemented)
const MOCK_LOGS = [
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    severity: 'INFO',
    service: 'elections-service',
    message: 'Election opened: Prófunarkosning 2025',
    correlationId: 'abc-123-def',
    user: 'gudrodur@gmail.com'
  },
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    severity: 'INFO',
    service: 'sync-from-django',
    message: 'Member synced: 0101902939',
    correlationId: 'xyz-456-uvw'
  },
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    severity: 'WARNING',
    service: 'verifymembership',
    message: 'Membership verification slow: 2.5s response time',
    correlationId: 'warn-789-abc'
  },
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    severity: 'ERROR',
    service: 'handlekenniauth',
    message: 'OAuth token refresh failed: invalid_grant',
    correlationId: 'err-012-xyz',
    error: 'TokenRefreshError: The refresh token is invalid or expired'
  },
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    severity: 'INFO',
    service: 'elections-service',
    message: 'Vote recorded for election: test-election-001',
    correlationId: 'vote-345-ghi'
  }
];

/**
 * Format timestamp for display
 */
function formatTimestamp(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('is-IS', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Get severity badge class
 */
function getSeverityClass(severity) {
  switch (severity) {
    case 'ERROR': return 'log-level--error';
    case 'WARNING': return 'log-level--warning';
    case 'INFO': return 'log-level--info';
    case 'DEBUG': return 'log-level--debug';
    default: return '';
  }
}

/**
 * Render log entry
 */
function renderLogEntry(log) {
  return `
    <div class="audit-log-entry audit-log-entry--${escapeHtml(log.severity.toLowerCase())}">
      <div class="audit-log-entry__header">
        <span class="audit-log-entry__time">${formatTimestamp(log.timestamp)}</span>
        <span class="audit-log-entry__service">${escapeHtml(log.service)}</span>
        <span class="audit-log-entry__action">${escapeHtml(log.action)}</span>
      </div>
      <div class="audit-log-entry__message">${escapeHtml(log.message)}</div>
      <div class="audit-log-entry__meta">
        ${log.correlationId ? `<span class="audit-log-entry__correlation">ID: ${escapeHtml(log.correlationId)}</span>` : ''}
        ${log.user ? `<span class="audit-log-entry__user">${superuserStrings.get('audit_user_label')} ${escapeHtml(log.user)}</span>` : ''}
      </div>
    </div>
  `;
}

/**
 * Render logs list
 */
function renderLogs(logs) {
  const container = document.getElementById('audit-results');
  const countEl = document.getElementById('results-count');

  if (logs.length === 0) {
    container.innerHTML = `
      <div class="audit-placeholder">
        <p>${superuserStrings.get('audit_no_events')}</p>
      </div>
    `;
    countEl.textContent = superuserStrings.get('audit_count_zero');
    return;
  }

  container.innerHTML = logs.map(renderLogEntry).join('');
  countEl.textContent = superuserStrings.get('audit_count_format').replace('%s', logs.length);
}

/**
 * Filter logs based on current filters
 */
function filterLogs(logs) {
  const service = document.getElementById('filter-service').value;
  const level = document.getElementById('filter-level').value;
  const hours = parseInt(document.getElementById('filter-hours').value);
  const correlation = document.getElementById('filter-correlation').value.trim().toLowerCase();

  const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);

  return logs.filter(log => {
    // Service filter
    if (service !== 'all' && log.service !== service) return false;

    // Level filter
    if (level !== 'all' && log.severity !== level) return false;

    // Time filter
    if (new Date(log.timestamp).getTime() < cutoffTime) return false;

    // Correlation ID filter
    if (correlation && !log.correlationId?.toLowerCase().includes(correlation)) return false;

    return true;
  });
}

/**
 * Search logs using Cloud Function
 */
async function searchLogs() {
  const searchBtn = document.getElementById('search-btn');
  searchBtn.disabled = true;
  searchBtn.textContent = superuserStrings.get('btn_search_loading');

  try {
    // Get filter values
    const service = document.getElementById('filter-service').value;
    const level = document.getElementById('filter-level').value;
    const hours = parseInt(document.getElementById('filter-hours').value);
    const correlationId = document.getElementById('filter-correlation').value.trim();

    // Call Cloud Function
    const getAuditLogs = httpsCallable('getAuditLogs', 'europe-west2');

    const result = await getAuditLogs({
      service: service !== 'all' ? service : null,
      severity: level !== 'all' ? level : null,
      hours,
      correlation_id: correlationId || null,
      limit: 100
    });

    const logsData = result.data;
    debug.log('Audit logs result:', logsData);

    renderLogs(logsData.logs || []);

  } catch (error) {
    debug.error('Error fetching logs:', error);

    // Fallback to mock data if Cloud Function fails
    debug.log('Falling back to mock data');
    const filteredLogs = filterLogs(MOCK_LOGS);
    renderLogs(filteredLogs);
    showToast(superuserStrings.get('audit_fetch_error'), 'warning', { duration: 3000 });
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = superuserStrings.get('btn_search');
  }
}

/**
 * Initialize filters
 */
function initFilters() {
  document.getElementById('search-btn').addEventListener('click', searchLogs);

  // Enter key in correlation ID field triggers search
  document.getElementById('filter-correlation').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      searchLogs();
    }
  });
}

/**
 * Initialize page
 */
async function init() {
  try {
    await R.load('is');
    await superuserStrings.load();
    superuserStrings.translatePage();  // Translate data-i18n elements
    await initSession();
    await requireSuperuser();

    // Auth verified - show page content
    showAuthenticatedContent();

    initFilters();

    debug.log('Audit logs page initialized');

  } catch (error) {
    debug.error('Failed to initialize audit logs:', error);

    // Auth error - redirect to login
    if (error instanceof AuthenticationError) {
      window.location.href = '/';
      return;
    }

    if (error.message?.includes('Superuser role required')) {
      return;
    }

    showToast(superuserStrings.get('dangerous_op_error')?.replace('%s', error.message) || error.message, 'error');
  }
}

init();
