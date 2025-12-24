/**
 * Health Summary - Header Status Display
 *
 * Manages the health summary in the page header and breakdown counts.
 */

import { superuserStrings } from '../i18n/superuser-strings-loader.js';
import { formatTimeIcelandic } from '../../../js/utils/util-format.js';
import { getOverallStatus, getLastFetchTime } from '../services/health-service.js';

/**
 * Update the health summary in the header
 */
export function updateHealthSummary() {
  const { status, healthy, degraded, down, available } = getOverallStatus();

  let text;
  if (down > 0) {
    text = superuserStrings.get('health_summary_down')?.replace('%s', down) || `${down} niðri`;
  } else if (degraded > 0) {
    text = superuserStrings.get('health_summary_degraded')?.replace('%s', degraded) || `${degraded} hægvirkar`;
  } else {
    const healthyTotal = healthy + available;
    text = superuserStrings.get('health_summary_healthy')?.replace('%s', healthyTotal) || `${healthyTotal} heilbrigðar`;
  }

  updateSummaryStatus(status, text);
  updateLastUpdatedTime();
}

/**
 * Show loading state in health summary
 */
export function showLoadingStatus() {
  const loadingText = superuserStrings.get('health_checking') || 'Athuga stöðu...';
  updateSummaryStatus('loading', loadingText);
}

/**
 * Update the status indicator and text
 */
function updateSummaryStatus(status, text) {
  const summary = document.getElementById('health-summary');
  if (!summary) return;

  const statusDiv = summary.querySelector('.health-summary__status');
  const textSpan = summary.querySelector('.health-summary__text');

  if (!statusDiv || !textSpan) return;

  // Remove old status classes
  statusDiv.classList.remove(
    'health-summary__status--loading',
    'health-summary__status--healthy',
    'health-summary__status--degraded',
    'health-summary__status--down'
  );

  // Add new status class
  statusDiv.classList.add(`health-summary__status--${status}`);
  textSpan.textContent = text;
}

/**
 * Update the "last updated" timestamp
 */
function updateLastUpdatedTime() {
  const timestamp = document.getElementById('last-updated');
  if (!timestamp) return;

  const lastFetch = getLastFetchTime();
  if (lastFetch) {
    const timeStr = formatTimeIcelandic(lastFetch);
    const template = superuserStrings.get('health_last_updated') || '%s';
    timestamp.textContent = template.replace('%s', timeStr);
  }
}

/**
 * Update the breakdown counts in the services tab
 */
export function updateBreakdownCounts(counts) {
  const setCount = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setCount('count-gcp', counts.gcp);
  setCount('count-functions', counts.functions);
  setCount('count-database', counts.database);
  setCount('count-firebase', counts.firebase);
}
