/**
 * Service Card Renderer - Unified Card Templates
 *
 * Consolidates renderServiceCard and renderRegistrationSiteCard into
 * a single flexible renderer.
 */

import { superuserStrings } from '../i18n/superuser-strings-loader.js';

// Status text i18n keys
const STATUS_TEXT_KEYS = {
  healthy: 'service_status_active',
  available: 'service_status_ready',
  degraded: 'service_status_problem',
  slow: 'service_status_problem',
  down: 'service_status_inactive',
  error: 'service_status_inactive',
  unknown: 'service_status_unknown'
};

// Status text for architecture details panel
const ARCHITECTURE_STATUS_KEYS = {
  healthy: 'architecture_status_healthy',
  available: 'architecture_status_available',
  degraded: 'architecture_status_degraded',
  slow: 'architecture_status_slow',
  down: 'architecture_status_down',
  error: 'architecture_status_error',
  unknown: 'architecture_status_unknown'
};

/**
 * Get localized status text for services tab
 */
function getStatusText(status) {
  const key = STATUS_TEXT_KEYS[status] || STATUS_TEXT_KEYS.unknown;
  return superuserStrings.get(key) || status;
}

/**
 * Get localized status text for architecture details
 */
export function getArchitectureStatusText(status) {
  const key = ARCHITECTURE_STATUS_KEYS[status] || ARCHITECTURE_STATUS_KEYS.unknown;
  return superuserStrings.get(key) || status;
}

/**
 * Format response time with optional slow indicator
 */
function formatResponseTime(responseTime) {
  if (responseTime === null || responseTime === undefined) return '';
  const timeClass = responseTime > 1000 ? 'service-card__time--slow' : '';
  return `<span class="service-card__time ${timeClass}">${responseTime}ms</span>`;
}

/**
 * Render a single service card
 *
 * @param {Object} service - Service object with id, nameKey, status, etc.
 * @returns {string} HTML string for the card
 */
export function renderServiceCard(service) {
  const name = service.nameKey
    ? superuserStrings.get(service.nameKey)
    : (service.name || service.id);

  const normalizedStatus = service.status === 'available' ? 'healthy' : service.status;
  const statusClass = `service-card--${normalizedStatus}`;
  const statusText = getStatusText(service.status);
  const responseTimeHtml = formatResponseTime(service.responseTime);

  // Check if this is a registration site service (has registrationUsage field)
  const hasUsage = !!service.registrationUsage;
  const usageHtml = hasUsage
    ? `<div class="service-card__usage">${service.registrationUsage}</div>`
    : '';

  const cardClass = hasUsage
    ? `service-card service-card--with-usage ${statusClass}`
    : `service-card ${statusClass}`;

  // Message is shown for non-registration cards only
  const messageHtml = (!hasUsage && service.message)
    ? `<div class="service-card__message">${service.message}</div>`
    : '';

  // Region badge
  const regionHtml = service.region
    ? `<div class="service-card__region">${service.region}</div>`
    : '';

  return `
    <div class="${cardClass}">
      <div class="service-card__header">
        <span class="service-card__dot"></span>
        <span class="service-card__name">${name}</span>
        ${responseTimeHtml}
      </div>
      ${usageHtml}
      ${regionHtml}
      <div class="service-card__status">${statusText}</div>
      ${messageHtml}
    </div>
  `;
}

/**
 * Render a service card for architecture details panel
 * (simpler version without message/usage)
 */
export function renderArchitectureCard(service) {
  const name = service.nameKey
    ? superuserStrings.get(service.nameKey)
    : (service.name || service.id);

  const normalizedStatus = service.status === 'available' ? 'healthy' : service.status;
  const statusClass = `service-card--${normalizedStatus}`;
  const statusText = getArchitectureStatusText(service.status);

  // Region badge
  const regionHtml = service.region
    ? `<div class="service-card__region">${service.region}</div>`
    : '';

  return `
    <div class="service-card ${statusClass}">
      <div class="service-card__header">
        <span class="service-card__dot"></span>
        <span class="service-card__name">${name}</span>
      </div>
      <div class="service-card__id">${service.id}</div>
      ${regionHtml}
      <div class="service-card__status">${statusText}</div>
    </div>
  `;
}

/**
 * Render multiple service cards
 */
export function renderServiceCards(services) {
  return services.map(renderServiceCard).join('');
}

/**
 * Render multiple architecture detail cards
 */
export function renderArchitectureCards(services) {
  return services.map(renderArchitectureCard).join('');
}

/**
 * Render services into a container element
 */
export function renderServicesGrid(containerId, services) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = renderServiceCards(services);
}
