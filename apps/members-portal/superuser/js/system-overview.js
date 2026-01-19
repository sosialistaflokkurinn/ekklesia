/**
 * System Overview - Unified Dashboard (Orchestrator)
 *
 * Main entry point that coordinates all modules:
 * - Session initialization and authentication
 * - Health data loading
 * - Component initialization
 * - View updates
 *
 * Architecture:
 * - services/service-catalog.js - Service definitions
 * - services/health-service.js - Health data management
 * - components/tabs-controller.js - Tab switching
 * - components/architecture-diagram.js - SVG interactions
 * - components/service-card-renderer.js - Card templates
 * - components/health-summary.js - Header status
 */

import { initSession, showAuthenticatedContent } from '../../session/init.js';
import { AuthenticationError } from '../../session/auth.js';
import { debug } from '../../js/utils/util-debug.js';
import { requireSuperuser } from '../../js/rbac.js';
import { showToast } from '../../js/components/ui-toast.js';
import { superuserStrings } from './i18n/superuser-strings-loader.js';

// Services
import { fetchHealthData, mapServicesWithHealth } from './services/health-service.js';
import {
  getServicesByCategory,
  getRegistrationSiteServices,
  getServiceCounts,
  CATEGORIES
} from './services/service-catalog.js';

// Components
import { setupTabListeners } from './components/tabs-controller.js';
import {
  setupArchitectureListeners,
  updateDiagramStatus,
  hideGroupDetails
} from './components/architecture-diagram.js';
import { renderServicesGrid } from './components/service-card-renderer.js';
import {
  updateHealthSummary,
  showLoadingStatus,
  updateBreakdownCounts
} from './components/health-summary.js';

// =============================================================================
// VIEW UPDATES
// =============================================================================

/**
 * Update the architecture tab (diagram status indicators)
 */
function updateArchitectureTab() {
  updateDiagramStatus();
}

/**
 * Update the services tab (all service grids)
 */
function updateServicesTab() {
  // Category to container ID mapping
  const categoryContainers = [
    { category: CATEGORIES.CORE, containerId: 'core-services' },
    { category: CATEGORIES.MEMBER, containerId: 'member-functions' },
    { category: CATEGORIES.ADDRESS, containerId: 'address-functions' },
    { category: CATEGORIES.LOOKUP, containerId: 'lookup-functions' },
    { category: CATEGORIES.REGISTRATION, containerId: 'registration-functions' },
    { category: CATEGORIES.SUPERUSER, containerId: 'superuser-functions' },
    { category: CATEGORIES.EMAIL, containerId: 'email-functions' },
    { category: CATEGORIES.SMS, containerId: 'sms-functions' },
    { category: CATEGORIES.HEATMAP, containerId: 'heatmap-functions' },
    { category: CATEGORIES.DATABASE, containerId: 'database-services' },
    { category: CATEGORIES.FIREBASE, containerId: 'firebase-services' }
  ];

  // Render each category
  categoryContainers.forEach(({ category, containerId }) => {
    const services = getServicesByCategory(category);
    const servicesWithHealth = mapServicesWithHealth(services);
    renderServicesGrid(containerId, servicesWithHealth);
  });

  // Registration site (special section with usage field)
  const registrationServices = getRegistrationSiteServices();
  const registrationWithHealth = mapServicesWithHealth(registrationServices);
  renderServicesGrid('registration-site-functions', registrationWithHealth);

  // Update breakdown counts
  updateBreakdownCounts(getServiceCounts());
}

/**
 * Update all views after health data loads
 */
function updateAllViews() {
  updateArchitectureTab();
  updateServicesTab();
  updateHealthSummary();
}

// =============================================================================
// HEALTH DATA LOADING
// =============================================================================

/**
 * Load health data and update views
 */
async function loadHealthData() {
  try {
    showLoadingStatus();
    await fetchHealthData();
    updateAllViews();
  } catch (error) {
    debug.error('Health check failed:', error);
    const errorMsg = superuserStrings.get('dangerous_op_error')?.replace('%s', error.message) || error.message;
    showToast(errorMsg, 'error');
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the system overview page
 */
async function init() {
  try {
    // Load i18n strings
    await superuserStrings.load();
    superuserStrings.translatePage();

    // Session and authentication
    await initSession();
    await requireSuperuser();

    // Auth verified - show page content
    showAuthenticatedContent();

    // Setup components
    setupTabListeners({ onSwitch: hideGroupDetails });
    setupArchitectureListeners();

    // Load health data
    await loadHealthData();

    debug.log('System overview page initialized');

  } catch (error) {
    debug.error('Failed to initialize system overview:', error);

    // Auth error - redirect to login
    if (error instanceof AuthenticationError) {
      window.location.href = '/';
      return;
    }

    // Superuser check handles its own redirect
    if (error.message?.includes('Superuser role required')) {
      return;
    }

    showToast(`Villa: ${error.message}`, 'error');
  }
}

init();
