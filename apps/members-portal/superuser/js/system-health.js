/**
 * System Health Dashboard - Superuser Console
 *
 * Displays real-time health status of all services.
 * Uses health check endpoints where available.
 */

import { initSession } from '../../session/init.js';
import { debug } from '../../js/utils/util-debug.js';
import { httpsCallable } from '../../firebase/app.js';
import { requireSuperuser } from '../../js/rbac.js';
import { showToast } from '../../js/components/ui-toast.js';
import { R } from '../../i18n/strings-loader.js';
import { superuserStrings } from './i18n/superuser-strings-loader.js';

// Service definitions - synced with backend superuser_functions.py

// Core GCP services with health endpoints (actively checked)
const CORE_SERVICES = [
  { id: 'elections-service', nameKey: 'service_name_elections' },
  { id: 'events-service', nameKey: 'service_name_events' },
  { id: 'healthz', nameKey: 'service_name_healthz' },
  { id: 'django-socialism', nameKey: 'service_name_django_socialism' },
];

// External services (Linode, etc.)
const EXTERNAL_SERVICES = [];

// Demo/Test services (not in production yet)
const DEMO_SERVICES = [];

// Firebase Functions - Member Operations (no health endpoint)
const MEMBER_FUNCTIONS = [
  { id: 'handlekenniauth', nameKey: 'service_name_handlekenniauth' },
  { id: 'verifymembership', nameKey: 'service_name_verifymembership' },
  { id: 'syncmembers', nameKey: 'service_name_syncmembers' },
  { id: 'sync-from-django', nameKey: 'service_name_sync_from_django' },
  { id: 'updatememberprofile', nameKey: 'service_name_updatememberprofile' },
  { id: 'auditmemberchanges', nameKey: 'service_name_auditmemberchanges' },
];

// Firebase Functions - Address Validation
const ADDRESS_FUNCTIONS = [
  { id: 'search-addresses', nameKey: 'service_name_search_addresses' },
  { id: 'validate-address', nameKey: 'service_name_validate_address' },
  { id: 'validate-postal-code', nameKey: 'service_name_validate_postal_code' },
];

// Firebase Functions - Lookup Data (skraning-static)
const LOOKUP_FUNCTIONS = [
  { id: 'list-unions', nameKey: 'service_name_list_unions' },
  { id: 'list-job-titles', nameKey: 'service_name_list_job_titles' },
  { id: 'list-countries', nameKey: 'service_name_list_countries' },
  { id: 'list-postal-codes', nameKey: 'service_name_list_postal_codes' },
  { id: 'get-cells-by-postal-code', nameKey: 'service_name_get_cells_by_postal_code' },
];

// Firebase Functions - Registration (skraning-static)
const REGISTRATION_FUNCTIONS = [
  { id: 'register-member', nameKey: 'service_name_register_member' },
];

// Firebase Functions - Superuser Operations
const SUPERUSER_FUNCTIONS = [
  { id: 'checksystemhealth', nameKey: 'service_name_checksystemhealth' },
  { id: 'setuserrole', nameKey: 'service_name_setuserrole' },
  { id: 'getuserrole', nameKey: 'service_name_getuserrole' },
  { id: 'getauditlogs', nameKey: 'service_name_getauditlogs' },
  { id: 'getloginaudit', nameKey: 'service_name_getloginaudit' },
  { id: 'harddeletemember', nameKey: 'service_name_harddeletemember' },
  { id: 'anonymizemember', nameKey: 'service_name_anonymizemember' },
  { id: 'listelevatedusers', nameKey: 'service_name_listelevatedusers' },
];

// Firebase Functions - Utility/Background
const UTILITY_FUNCTIONS = [
  { id: 'get-django-token', nameKey: 'service_name_get_django_token' },
  { id: 'cleanupauditlogs', nameKey: 'service_name_cleanupauditlogs' },
];

// Combined for backward compatibility
const FIREBASE_FUNCTIONS = [...MEMBER_FUNCTIONS, ...ADDRESS_FUNCTIONS, ...LOOKUP_FUNCTIONS, ...REGISTRATION_FUNCTIONS, ...SUPERUSER_FUNCTIONS, ...UTILITY_FUNCTIONS];

const DATABASE_SERVICES = [
  { id: 'firestore', name: 'Firestore', status: 'unknown' },
  { id: 'cloudsql', name: 'Cloud SQL (PostgreSQL)', status: 'unknown' },
];

const FIREBASE_SERVICES = [
  { id: 'firebase-auth', name: 'Firebase Auth', status: 'unknown' },
  { id: 'firebase-hosting', name: 'Firebase Hosting', status: 'healthy' }
];

/**
 * Check health of a single service
 */
async function checkServiceHealth(service) {
  if (!service.url) {
    return { ...service, status: 'unknown', message: superuserStrings.get('service_status_no_url') };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(service.url, {
      method: 'GET',
      signal: controller.signal,
      mode: 'cors'
    });

    clearTimeout(timeout);

    if (response.ok) {
      return { ...service, status: 'healthy', message: superuserStrings.get('service_status_active') };
    } else {
      return { ...service, status: 'degraded', message: `HTTP ${response.status}` };
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      return { ...service, status: 'degraded', message: superuserStrings.get('service_status_timeout') };
    }
    // CORS errors are expected for Cloud Run services without proper headers
    return { ...service, status: 'unknown', message: superuserStrings.get('service_status_cors') };
  }
}

/**
 * Render service status card
 */
function renderServiceCard(service) {
  const statusClass = `service-card--${service.status}`;
  const statusText = {
    healthy: superuserStrings.get('service_status_active'),
    available: superuserStrings.get('service_status_ready'),
    degraded: superuserStrings.get('service_status_problem'),
    down: superuserStrings.get('service_status_inactive'),
    unknown: superuserStrings.get('service_status_unknown')
  }[service.status] || superuserStrings.get('service_status_unknown');

  const name = service.nameKey ? superuserStrings.get(service.nameKey) : service.name;

  return `
    <div class="service-card ${statusClass}">
      <div class="service-card__header">
        <span class="service-card__dot"></span>
        <span class="service-card__name">${name}</span>
      </div>
      <div class="service-card__status">${statusText}</div>
      ${service.message ? `<div class="service-card__message">${service.message}</div>` : ''}
    </div>
  `;
}

/**
 * Render services grid
 */
function renderServicesGrid(containerId, services) {
  const container = document.getElementById(containerId);
  container.innerHTML = services.map(renderServiceCard).join('');
}

/**
 * Update overall health summary
 */
function updateHealthSummary(allServices) {
  const summary = document.getElementById('health-summary');
  const statusEl = summary.querySelector('.health-summary__status');

  const healthyCount = allServices.filter(s => s.status === 'healthy').length;
  const degradedCount = allServices.filter(s => s.status === 'degraded').length;
  const downCount = allServices.filter(s => s.status === 'down').length;
  const unknownCount = allServices.filter(s => s.status === 'unknown').length;

  // Remove all status classes
  statusEl.classList.remove(
    'health-summary__status--loading',
    'health-summary__status--healthy',
    'health-summary__status--degraded',
    'health-summary__status--down'
  );

  let statusText = '';
  if (downCount > 0) {
    statusEl.classList.add('health-summary__status--down');
    statusText = superuserStrings.get('health_summary_down').replace('%s', downCount);
  } else if (degradedCount > 0) {
    statusEl.classList.add('health-summary__status--degraded');
    statusText = superuserStrings.get('health_summary_degraded').replace('%s', degradedCount);
  } else if (healthyCount > 0) {
    statusEl.classList.add('health-summary__status--healthy');
    statusText = superuserStrings.get('health_summary_healthy').replace('%s', healthyCount);
  } else {
    statusEl.classList.add('health-summary__status--loading');
    statusText = superuserStrings.get('health_summary_unknown');
  }

  if (unknownCount > 0) {
    statusText += superuserStrings.get('health_summary_unknown_count').replace('%s', unknownCount);
  }

  statusEl.querySelector('.health-summary__text').textContent = statusText;

  // Update timestamp
  document.getElementById('last-updated').textContent =
    superuserStrings.get('health_last_updated').replace('%s', new Date().toLocaleTimeString('is-IS'));
}

/**
 * Update breakdown counts display
 */
function updateBreakdownCounts(counts) {
  document.getElementById('count-gcp').textContent = counts.gcp;
  document.getElementById('count-external').textContent = counts.external;
  document.getElementById('count-functions').textContent = counts.functions;
  document.getElementById('count-database').textContent = counts.database;
  document.getElementById('count-firebase').textContent = counts.firebase;
}

/**
 * Check all services using Cloud Function (avoids CORS)
 */
async function checkAllServices() {
  const refreshBtn = document.getElementById('refresh-btn');
  refreshBtn.disabled = true;
  refreshBtn.textContent = superuserStrings.get('btn_check');

  try {
    // Call Cloud Function to check health (avoids CORS issues)
    const checkSystemHealth = httpsCallable('checkSystemHealth', 'europe-west2');

    const result = await checkSystemHealth();
    const healthData = result.data;

    debug.log('Health check result:', healthData);

    // Map core GCP services (with health endpoints) from response
    const coreResults = CORE_SERVICES.map(service => {
      const serverResult = healthData.services?.find(s => s.id === service.id);
      if (serverResult) {
        return { ...service, ...serverResult };
      }
      return { ...service, status: 'unknown', message: superuserStrings.get('status_not_checked') };
    });
    renderServicesGrid('core-services', coreResults);

    // External services (Linode, etc.) - REMOVED
    /*
    const externalResults = EXTERNAL_SERVICES.map(service => {
      const serverResult = healthData.services?.find(s => s.id === service.id);
      if (serverResult) {
        return { ...service, ...serverResult };
      }
      return { ...service, status: 'unknown', message: superuserStrings.get('status_not_checked') };
    });
    renderServicesGrid('external-services', externalResults);
    */

    // Demo services - REMOVED
    /*
    const demoResults = DEMO_SERVICES.map(service => {
      const serverResult = healthData.services?.find(s => s.id === service.id);
      if (serverResult) {
        return { ...service, ...serverResult };
      }
      return { ...service, status: 'unknown', message: superuserStrings.get('status_not_checked') };
    });
    renderServicesGrid('demo-services', demoResults);
    */

    // Firebase Functions by category (no health endpoint - show as "available")
    const mapFunctions = (funcList) => funcList.map(service => {
      const serverResult = healthData.services?.find(s => s.id === service.id);
      if (serverResult) {
        return { ...service, ...serverResult };
      }
      return { ...service, status: 'available', message: superuserStrings.get('service_status_ready') };
    });

    renderServicesGrid('member-functions', mapFunctions(MEMBER_FUNCTIONS));
    renderServicesGrid('address-functions', mapFunctions(ADDRESS_FUNCTIONS));
    renderServicesGrid('lookup-functions', mapFunctions(LOOKUP_FUNCTIONS));
    renderServicesGrid('registration-functions', mapFunctions(REGISTRATION_FUNCTIONS));
    renderServicesGrid('superuser-functions', mapFunctions(SUPERUSER_FUNCTIONS));
    renderServicesGrid('utility-functions', mapFunctions(UTILITY_FUNCTIONS));

    // Database services from response
    const dbResults = DATABASE_SERVICES.map(service => {
      const serverResult = healthData.services?.find(s => s.id === service.id);
      if (serverResult) {
        return { ...service, ...serverResult };
      }
      return { ...service, status: 'unknown', message: superuserStrings.get('status_not_checked') };
    });
    renderServicesGrid('database-services', dbResults);

    // Firebase infrastructure (hosting/auth always work if page loads)
    const firebaseResults = FIREBASE_SERVICES.map(s => {
      if (s.id === 'firebase-hosting') {
        return { ...s, status: 'healthy', message: superuserStrings.get('status_page_loaded') };
      }
      if (s.id === 'firebase-auth') {
        return { ...s, status: 'healthy', message: superuserStrings.get('status_auth_active') };
      }
      return { ...s, status: 'unknown', message: superuserStrings.get('status_not_checked') };
    });
    renderServicesGrid('firebase-services', firebaseResults);

    // Update overall summary (only count services with health checks)
    // externalResults removed
    const allHealthCheckedServices = [...coreResults, ...dbResults, ...firebaseResults];
    updateHealthSummary(allHealthCheckedServices);

    // Update breakdown counts
    const allFunctions = [...MEMBER_FUNCTIONS, ...ADDRESS_FUNCTIONS, ...LOOKUP_FUNCTIONS, ...REGISTRATION_FUNCTIONS, ...SUPERUSER_FUNCTIONS, ...UTILITY_FUNCTIONS];
    updateBreakdownCounts({
      gcp: coreResults.length,
      external: 0, // externalResults.length,
      functions: allFunctions.length,
      database: dbResults.length,
      firebase: firebaseResults.length
    });

  } catch (error) {
    debug.error('Error checking services:', error);

    // Fallback to client-side checks if Cloud Function fails
    debug.log('Falling back to client-side health checks');
    await checkAllServicesClientSide();
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = superuserStrings.get('btn_update');
  }
}

/**
 * Fallback: Check services from client-side (may have CORS issues)
 */
async function checkAllServicesClientSide() {
  try {
    // Core GCP services - try to check (may fail due to CORS)
    const coreResults = CORE_SERVICES.map(s => ({
      ...s,
      status: 'unknown',
      message: superuserStrings.get('status_needs_backend')
    }));
    renderServicesGrid('core-services', coreResults);

    // External services (Linode) - REMOVED
    /*
    const externalResults = EXTERNAL_SERVICES.map(s => ({
      ...s,
      status: 'unknown',
      message: superuserStrings.get('status_needs_backend')
    }));
    renderServicesGrid('external-services', externalResults);
    */

    // Demo services - REMOVED
    /*
    const demoResults = DEMO_SERVICES.map(s => ({
      ...s,
      status: 'unknown',
      message: superuserStrings.get('status_needs_backend')
    }));
    renderServicesGrid('demo-services', demoResults);
    */

    // Firebase Functions by category - always available
    const mapFallback = (funcList) => funcList.map(s => ({
      ...s,
      status: 'available',
      message: superuserStrings.get('service_status_ready')
    }));

    renderServicesGrid('member-functions', mapFallback(MEMBER_FUNCTIONS));
    renderServicesGrid('address-functions', mapFallback(ADDRESS_FUNCTIONS));
    renderServicesGrid('lookup-functions', mapFallback(LOOKUP_FUNCTIONS));
    renderServicesGrid('registration-functions', mapFallback(REGISTRATION_FUNCTIONS));
    renderServicesGrid('superuser-functions', mapFallback(SUPERUSER_FUNCTIONS));
    renderServicesGrid('utility-functions', mapFallback(UTILITY_FUNCTIONS));

    const dbResults = DATABASE_SERVICES.map(s => ({
      ...s,
      status: 'unknown',
      message: superuserStrings.get('status_needs_backend')
    }));
    renderServicesGrid('database-services', dbResults);

    const firebaseResults = FIREBASE_SERVICES.map(s => {
      if (s.id === 'firebase-hosting') {
        return { ...s, status: 'healthy', message: superuserStrings.get('status_page_loaded') };
      }
      if (s.id === 'firebase-auth') {
        return { ...s, status: 'healthy', message: superuserStrings.get('status_auth_active') };
      }
      return { ...s, status: 'unknown', message: superuserStrings.get('status_needs_backend') };
    });
    renderServicesGrid('firebase-services', firebaseResults);

    // externalResults removed
    const allServices = [...coreResults, ...dbResults, ...firebaseResults];
    updateHealthSummary(allServices);

    // Update breakdown counts
    const allFunctions = [...MEMBER_FUNCTIONS, ...ADDRESS_FUNCTIONS, ...LOOKUP_FUNCTIONS, ...REGISTRATION_FUNCTIONS, ...SUPERUSER_FUNCTIONS, ...UTILITY_FUNCTIONS];
    updateBreakdownCounts({
      gcp: coreResults.length,
      external: 0, // externalResults.length,
      functions: allFunctions.length,
      database: dbResults.length,
      firebase: firebaseResults.length
    });

    showToast(superuserStrings.get('status_fallback_cors'), 'info', { duration: 3000 });
  } catch (error) {
    debug.error('Client-side health check failed:', error);
    showToast(superuserStrings.get('dangerous_op_error').replace('%s', error.message), 'error');
  }
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

    // Initial check
    await checkAllServices();

    // Setup refresh button
    document.getElementById('refresh-btn').addEventListener('click', checkAllServices);

    // Auto-refresh every 30 seconds
    setInterval(checkAllServices, 30000);

    debug.log('System health page initialized');

  } catch (error) {
    debug.error('Failed to initialize system health:', error);

    if (error.message.includes('Superuser role required')) {
      return;
    }

    showToast(`Villa: ${error.message}`, 'error');
  }
}

init();
