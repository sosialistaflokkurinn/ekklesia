/**
 * Architecture Diagram - SVG Interactions
 *
 * Handles the interactive SVG architecture diagram in the first tab.
 *
 * Module cleanup not needed - diagram persists for page lifetime.
 */

import { superuserStrings } from '../i18n/superuser-strings-loader.js';
import {
  getServiceStatus,
  getGroupStatus,
  getOverallCloudRunStatus,
  getCloudSqlStatus,
  getDjangoStatus,
  mapServiceWithHealth
} from '../services/health-service.js';
import {
  getServicesByGroup,
  getGroupNameKey,
  getAllGroups
} from '../services/service-catalog.js';
import { renderArchitectureCards } from './service-card-renderer.js';

// Module state
let selectedGroup = null;

/**
 * Get currently selected group
 */
export function getSelectedGroup() {
  return selectedGroup;
}

// =============================================================================
// STATUS INDICATOR UPDATES
// =============================================================================

/**
 * Update all status indicators in the diagram
 */
export function updateDiagramStatus() {
  // Update group status indicators
  getAllGroups().forEach(groupId => {
    const statusEl = document.getElementById(`status-${groupId}`);
    if (statusEl) {
      const status = getGroupStatus(groupId);
      updateStatusIndicator(statusEl, status);
    }
  });

  // Update infrastructure status indicators
  updateStatusIndicator(document.getElementById('status-firestore'), 'healthy');
  updateStatusIndicator(document.getElementById('status-cloudrun'), getOverallCloudRunStatus());
  updateStatusIndicator(document.getElementById('status-cloudsql'), getCloudSqlStatus());
  updateStatusIndicator(document.getElementById('status-django'), getDjangoStatus());

  // Animate data flow lines
  animateDataFlows();
}

/**
 * Update a single status indicator element
 */
function updateStatusIndicator(element, status) {
  if (!element) return;

  // Remove old status classes
  element.classList.remove(
    'architecture-status--healthy',
    'architecture-status--degraded',
    'architecture-status--down',
    'architecture-status--unknown'
  );

  // Map status to CSS class
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
 * Animate data flow lines based on service status
 */
function animateDataFlows() {
  // Cloud Run → Cloud SQL flow (based on Django service health)
  const cloudrunToSql = document.getElementById('flow-cloudrun-sql');
  const djangoStatus = getDjangoStatus();

  if (cloudrunToSql) {
    const isActive = djangoStatus === 'healthy' || djangoStatus === 'available';
    cloudrunToSql.classList.toggle('architecture-edge--active', isActive);
  }

  // Kenni.is → Auth flow (based on handlekenniauth service health)
  const kenniFlow = document.getElementById('flow-kenni');
  const kenniStatus = getServiceStatus('handlekenniauth');

  if (kenniFlow) {
    const isActive = kenniStatus === 'healthy' || kenniStatus === 'available';
    kenniFlow.classList.toggle('architecture-edge--active', isActive);
  }
}

// =============================================================================
// DETAILS PANEL
// =============================================================================

/**
 * Show details panel for a service group
 */
export function showGroupDetails(groupId) {
  const services = getServicesByGroup(groupId);
  if (!services.length) return;

  selectedGroup = groupId;

  const panel = document.getElementById('details-panel');
  const title = document.getElementById('details-title');
  const container = document.getElementById('details-services');

  if (!panel || !title || !container) return;

  // Set panel title
  const nameKey = getGroupNameKey(groupId);
  title.textContent = nameKey ? superuserStrings.get(nameKey) : groupId;

  // Render service cards with health data
  const servicesWithHealth = services.map(s => ({
    ...s,
    status: getServiceStatus(s.id)
  }));
  container.innerHTML = renderArchitectureCards(servicesWithHealth);

  // Show panel and scroll to it
  panel.classList.remove('u-hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Hide the details panel
 */
export function hideGroupDetails() {
  const panel = document.getElementById('details-panel');
  if (panel) panel.classList.add('u-hidden');
  selectedGroup = null;
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

/**
 * Setup click listeners for architecture diagram
 */
export function setupArchitectureListeners() {
  // Close details button
  const closeBtn = document.getElementById('close-details');
  if (closeBtn) {
    closeBtn.addEventListener('click', hideGroupDetails);
  }

  // Click on service groups in SVG
  document.querySelectorAll('.architecture-group--clickable').forEach(group => {
    group.addEventListener('click', () => {
      const groupId = group.dataset.group;
      if (groupId) showGroupDetails(groupId);
    });
    group.style.cursor = 'pointer';
  });
}
