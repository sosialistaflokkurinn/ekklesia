/**
 * Heatmap Page Logic
 *
 * Displays member distribution across Iceland municipalities.
 * Uses aggregated data for privacy (never shows individual locations).
 *
 * Module cleanup not needed - page reloads on navigation.
 * Security: Uses DOM methods to prevent XSS
 *
 * @module heatmap
 */

import { debug } from './utils/util-debug.js';
import { initAuthenticatedPage } from './page-init.js';
import { requireMember } from './rbac.js';
import { getHeatmapData } from './api/api-heatmap.js';
import { createIcelandMap } from './components/iceland-map.js';
import { showToast } from './components/ui-toast.js';
import { R } from '../i18n/strings-loader.js';

/**
 * Validate heatmap data structure
 * @param {Object} data - Data to validate
 * @returns {boolean} True if valid
 */
function validateHeatmapData(data) {
  if (!data || typeof data !== 'object') {
    debug.error('Invalid heatmap data: expected object');
    return false;
  }
  if (!Array.isArray(data.municipalities)) {
    debug.error('Invalid heatmap data: municipalities must be an array');
    return false;
  }
  return true;
}

/**
 * Initialize heatmap page
 */
async function init() {
  try {
    debug.log('Initializing heatmap page...');

    // Initialize authenticated page
    await initAuthenticatedPage();
    await requireMember();

    // Set page title
    document.title = 'Félagadreifing - Félagakerfi';

    // Fetch heatmap data
    const data = await getHeatmapData();
    debug.log('Heatmap data loaded:', data);

    // Validate data
    if (!validateHeatmapData(data)) {
      throw new Error('Ógild gögn frá þjóni');
    }

    // Hide loading, show content
    const loadingEl = document.getElementById('map-loading');
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }

    // Render stats
    renderStats(data);

    // Render map
    const mapContainer = document.getElementById('map-container');
    if (!mapContainer) {
      debug.warn('Map container element not found');
      return;
    }

    const mapComponent = createIcelandMap({
      data: data.municipalities,
      onMunicipalityClick: (name, info) => {
        debug.log('Clicked municipality:', name, info);
        // showToast uses textContent internally, safe from XSS
        showToast(`${name}: ${info.count} félagar (${info.percentage}%)`, 'info');
      }
    });
    mapContainer.appendChild(mapComponent.element);

    // Render top municipalities table
    if (data.municipalities && data.municipalities.length > 0) {
      renderTopMunicipalities(data.municipalities.slice(0, 10));
      const tableCard = document.getElementById('top-municipalities-card');
      if (tableCard) {
        tableCard.style.display = 'block';
      }

      // Render municipalities with 0 members (growth potential)
      renderZeroMemberMunicipalities(data.municipalities);
    }

    // Render abroad members
    if (data.abroad && data.abroad.length > 0) {
      renderAbroad(data.abroad, data.total_abroad);
    }

    debug.log('Heatmap page initialized');

  } catch (error) {
    debug.error('Heatmap init error:', error);

    // Show error safely (no innerHTML with user data)
    const loading = document.getElementById('map-loading');
    if (loading) {
      loading.textContent = '';

      const errorTitle = document.createElement('p');
      errorTitle.textContent = R.string.heatmap_data_load_error;
      loading.appendChild(errorTitle);

      const errorDetail = document.createElement('p');
      errorDetail.className = 'text-muted';
      errorDetail.style.fontSize = '0.875rem';
      errorDetail.textContent = error.message || 'Óþekkt villa';
      loading.appendChild(errorDetail);
    }

    showToast('Villa við að hlaða félagakorti', 'error');
  }
}

/**
 * Render stats cards safely using DOM methods
 * @param {Object} data - Heatmap data
 */
function renderStats(data) {
  const container = document.getElementById('heatmap-stats');
  if (!container) {
    debug.warn('Stats container element not found');
    return;
  }

  // Clear container
  container.textContent = '';

  // Create stat cards using DOM methods (XSS-safe)
  const stats = [
    { value: formatNumber(data.total_members), label: 'Félagar samtals' },
    { value: String(data.municipalities?.length || 0), label: 'Sveitarfélög' },
    {
      value: `${data.national_voters_percentage || 0}%`,
      label: 'Hlutfall kjósenda'
    },
    { value: `${data.coverage_percentage || 0}%`, label: 'Með staðfestu heimilisfangi' },
    { value: formatNumber(data.total_abroad || 0), label: 'Erlendis' }
  ];

  stats.forEach(stat => {
    const statDiv = document.createElement('div');
    statDiv.className = 'heatmap-stat';

    const valueDiv = document.createElement('div');
    valueDiv.className = 'heatmap-stat__value';
    valueDiv.textContent = stat.value;
    statDiv.appendChild(valueDiv);

    const labelDiv = document.createElement('div');
    labelDiv.className = 'heatmap-stat__label';
    labelDiv.textContent = stat.label;
    statDiv.appendChild(labelDiv);

    container.appendChild(statDiv);
  });

  // Add population source attribution if available
  if (data.population_source) {
    const sourceDiv = document.createElement('div');
    sourceDiv.className = 'heatmap-stat';
    sourceDiv.style.gridColumn = '1 / -1';
    sourceDiv.style.textAlign = 'center';
    sourceDiv.style.fontSize = 'var(--font-size-xs, 0.75rem)';
    sourceDiv.style.color = 'var(--color-muted, #6b7280)';
    sourceDiv.textContent = `Kjósendagögn: ${data.population_source}`;
    container.appendChild(sourceDiv);
  }
}

/**
 * Render top municipalities table safely using DOM methods
 * @param {Array} municipalities - Top municipalities
 */
function renderTopMunicipalities(municipalities) {
  const container = document.getElementById('top-municipalities');
  if (!container) {
    debug.warn('Top municipalities container element not found');
    return;
  }

  // Validate input
  if (!Array.isArray(municipalities)) {
    debug.error('Invalid municipalities data for table');
    return;
  }

  // Clear container
  container.textContent = '';

  // Check if we have voter data
  const hasVoterData = municipalities.some(m => m.eligible_voters !== undefined);

  // Create table using DOM methods (XSS-safe)
  const table = document.createElement('table');
  table.className = 'heatmap-table';

  // Create thead
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const headers = hasVoterData
    ? ['#', 'Sveitarfélag', 'Félagar', 'Kjósendur', 'Af kjósendum']
    : ['#', 'Sveitarfélag', 'Félagar', 'Hlutfall'];
  headers.forEach(headerText => {
    const th = document.createElement('th');
    th.textContent = headerText;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Create tbody
  const tbody = document.createElement('tbody');
  municipalities.forEach((m, i) => {
    const row = document.createElement('tr');

    // Rank
    const rankCell = document.createElement('td');
    rankCell.textContent = String(i + 1);
    row.appendChild(rankCell);

    // Name (escaped via textContent)
    const nameCell = document.createElement('td');
    nameCell.textContent = m.name || '';
    row.appendChild(nameCell);

    // Count
    const countCell = document.createElement('td');
    countCell.textContent = formatNumber(m.count);
    row.appendChild(countCell);

    if (hasVoterData) {
      // Eligible voters count
      const votersCell = document.createElement('td');
      votersCell.textContent = formatNumber(m.eligible_voters);
      row.appendChild(votersCell);

      // Percentage of voters
      const voterPercentCell = document.createElement('td');
      voterPercentCell.textContent = m.voters_percentage !== undefined
        ? `${m.voters_percentage}%`
        : '-';
      row.appendChild(voterPercentCell);
    } else {
      // Percentage of members
      const percentCell = document.createElement('td');
      percentCell.textContent = `${m.percentage || 0}%`;
      row.appendChild(percentCell);
    }

    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  container.appendChild(table);
}

/**
 * Render municipalities with 0 members (growth potential)
 * @param {Array} municipalities - All municipalities
 */
function renderZeroMemberMunicipalities(municipalities) {
  const container = document.getElementById('zero-municipalities');
  if (!container) {
    return; // Optional section, don't warn
  }

  // Filter municipalities with 0 members, sorted by eligible_voters descending
  const zeroMunicipalities = municipalities
    .filter(m => m.count === 0 && m.eligible_voters > 0)
    .sort((a, b) => b.eligible_voters - a.eligible_voters);

  if (zeroMunicipalities.length === 0) {
    container.closest('.card')?.classList.add('u-hidden');
    return;
  }

  // Clear container
  container.textContent = '';

  // Create table
  const table = document.createElement('table');
  table.className = 'heatmap-table';

  // Create thead
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['#', 'Sveitarfélag', 'Kjósendur'].forEach(headerText => {
    const th = document.createElement('th');
    th.textContent = headerText;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Create tbody (show top 10)
  const tbody = document.createElement('tbody');
  zeroMunicipalities.slice(0, 10).forEach((m, i) => {
    const row = document.createElement('tr');

    const rankCell = document.createElement('td');
    rankCell.textContent = String(i + 1);
    row.appendChild(rankCell);

    const nameCell = document.createElement('td');
    nameCell.textContent = m.name || '';
    row.appendChild(nameCell);

    const votersCell = document.createElement('td');
    votersCell.textContent = formatNumber(m.eligible_voters);
    row.appendChild(votersCell);

    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  container.appendChild(table);

  // Show the card
  container.closest('.card')?.classList.remove('u-hidden');
}

/**
 * Render abroad members table safely using DOM methods
 * @param {Array} abroad - Abroad members data [{country_code, country_name, count, percentage}]
 * @param {number} totalAbroad - Total members abroad
 */
function renderAbroad(abroad, totalAbroad) {
  const container = document.getElementById('abroad-list');
  const card = document.getElementById('abroad-card');
  if (!container || !card) {
    return;
  }

  // Validate input
  if (!Array.isArray(abroad) || abroad.length === 0) {
    return;
  }

  // Clear container
  container.textContent = '';

  // Create table using DOM methods (XSS-safe)
  const table = document.createElement('table');
  table.className = 'heatmap-table';

  // Create thead
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['#', 'Land', 'Félagar', 'Hlutfall'].forEach(headerText => {
    const th = document.createElement('th');
    th.textContent = headerText;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Create tbody
  const tbody = document.createElement('tbody');
  abroad.forEach((a, i) => {
    const row = document.createElement('tr');

    // Rank
    const rankCell = document.createElement('td');
    rankCell.textContent = String(i + 1);
    row.appendChild(rankCell);

    // Country name (escaped via textContent)
    const nameCell = document.createElement('td');
    nameCell.textContent = a.country_name || a.country_code || '';
    row.appendChild(nameCell);

    // Count
    const countCell = document.createElement('td');
    countCell.textContent = formatNumber(a.count);
    row.appendChild(countCell);

    // Percentage
    const percentCell = document.createElement('td');
    percentCell.textContent = `${a.percentage || 0}%`;
    row.appendChild(percentCell);

    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  // Add total row
  const tfoot = document.createElement('tfoot');
  const totalRow = document.createElement('tr');
  totalRow.className = 'heatmap-table__total';

  const emptyCell = document.createElement('td');
  totalRow.appendChild(emptyCell);

  const totalLabelCell = document.createElement('td');
  totalLabelCell.textContent = R.string.heatmap_total_label;
  totalLabelCell.style.fontWeight = 'bold';
  totalRow.appendChild(totalLabelCell);

  const totalCountCell = document.createElement('td');
  totalCountCell.textContent = formatNumber(totalAbroad);
  totalCountCell.style.fontWeight = 'bold';
  totalRow.appendChild(totalCountCell);

  const totalPercentCell = document.createElement('td');
  totalPercentCell.textContent = '100%';
  totalRow.appendChild(totalPercentCell);

  tfoot.appendChild(totalRow);
  table.appendChild(tfoot);

  container.appendChild(table);

  // Show the card
  card.style.display = 'block';
}

/**
 * Format number with Icelandic locale
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
  if (num === undefined || num === null) return '-';
  if (typeof num !== 'number') return String(num);
  return num.toLocaleString('is-IS');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
