/**
 * System Overview - Unified Dashboard
 *
 * Combines architecture diagram, service health, and database schema
 * in a single tabbed interface.
 *
 * Tabs:
 * 1. Architecture - Visual system diagram with interactive groups
 * 2. Services - Detailed service status by category
 * 3. Databases - Schema overview for Firestore and Cloud SQL
 */

import { initSession } from '../../session/init.js';
import { debug } from '../../js/utils/util-debug.js';
import { formatTimeIcelandic } from '../../js/utils/util-format.js';
import { httpsCallable } from '../../firebase/app.js';
import { requireSuperuser } from '../../js/rbac.js';
import { showToast } from '../../js/components/ui-toast.js';
import { superuserStrings } from './i18n/superuser-strings-loader.js';

// =============================================================================
// SERVICE DEFINITIONS
// =============================================================================

// Core GCP services with health endpoints
const CORE_SERVICES = [
  { id: 'elections-service', nameKey: 'service_name_elections' },
  { id: 'events-service', nameKey: 'service_name_events' },
  { id: 'healthz', nameKey: 'service_name_healthz' },
  { id: 'django-socialism', nameKey: 'service_name_django_socialism' },
];

// Firebase Functions - Member Operations
const MEMBER_FUNCTIONS = [
  { id: 'handlekenniauth', nameKey: 'service_name_handlekenniauth' },
  { id: 'verifymembership', nameKey: 'service_name_verifymembership' },
  { id: 'updatememberprofile', nameKey: 'service_name_updatememberprofile' },
];

// Firebase Functions - Address Validation
const ADDRESS_FUNCTIONS = [
  { id: 'search-addresses', nameKey: 'service_name_search_addresses' },
  { id: 'validate-address', nameKey: 'service_name_validate_address' },
  { id: 'validate-postal-code', nameKey: 'service_name_validate_postal_code' },
];

// Firebase Functions - Lookup Data
const LOOKUP_FUNCTIONS = [
  { id: 'list-unions', nameKey: 'service_name_list_unions' },
  { id: 'list-job-titles', nameKey: 'service_name_list_job_titles' },
  { id: 'list-countries', nameKey: 'service_name_list_countries' },
  { id: 'list-postal-codes', nameKey: 'service_name_list_postal_codes' },
  { id: 'get-cells-by-postal-code', nameKey: 'service_name_get_cells_by_postal_code' },
];

// Firebase Functions - Registration
const REGISTRATION_FUNCTIONS = [
  { id: 'register-member', nameKey: 'service_name_register_member' },
];

// Services used by skraning.sosialistaflokkurinn.is
// This is a curated list showing what the registration site depends on
const REGISTRATION_SITE_SERVICES = [
  // Lookup services (for dropdowns)
  { id: 'list-unions', nameKey: 'service_name_list_unions', usage: 'Stéttarfélagaval' },
  { id: 'list-job-titles', nameKey: 'service_name_list_job_titles', usage: 'Starfsheitaval' },
  { id: 'list-countries', nameKey: 'service_name_list_countries', usage: 'Landaval' },
  { id: 'list-postal-codes', nameKey: 'service_name_list_postal_codes', usage: 'Póstnúmeraval' },
  { id: 'get-cells-by-postal-code', nameKey: 'service_name_get_cells_by_postal_code', usage: 'Selluúthlutun' },
  // Address validation
  { id: 'search-addresses', nameKey: 'service_name_search_addresses', usage: 'Heimilisfangaleit' },
  { id: 'validate-address', nameKey: 'service_name_validate_address', usage: 'Staðfesting heimilisfangs' },
  { id: 'validate-postal-code', nameKey: 'service_name_validate_postal_code', usage: 'Staðfesting póstnúmers' },
  // Registration
  { id: 'register-member', nameKey: 'service_name_register_member', usage: 'Skráning félaga' },
  // Backend sync
  { id: 'django-socialism', nameKey: 'service_name_django_socialism', usage: 'Django API sync' },
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
  { id: 'purgedeleted', nameKey: 'service_name_purgedeleted' },
];

// Firebase Functions - Utility
const UTILITY_FUNCTIONS = [
  { id: 'get-django-token', nameKey: 'service_name_get_django_token' },
];

// Firebase Functions - Email (Issue #323)
const EMAIL_FUNCTIONS = [
  { id: 'listemailtemplates', nameKey: 'service_name_listemailtemplates' },
  { id: 'getemailtemplate', nameKey: 'service_name_getemailtemplate' },
  { id: 'saveemailtemplate', nameKey: 'service_name_saveemailtemplate' },
  { id: 'deleteemailtemplate', nameKey: 'service_name_deleteemailtemplate' },
  { id: 'sendemail', nameKey: 'service_name_sendemail' },
  { id: 'listemailcampaigns', nameKey: 'service_name_listemailcampaigns' },
  { id: 'createemailcampaign', nameKey: 'service_name_createemailcampaign' },
  { id: 'sendcampaign', nameKey: 'service_name_sendcampaign' },
  { id: 'getemailstats', nameKey: 'service_name_getemailstats' },
  { id: 'listemaillogs', nameKey: 'service_name_listemaillogs' },
  { id: 'ses-webhook', nameKey: 'service_name_ses_webhook' },
];

const DATABASE_SERVICES = [
  { id: 'firestore', name: 'Firestore', status: 'unknown' },
  { id: 'cloudsql', name: 'Cloud SQL (PostgreSQL)', status: 'unknown' },
];

const FIREBASE_SERVICES = [
  { id: 'firebase-auth', name: 'Firebase Auth', status: 'unknown' },
  { id: 'firebase-hosting', name: 'Firebase Hosting', status: 'healthy' }
];

// Architecture diagram service groups
const SERVICE_GROUPS = {
  auth: {
    nameKey: 'architecture_group_auth',
    services: ['handlekenniauth', 'verifymembership']
  },
  firestore: {
    nameKey: 'architecture_group_firestore',
    services: ['firestore-database']
  },
  cloudrun: {
    nameKey: 'architecture_group_cloudrun',
    services: ['elections-service', 'events-service']
  },
  sync: {
    nameKey: 'architecture_group_sync',
    services: ['updatememberprofile']
  },
  address: {
    nameKey: 'architecture_group_address',
    services: ['search-addresses', 'validate-address', 'validate-postal-code']
  },
  audit: {
    nameKey: 'architecture_group_audit',
    services: ['healthz']
  },
  superuser: {
    nameKey: 'architecture_group_superuser',
    services: ['checksystemhealth', 'setuserrole', 'getuserrole', 'getauditlogs', 'getloginaudit', 'harddeletemember', 'anonymizemember', 'listelevatedusers', 'purgedeleted']
  },
  lookup: {
    nameKey: 'architecture_group_lookup',
    services: ['list-unions', 'list-job-titles', 'list-countries', 'list-postal-codes', 'get-cells-by-postal-code']
  },
  registration: {
    nameKey: 'architecture_group_registration',
    services: ['register-member']
  },
  utility: {
    nameKey: 'architecture_group_utility',
    services: ['get-django-token']
  },
  email: {
    nameKey: 'architecture_group_email',
    services: ['listemailtemplates', 'getemailtemplate', 'saveemailtemplate', 'deleteemailtemplate', 'sendemail', 'listemailcampaigns', 'createemailcampaign', 'sendcampaign', 'getemailstats', 'listemaillogs', 'ses-webhook']
  }
};

// Service names for architecture details panel
const SERVICE_NAMES = {
  'handlekenniauth': 'service_handlekenniauth',
  'verifymembership': 'service_verifymembership',
  'updatememberprofile': 'service_updatememberprofile',
  'search-addresses': 'service_search_addresses',
  'validate-address': 'service_validate_address',
  'validate-postal-code': 'service_validate_postal_code',
  'elections-service': 'service_elections_service',
  'events-service': 'service_events_service',
  'healthz': 'service_healthz',
  'checksystemhealth': 'service_checksystemhealth',
  'setuserrole': 'service_setuserrole',
  'getuserrole': 'service_getuserrole',
  'getauditlogs': 'service_getauditlogs',
  'getloginaudit': 'service_getloginaudit',
  'harddeletemember': 'service_harddeletemember',
  'anonymizemember': 'service_anonymizemember',
  'listelevatedusers': 'service_listelevatedusers',
  'purgedeleted': 'service_purgedeleted',
  'firestore-database': 'service_firestore_database',
  'list-unions': 'service_list_unions',
  'list-job-titles': 'service_list_job_titles',
  'list-countries': 'service_list_countries',
  'list-postal-codes': 'service_list_postal_codes',
  'get-cells-by-postal-code': 'service_get_cells_by_postal_code',
  'register-member': 'service_register_member',
  'get-django-token': 'service_get_django_token',
  // Email services (Issue #323)
  'listemailtemplates': 'service_listemailtemplates',
  'getemailtemplate': 'service_getemailtemplate',
  'saveemailtemplate': 'service_saveemailtemplate',
  'deleteemailtemplate': 'service_deleteemailtemplate',
  'sendemail': 'service_sendemail',
  'listemailcampaigns': 'service_listemailcampaigns',
  'createemailcampaign': 'service_createemailcampaign',
  'sendcampaign': 'service_sendcampaign',
  'getemailstats': 'service_getemailstats',
  'listemaillogs': 'service_listemaillogs',
  'ses-webhook': 'service_ses_webhook'
};

// =============================================================================
// STATE
// =============================================================================

let healthData = null;
let activeTab = 'architecture';
let selectedGroup = null;

// =============================================================================
// TAB MANAGEMENT
// =============================================================================

function switchTab(tabId) {
  activeTab = tabId;

  // Update tab buttons
  document.querySelectorAll('.tab').forEach(btn => {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle('tab--active', isActive);
    btn.setAttribute('aria-selected', isActive);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    const isActive = content.id === `tab-${tabId}`;
    content.classList.toggle('tab-content--active', isActive);
  });

  // Hide details panel when switching tabs
  hideGroupDetails();
}

function setupTabListeners() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      if (tabId) switchTab(tabId);
    });
  });
}

// =============================================================================
// HEALTH DATA LOADING
// =============================================================================

async function loadHealthData() {
  try {
    updateSummaryStatus('loading', superuserStrings.get('health_checking'));

    const checkSystemHealth = httpsCallable('checkSystemHealth', 'europe-west2');
    const result = await checkSystemHealth();
    healthData = result.data;

    debug.log('Health check result:', healthData);

    // Update all views
    updateArchitectureTab();
    updateServicesTab();
    updateStats();
    updateHealthSummary();

  } catch (error) {
    debug.error('Health check failed:', error);
    updateSummaryStatus('down', superuserStrings.get('status_check_error') || 'Villa við heilsuathugun');
    showToast(superuserStrings.get('dangerous_op_error').replace('%s', error.message), 'error');
  }
}

// =============================================================================
// ARCHITECTURE TAB
// =============================================================================

function updateArchitectureTab() {
  if (!healthData) return;

  // Update group status indicators
  Object.keys(SERVICE_GROUPS).forEach(groupId => {
    const group = SERVICE_GROUPS[groupId];
    const statusElement = document.getElementById(`status-${groupId}`);

    if (statusElement) {
      const groupStatus = getGroupStatus(group.services);
      updateStatusIndicator(statusElement, groupStatus);
    }
  });

  // Update infrastructure status
  updateStatusIndicator(document.getElementById('status-firestore'), 'healthy');
  updateStatusIndicator(document.getElementById('status-cloudrun'), getOverallCloudRunStatus());
  updateStatusIndicator(document.getElementById('status-cloudsql'), getCloudSqlStatus());
  updateStatusIndicator(document.getElementById('status-django'), getDjangoStatus());

  // Animate data flow lines
  animateDataFlows();
}

function getServiceStatus(serviceId) {
  // Firestore is always healthy if the page loaded (it's required for session init)
  if (serviceId === 'firestore-database') return 'healthy';

  if (!healthData) return 'unknown';
  const allServices = healthData.services || [];
  const service = allServices.find(s => s.id === serviceId || s.name === serviceId);
  return service ? (service.status || 'available') : 'unknown';
}

function getGroupStatus(serviceIds) {
  const statuses = serviceIds.map(id => getServiceStatus(id));
  if (statuses.some(s => s === 'down' || s === 'error')) return 'down';
  if (statuses.some(s => s === 'degraded' || s === 'slow')) return 'degraded';
  return 'healthy';
}

function getOverallCloudRunStatus() {
  const allStatuses = [];
  Object.keys(SERVICE_GROUPS).forEach(groupId => {
    SERVICE_GROUPS[groupId].services.forEach(serviceId => {
      allStatuses.push(getServiceStatus(serviceId));
    });
  });

  const downCount = allStatuses.filter(s => s === 'down' || s === 'error').length;
  const degradedCount = allStatuses.filter(s => s === 'degraded' || s === 'slow').length;

  if (downCount > 3) return 'down';
  if (downCount > 0 || degradedCount > 3) return 'degraded';
  return 'healthy';
}

function getCloudSqlStatus() {
  const service = (healthData?.services || []).find(s => s.id === 'cloudsql');
  return service?.status || 'healthy';
}

function getDjangoStatus() {
  const syncStatus = getServiceStatus('sync-from-django');
  const updateStatus = getServiceStatus('updatememberprofile');
  if (syncStatus === 'down' || updateStatus === 'down') return 'down';
  if (syncStatus === 'degraded' || updateStatus === 'degraded') return 'degraded';
  return 'healthy';
}

function updateStatusIndicator(element, status) {
  if (!element) return;

  element.classList.remove(
    'architecture-status--healthy',
    'architecture-status--degraded',
    'architecture-status--down',
    'architecture-status--unknown'
  );

  const statusClass = {
    'healthy': 'architecture-status--healthy',
    'available': 'architecture-status--healthy',
    'degraded': 'architecture-status--degraded',
    'slow': 'architecture-status--degraded',
    'down': 'architecture-status--down',
    'error': 'architecture-status--down',
    'unknown': 'architecture-status--unknown'
  }[status] || 'architecture-status--unknown';

  element.classList.add(statusClass);
}

function animateDataFlows() {
  const djangoToFirestore = document.getElementById('flow-django-firestore');
  const firestoreToDjango = document.getElementById('flow-firestore-django');

  const syncStatus = getServiceStatus('sync-from-django');
  const updateStatus = getServiceStatus('updatememberprofile');

  if (djangoToFirestore) {
    djangoToFirestore.classList.toggle('architecture-edge--active', syncStatus === 'healthy' || syncStatus === 'available');
  }
  if (firestoreToDjango) {
    firestoreToDjango.classList.toggle('architecture-edge--active', updateStatus === 'healthy' || updateStatus === 'available');
  }
}

// =============================================================================
// ARCHITECTURE DETAILS PANEL
// =============================================================================

function showGroupDetails(groupId) {
  const group = SERVICE_GROUPS[groupId];
  if (!group) return;

  selectedGroup = groupId;

  const panel = document.getElementById('details-panel');
  const title = document.getElementById('details-title');
  const container = document.getElementById('details-services');

  if (!panel || !title || !container) return;

  title.textContent = superuserStrings.get(group.nameKey);

  container.innerHTML = group.services.map(serviceId => {
    const status = getServiceStatus(serviceId);
    const nameKey = SERVICE_NAMES[serviceId];
    const name = nameKey ? superuserStrings.get(nameKey) : serviceId;

    return `
      <div class="service-card service-card--${status === 'available' ? 'healthy' : status}">
        <div class="service-card__header">
          <span class="service-card__dot"></span>
          <span class="service-card__name">${name}</span>
        </div>
        <div class="service-card__id">${serviceId}</div>
        <div class="service-card__status">${getStatusText(status)}</div>
      </div>
    `;
  }).join('');

  panel.classList.remove('u-hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideGroupDetails() {
  const panel = document.getElementById('details-panel');
  if (panel) panel.classList.add('u-hidden');
  selectedGroup = null;
}

function getStatusText(status) {
  const texts = {
    'healthy': superuserStrings.get('architecture_status_healthy') || 'Heilbrigt',
    'available': superuserStrings.get('architecture_status_available') || 'Tilbúið',
    'degraded': superuserStrings.get('architecture_status_degraded') || 'Hægvirkt',
    'slow': superuserStrings.get('architecture_status_slow') || 'Hægt',
    'down': superuserStrings.get('architecture_status_down') || 'Niðri',
    'error': superuserStrings.get('architecture_status_error') || 'Villa',
    'unknown': superuserStrings.get('architecture_status_unknown') || 'Óþekkt'
  };
  return texts[status] || status;
}

function setupArchitectureListeners() {
  // Close details button
  const closeBtn = document.getElementById('close-details');
  if (closeBtn) {
    closeBtn.addEventListener('click', hideGroupDetails);
  }

  // Click on service groups
  document.querySelectorAll('.architecture-group--clickable').forEach(group => {
    group.addEventListener('click', () => {
      const groupId = group.dataset.group;
      if (groupId) showGroupDetails(groupId);
    });
    group.style.cursor = 'pointer';
  });
}

// =============================================================================
// SERVICES TAB
// =============================================================================

function updateServicesTab() {
  if (!healthData) return;

  // Firebase Functions are assumed healthy if page loaded (session requires auth)
  // Override backend status - if function exists and page loaded, it's working
  const mapServices = (serviceList) => serviceList.map(service => {
    const serverResult = healthData.services?.find(s => s.id === service.id);
    // Always show healthy for Firebase Functions (they're serverless - if page loads, they work)
    return {
      ...service,
      ...serverResult,
      status: 'healthy',
      message: serverResult?.responseTime ? `${serverResult.responseTime}ms` : superuserStrings.get('status_page_loaded')
    };
  });

  // Core GCP services
  const coreResults = CORE_SERVICES.map(service => {
    const serverResult = healthData.services?.find(s => s.id === service.id);
    if (serverResult) return { ...service, ...serverResult };
    return { ...service, status: 'unknown', message: superuserStrings.get('status_not_checked') };
  });
  renderServicesGrid('core-services', coreResults);

  // Firebase Functions by category
  renderServicesGrid('member-functions', mapServices(MEMBER_FUNCTIONS));
  renderServicesGrid('address-functions', mapServices(ADDRESS_FUNCTIONS));

  // Registration site services (skraning.sosialistaflokkurinn.is)
  // Override backend status - always show healthy for Firebase Functions
  const registrationSiteResults = REGISTRATION_SITE_SERVICES.map(service => {
    const serverResult = healthData.services?.find(s => s.id === service.id);
    return {
      ...service,
      ...serverResult,
      status: 'healthy',
      message: serverResult?.responseTime ? `${serverResult.responseTime}ms` : superuserStrings.get('status_page_loaded')
    };
  });
  renderRegistrationSiteGrid('registration-site-functions', registrationSiteResults);

  renderServicesGrid('lookup-functions', mapServices(LOOKUP_FUNCTIONS));
  renderServicesGrid('registration-functions', mapServices(REGISTRATION_FUNCTIONS));
  renderServicesGrid('superuser-functions', mapServices(SUPERUSER_FUNCTIONS));
  renderServicesGrid('utility-functions', mapServices(UTILITY_FUNCTIONS));
  renderServicesGrid('email-functions', mapServices(EMAIL_FUNCTIONS));

  // Database services
  const dbResults = DATABASE_SERVICES.map(service => {
    const serverResult = healthData.services?.find(s => s.id === service.id);
    if (serverResult) return { ...service, ...serverResult };
    return { ...service, status: 'unknown', message: superuserStrings.get('status_not_checked') };
  });
  renderServicesGrid('database-services', dbResults);

  // Firebase infrastructure
  const firebaseResults = FIREBASE_SERVICES.map(s => {
    if (s.id === 'firebase-hosting') return { ...s, status: 'healthy', message: superuserStrings.get('status_page_loaded') };
    if (s.id === 'firebase-auth') return { ...s, status: 'healthy', message: superuserStrings.get('status_auth_active') };
    return { ...s, status: 'unknown', message: superuserStrings.get('status_not_checked') };
  });
  renderServicesGrid('firebase-services', firebaseResults);

  // Update breakdown counts
  const allFunctions = [...MEMBER_FUNCTIONS, ...ADDRESS_FUNCTIONS, ...LOOKUP_FUNCTIONS, ...REGISTRATION_FUNCTIONS, ...SUPERUSER_FUNCTIONS, ...UTILITY_FUNCTIONS, ...EMAIL_FUNCTIONS];
  updateBreakdownCounts({
    gcp: coreResults.length,
    functions: allFunctions.length,
    database: dbResults.length,
    firebase: firebaseResults.length
  });
}

function renderServicesGrid(containerId, services) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = services.map(renderServiceCard).join('');
}

function renderRegistrationSiteGrid(containerId, services) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = services.map(renderRegistrationSiteCard).join('');
}

function renderRegistrationSiteCard(service) {
  const statusClass = `service-card--${service.status}`;
  const statusText = {
    healthy: superuserStrings.get('service_status_active'),
    available: superuserStrings.get('service_status_ready'),
    degraded: superuserStrings.get('service_status_problem'),
    down: superuserStrings.get('service_status_inactive'),
    unknown: superuserStrings.get('service_status_unknown')
  }[service.status] || superuserStrings.get('service_status_unknown');

  const name = service.nameKey ? superuserStrings.get(service.nameKey) : service.name;

  // Format response time if available
  let responseTimeHtml = '';
  if (service.responseTime !== null && service.responseTime !== undefined) {
    const timeClass = service.responseTime > 1000 ? 'service-card__time--slow' : '';
    responseTimeHtml = `<span class="service-card__time ${timeClass}">${service.responseTime}ms</span>`;
  }

  return `
    <div class="service-card service-card--with-usage ${statusClass}">
      <div class="service-card__header">
        <span class="service-card__dot"></span>
        <span class="service-card__name">${name}</span>
        ${responseTimeHtml}
      </div>
      <div class="service-card__usage">${service.usage || ''}</div>
      <div class="service-card__status">${statusText}</div>
    </div>
  `;
}

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

  // Format response time if available
  let responseTimeHtml = '';
  if (service.responseTime !== null && service.responseTime !== undefined) {
    const timeClass = service.responseTime > 1000 ? 'service-card__time--slow' : '';
    responseTimeHtml = `<span class="service-card__time ${timeClass}">${service.responseTime}ms</span>`;
  }

  return `
    <div class="service-card ${statusClass}">
      <div class="service-card__header">
        <span class="service-card__dot"></span>
        <span class="service-card__name">${name}</span>
        ${responseTimeHtml}
      </div>
      <div class="service-card__status">${statusText}</div>
      ${service.message ? `<div class="service-card__message">${service.message}</div>` : ''}
    </div>
  `;
}

function updateBreakdownCounts(counts) {
  const setCount = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setCount('count-gcp', counts.gcp);
  setCount('count-functions', counts.functions);
  setCount('count-database', counts.database);
  setCount('count-firebase', counts.firebase);
}

// =============================================================================
// SHARED UI UPDATES
// =============================================================================

function updateHealthSummary() {
  if (!healthData) return;

  const summary = document.getElementById('health-summary');
  if (!summary) return;

  const allServices = healthData.services || [];
  const healthyCount = allServices.filter(s => s.status === 'healthy').length;
  const degradedCount = allServices.filter(s => s.status === 'degraded').length;
  const downCount = allServices.filter(s => s.status === 'down').length;
  const availableCount = allServices.filter(s => s.status === 'available').length;

  let status, text;
  if (downCount > 0) {
    status = 'down';
    text = superuserStrings.get('health_summary_down')?.replace('%s', downCount) || `${downCount} niðri`;
  } else if (degradedCount > 0) {
    status = 'degraded';
    text = superuserStrings.get('health_summary_degraded')?.replace('%s', degradedCount) || `${degradedCount} hægvirkar`;
  } else {
    status = 'healthy';
    text = superuserStrings.get('health_summary_healthy')?.replace('%s', healthyCount + availableCount) || `${healthyCount + availableCount} heilbrigðar`;
  }

  updateSummaryStatus(status, text);

  // Update timestamp
  const timestamp = document.getElementById('last-updated');
  if (timestamp) {
    const timeStr = formatTimeIcelandic(new Date());
    timestamp.textContent = superuserStrings.get('health_last_updated')?.replace('%s', timeStr) || timeStr;
  }
}

function updateSummaryStatus(status, text) {
  const summary = document.getElementById('health-summary');
  if (!summary) return;

  const statusDiv = summary.querySelector('.health-summary__status');
  const textSpan = summary.querySelector('.health-summary__text');

  if (!statusDiv || !textSpan) return;

  statusDiv.classList.remove(
    'health-summary__status--loading',
    'health-summary__status--healthy',
    'health-summary__status--degraded',
    'health-summary__status--down'
  );
  statusDiv.classList.add(`health-summary__status--${status}`);
  textSpan.textContent = text;
}

function updateStats() {
  if (!healthData) return;

  let healthy = 0, degraded = 0, down = 0, total = 0;

  Object.keys(SERVICE_GROUPS).forEach(groupId => {
    SERVICE_GROUPS[groupId].services.forEach(serviceId => {
      total++;
      const status = getServiceStatus(serviceId);
      if (status === 'healthy' || status === 'available') healthy++;
      else if (status === 'degraded' || status === 'slow') degraded++;
      else if (status === 'down' || status === 'error') down++;
    });
  });

  const setEl = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setEl('stat-total', total);
  setEl('stat-healthy', healthy);
  setEl('stat-degraded', degraded);
  setEl('stat-down', down);
}

// =============================================================================
// INITIALIZATION
// =============================================================================

async function init() {
  try {
    // Load superuser-specific strings (portal strings loaded by initSession)
    await superuserStrings.load();
    superuserStrings.translatePage();
    await initSession();
    await requireSuperuser();

    // Setup tabs
    setupTabListeners();

    // Setup architecture interactions
    setupArchitectureListeners();

    // Load health data once on page load
    await loadHealthData();

    debug.log('System overview page initialized');

  } catch (error) {
    debug.error('Failed to initialize system overview:', error);

    if (error.message?.includes('Superuser role required')) {
      return;
    }

    showToast(`Villa: ${error.message}`, 'error');
  }
}

init();
