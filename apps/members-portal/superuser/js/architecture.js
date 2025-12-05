/**
 * Architecture Diagram Page
 *
 * Displays a dynamic system architecture visualization with:
 * - Service group nodes with health status
 * - Animated data flow connections
 * - Click-to-expand service details
 * - Auto-refresh every 30 seconds
 */

import { initSession } from '../../session/init.js';
import { debug } from '../../js/utils/util-debug.js';
import { getFunctions } from '../../firebase/app.js';
import { requireSuperuser } from '../../js/rbac.js';
import { showToast } from '../../js/components/ui-toast.js';
import { superuserStrings } from './i18n/superuser-strings-loader.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';

// Service group definitions
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
    services: ['sync-from-django', 'updatememberprofile', 'syncmembers']
  },
  address: {
    nameKey: 'architecture_group_address',
    services: ['search-addresses', 'validate-address', 'validate-postal-code']
  },
  audit: {
    nameKey: 'architecture_group_audit',
    services: ['auditmemberchanges', 'cleanupauditlogs', 'healthz']
  },
  superuser: {
    nameKey: 'architecture_group_superuser',
    services: ['checksystemhealth', 'setuserrole', 'getuserrole', 'getauditlogs', 'getloginaudit', 'harddeletemember', 'anonymizemember', 'listelevatedusers']
  },
  lookup: {
    nameKey: 'architecture_group_lookup',
    services: ['list-unions', 'list-job-titles', 'list-countries', 'list-postal-codes', 'get-cells-by-postal-code']
  },
  registration: {
    nameKey: 'architecture_group_registration',
    services: ['register-member']
  },
  demo: {
    nameKey: 'architecture_group_demo',
    services: ['django-socialism-demo']
  },
  utility: {
    nameKey: 'architecture_group_utility',
    services: ['get-django-token']
  }
};

// Service display names (Icelandic)
const SERVICE_NAMES = {
  'handlekenniauth': 'service_handlekenniauth',
  'verifymembership': 'service_verifymembership',
  'sync-from-django': 'service_sync_from_django',
  'updatememberprofile': 'service_updatememberprofile',
  'syncmembers': 'service_syncmembers',
  'search-addresses': 'service_search_addresses',
  'validate-address': 'service_validate_address',
  'validate-postal-code': 'service_validate_postal_code',
  'elections-service': 'service_elections_service',
  'events-service': 'service_events_service',
  'members-service': 'service_members_service',
  'auditmemberchanges': 'service_auditmemberchanges',
  'cleanupauditlogs': 'service_cleanupauditlogs',
  'healthz': 'service_healthz',
  'checksystemhealth': 'service_checksystemhealth',
  'setuserrole': 'service_setuserrole',
  'getuserrole': 'service_getuserrole',
  'getauditlogs': 'service_getauditlogs',
  'getloginaudit': 'service_getloginaudit',
  'harddeletemember': 'service_harddeletemember',
  'anonymizemember': 'service_anonymizemember',
  'listelevatedusers': 'service_listelevatedusers',
  'firestore-database': 'service_firestore_database',
  'list-unions': 'service_list_unions',
  'list-job-titles': 'service_list_job_titles',
  'list-countries': 'service_list_countries',
  'list-postal-codes': 'service_list_postal_codes',
  'get-cells-by-postal-code': 'service_get_cells_by_postal_code',
  'register-member': 'service_register_member',
  'django-socialism-demo': 'service_django_socialism_demo',
  'get-django-token': 'service_get_django_token'
};

// State
let healthData = null;
let refreshInterval = null;
let selectedGroup = null;

/**
 * Initialize the page
 */
async function init() {
  try {
    // Load superuser strings (i18n)
    const strings = await superuserStrings.load();
    superuserStrings.translatePage();  // Translate data-i18n elements

    // Initialize session (auth + member portal strings)
    const { user, userData } = await initSession();

    // Require superuser role
    await requireSuperuser();

    // Set page text from i18n
    setPageText(strings, userData);

    // Initial health check
    await checkHealth();

    // Setup event listeners
    setupEventListeners();

    // Start auto-refresh (every 30 seconds)
    refreshInterval = setInterval(checkHealth, 30000);

    debug.log('Architecture page initialized');
  } catch (error) {
    debug.error('Failed to initialize architecture page:', error);
    showToast(superuserStrings.get('error_page_load').replace('%s', error.message), 'error');
  }
}

/**
 * Set page text from i18n strings
 */
function setPageText(strings, userData) {
  // Title and description
  const title = document.getElementById('title');
  const description = document.getElementById('description');

  if (title) title.textContent = strings.architecture_title;
  if (description) description.textContent = strings.architecture_description;
}

/**
 * Check health of all services
 */
async function checkHealth() {
  try {
    updateSummaryStatus('loading', superuserStrings.get('status_checking'));

    const functions = getFunctions('europe-west2');
    const checkSystemHealth = httpsCallable(functions, 'checkSystemHealth');
    const result = await checkSystemHealth();

    healthData = result.data;

    // Update diagram
    updateDiagram();

    // Update stats
    updateStats();

    // Update summary
    const summary = calculateSummary();
    updateSummaryStatus(summary.status, summary.text);

    // Update timestamp
    const timestamp = document.getElementById('last-updated');
    if (timestamp) {
      timestamp.textContent = superuserStrings.get('last_updated').replace('%s', new Date().toLocaleTimeString('is-IS'));
    }

  } catch (error) {
    debug.error('Health check failed:', error);
    updateSummaryStatus('down', superuserStrings.get('status_check_error'));
  }
}

/**
 * Update summary status display
 */
function updateSummaryStatus(status, text) {
  const summary = document.getElementById('health-summary');
  if (!summary) return;

  const statusDiv = summary.querySelector('.health-summary__status');
  const textSpan = summary.querySelector('.health-summary__text');

  // Remove all status classes
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
 * Calculate overall system summary
 */
function calculateSummary() {
  if (!healthData) {
    return { status: 'loading', text: superuserStrings.get('status_checking') };
  }

  // Flatten all service statuses
  const allStatuses = [];

  // Add core services
  if (healthData.coreServices) {
    healthData.coreServices.forEach(s => allStatuses.push(s.status));
  }

  // Add member functions
  if (healthData.memberFunctions) {
    healthData.memberFunctions.forEach(s => allStatuses.push(s.status || 'available'));
  }

  // Add address functions
  if (healthData.addressFunctions) {
    healthData.addressFunctions.forEach(s => allStatuses.push(s.status || 'available'));
  }

  // Add superuser functions
  if (healthData.superuserFunctions) {
    healthData.superuserFunctions.forEach(s => allStatuses.push(s.status || 'available'));
  }

  const downCount = allStatuses.filter(s => s === 'down' || s === 'error').length;
  const degradedCount = allStatuses.filter(s => s === 'degraded' || s === 'slow').length;

  if (downCount > 0) {
    return { status: 'down', text: superuserStrings.get('summary_down').replace('%s', downCount) };
  } else if (degradedCount > 0) {
    return { status: 'degraded', text: superuserStrings.get('summary_degraded').replace('%s', degradedCount) };
  } else {
    return { status: 'healthy', text: superuserStrings.get('summary_healthy') };
  }
}

/**
 * Update the SVG diagram with health status
 */
function updateDiagram() {
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
  updateStatusIndicator(document.getElementById('status-cloudsql'), 'healthy'); // Assume healthy if services work
  updateStatusIndicator(document.getElementById('status-django'), getDjangoStatus());

  // Animate data flow lines based on sync status
  animateDataFlows();
}

/**
 * Get status for a group of services
 */
function getGroupStatus(serviceIds) {
  const statuses = serviceIds.map(id => getServiceStatus(id));

  if (statuses.some(s => s === 'down' || s === 'error')) {
    return 'down';
  } else if (statuses.some(s => s === 'degraded' || s === 'slow')) {
    return 'degraded';
  } else {
    return 'healthy';
  }
}

/**
 * Get status for a single service
 */
function getServiceStatus(serviceId) {
  if (!healthData) return 'unknown';

  // Check all service arrays
  const allServices = [
    ...(healthData.coreServices || []),
    ...(healthData.memberFunctions || []),
    ...(healthData.addressFunctions || []),
    ...(healthData.superuserFunctions || []),
    ...(healthData.demoServices || [])
  ];

  const service = allServices.find(s => s.id === serviceId || s.name === serviceId);
  return service ? (service.status || 'available') : 'unknown';
}

/**
 * Get overall Cloud Run status
 */
function getOverallCloudRunStatus() {
  const allStatuses = [];

  Object.keys(SERVICE_GROUPS).forEach(groupId => {
    const group = SERVICE_GROUPS[groupId];
    group.services.forEach(serviceId => {
      allStatuses.push(getServiceStatus(serviceId));
    });
  });

  const downCount = allStatuses.filter(s => s === 'down' || s === 'error').length;
  const degradedCount = allStatuses.filter(s => s === 'degraded' || s === 'slow').length;

  if (downCount > 3) return 'down';
  if (downCount > 0 || degradedCount > 3) return 'degraded';
  return 'healthy';
}

/**
 * Get Django status (based on sync services)
 */
function getDjangoStatus() {
  const syncStatus = getServiceStatus('sync-from-django');
  const updateStatus = getServiceStatus('updatememberprofile');

  if (syncStatus === 'down' || updateStatus === 'down') return 'down';
  if (syncStatus === 'degraded' || updateStatus === 'degraded') return 'degraded';
  return 'healthy';
}

/**
 * Update a status indicator circle
 */
function updateStatusIndicator(element, status) {
  if (!element) return;

  // Remove all status classes
  element.classList.remove(
    'architecture-status--healthy',
    'architecture-status--degraded',
    'architecture-status--down',
    'architecture-status--unknown'
  );

  // Map status to class
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

/**
 * Animate data flow lines
 */
function animateDataFlows() {
  const djangoToFirestore = document.getElementById('flow-django-firestore');
  const firestoreToDjango = document.getElementById('flow-firestore-django');

  // Animate if sync services are healthy
  const syncStatus = getServiceStatus('sync-from-django');
  const updateStatus = getServiceStatus('updatememberprofile');

  if (djangoToFirestore) {
    djangoToFirestore.classList.toggle('architecture-edge--active', syncStatus === 'healthy' || syncStatus === 'available');
  }

  if (firestoreToDjango) {
    firestoreToDjango.classList.toggle('architecture-edge--active', updateStatus === 'healthy' || updateStatus === 'available');
  }
}

/**
 * Update statistics display
 */
function updateStats() {
  if (!healthData) return;

  // Count all services
  let healthy = 0;
  let degraded = 0;
  let down = 0;
  let total = 0;

  Object.keys(SERVICE_GROUPS).forEach(groupId => {
    const group = SERVICE_GROUPS[groupId];
    group.services.forEach(serviceId => {
      total++;
      const status = getServiceStatus(serviceId);
      if (status === 'healthy' || status === 'available') healthy++;
      else if (status === 'degraded' || status === 'slow') degraded++;
      else if (status === 'down' || status === 'error') down++;
    });
  });

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-healthy').textContent = healthy;
  document.getElementById('stat-degraded').textContent = degraded;
  document.getElementById('stat-down').textContent = down;
}

/**
 * Show details panel for a service group
 */
function showGroupDetails(groupId) {
  const group = SERVICE_GROUPS[groupId];
  if (!group) return;

  selectedGroup = groupId;

  const panel = document.getElementById('details-panel');
  const title = document.getElementById('details-title');
  const container = document.getElementById('details-services');

  if (!panel || !title || !container) return;

  title.textContent = superuserStrings.get(group.nameKey);

  // Render service cards
  container.innerHTML = group.services.map(serviceId => {
    const status = getServiceStatus(serviceId);
    const nameKey = SERVICE_NAMES[serviceId];
    const name = nameKey ? superuserStrings.get(nameKey) : serviceId;

    return `
      <div class="service-card service-card--${status === 'available' ? 'healthy' : status}">
        <div class="service-card__header">
          <span class="service-card__dot service-card__dot--${status === 'available' ? 'healthy' : status}"></span>
          <span class="service-card__name">${name}</span>
        </div>
        <div class="service-card__id">${serviceId}</div>
        <div class="service-card__status">${getStatusText(status)}</div>
      </div>
    `;
  }).join('');

  panel.style.display = 'block';

  // Scroll to panel
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Hide details panel
 */
function hideGroupDetails() {
  const panel = document.getElementById('details-panel');
  if (panel) {
    panel.style.display = 'none';
  }
  selectedGroup = null;
}

/**
 * Get human-readable status text
 */
function getStatusText(status) {
  const texts = {
    'healthy': superuserStrings.get('status_healthy'),
    'available': superuserStrings.get('status_available'),
    'degraded': superuserStrings.get('status_degraded'),
    'slow': superuserStrings.get('status_slow'),
    'down': superuserStrings.get('status_down'),
    'error': superuserStrings.get('status_error'),
    'unknown': superuserStrings.get('status_unknown')
  };
  return texts[status] || status;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Refresh button
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      try {
        refreshBtn.disabled = true;
        refreshBtn.textContent = superuserStrings.get('refreshing');
        await checkHealth();
      } catch (error) {
        console.error('Error refreshing health:', error);
        // Optional: showToast or some UI feedback
      } finally {
        refreshBtn.disabled = false;
        refreshBtn.textContent = superuserStrings.get('refresh_btn');
      }
    });
  }

  // Close details button
  const closeBtn = document.getElementById('close-details');
  if (closeBtn) {
    closeBtn.addEventListener('click', hideGroupDetails);
  }

  // Click on service groups
  document.querySelectorAll('.architecture-group--clickable').forEach(group => {
    group.addEventListener('click', (e) => {
      const groupId = group.dataset.group;
      if (groupId) {
        showGroupDetails(groupId);
      }
    });

    // Add hover effect
    group.style.cursor = 'pointer';
  });
}

// Initialize when DOM is ready
init();
