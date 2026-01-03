/**
 * Iceland Map Component
 *
 * Renders an SVG choropleth map of Iceland municipalities.
 * Each municipality is colored based on member count percentage.
 *
 * Created: Dec 2025
 * Part of: Member Heatmap Feature
 *
 * Security: Uses textContent/DOMParser to prevent XSS
 * Accessibility: Keyboard navigation and ARIA labels
 *
 * @module components/iceland-map
 */

import { el } from '../utils/util-dom.js';
import { debug } from '../utils/util-debug.js';
import { R } from '../../i18n/strings-loader.js';

// Color scale (light to dark - party red)
const COLOR_SCALE = [
  '#fee0d2', // 0-1%
  '#fcbba1', // 1-5%
  '#fc9272', // 5-10%
  '#fb6a4a', // 10-20%
  '#ef3b2c', // 20-40%
  '#cb181d'  // 40%+
];

// Default color for municipalities without data
const DEFAULT_COLOR = '#f3f4f6';

// ViewBox configurations for zoom levels
const VIEWBOX = {
  full: '0 0 900 479',           // Full Iceland
  capital: '156 281 159 161',    // Capital region (höfuðborgarsvæðið)
  akureyri: '427 0 140 283',     // Akureyri area (Norðurland eystra)
  egilsstadir: '610 103 290 232' // Egilsstaðir area (Austurland)
};

// Store event listeners for cleanup (prevents memory leaks)
const listenerRegistry = new WeakMap();

/**
 * Validate municipality data
 * @param {Array} data - Municipality data array
 * @returns {boolean} True if valid
 */
function validateData(data) {
  if (!data || !Array.isArray(data)) {
    debug.warn('Invalid municipalities data: expected array');
    return false;
  }
  return true;
}

/**
 * Get color for percentage value
 * @param {number} percentage
 * @returns {string} Hex color
 */
function getColor(percentage) {
  if (typeof percentage !== 'number' || percentage <= 0) return DEFAULT_COLOR;
  if (percentage <= 1) return COLOR_SCALE[0];
  if (percentage <= 5) return COLOR_SCALE[1];
  if (percentage <= 10) return COLOR_SCALE[2];
  if (percentage <= 20) return COLOR_SCALE[3];
  if (percentage <= 40) return COLOR_SCALE[4];
  return COLOR_SCALE[5];
}

/**
 * Create Iceland heatmap component
 *
 * @param {Object} options - Component options
 * @param {Array<{name: string, count: number, percentage: number}>} options.data - Municipality data
 * @param {Function} [options.onMunicipalityClick] - Click handler (name, data) => void
 * @returns {Object} Component API {element, update, destroy}
 */
export function createIcelandMap(options = {}) {
  const { data = [], onMunicipalityClick = null } = options;

  // Validate input data
  if (!validateData(data)) {
    debug.error('createIcelandMap: Invalid data provided');
  }

  // Create container
  const container = el('div', 'iceland-map');
  container.setAttribute('role', 'img');
  container.setAttribute('aria-label', 'Kort af Íslandi sem sýnir dreifingu félaga eftir sveitarfélögum');

  // Zoom controls
  const zoomControls = createZoomControls(container);
  container.appendChild(zoomControls);

  // SVG container
  const svgContainer = el('div', 'iceland-map__svg');
  container.appendChild(svgContainer);

  // Legend
  const legend = createLegend();
  container.appendChild(legend);

  // Tooltip
  const tooltip = el('div', 'iceland-map__tooltip');
  tooltip.setAttribute('role', 'tooltip');
  tooltip.setAttribute('aria-hidden', 'true');
  tooltip.style.display = 'none';
  container.appendChild(tooltip);

  // Load SVG
  loadSvgMap(svgContainer, data, tooltip, onMunicipalityClick);

  return {
    element: container,
    update: (newData) => {
      if (validateData(newData)) {
        updateMapColors(svgContainer, newData, tooltip, onMunicipalityClick);
      }
    },
    destroy: () => {
      // Clean up event listeners
      cleanupListeners(svgContainer);
      container.remove();
    }
  };
}

/**
 * Load SVG map safely using DOMParser (prevents XSS)
 */
async function loadSvgMap(container, data, tooltip, onClick) {
  try {
    const response = await fetch('/assets/iceland-municipalities.svg');

    if (!response.ok) {
      throw new Error(`Failed to load SVG: ${response.status}`);
    }

    const svgText = await response.text();

    // Parse SVG safely using DOMParser (prevents XSS from malicious SVG)
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');

    // Check for parsing errors
    const parseError = svgDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Invalid SVG format');
    }

    const svg = svgDoc.documentElement;
    if (!svg || svg.tagName !== 'svg') {
      throw new Error('SVG element not found');
    }

    // Clear container and append parsed SVG
    container.textContent = '';
    container.appendChild(svg);

    svg.classList.add('iceland-map__map');
    setupInteractions(svg, data, tooltip, onClick);

  } catch (error) {
    debug.error('Failed to load Iceland map:', error);

    // Create error message safely (no innerHTML with user data)
    container.textContent = '';
    const errorDiv = el('div', 'iceland-map__error');

    const errorTitle = document.createElement('p');
    errorTitle.textContent = R.string.map_load_error;
    errorDiv.appendChild(errorTitle);

    const errorDetail = document.createElement('p');
    errorDetail.className = 'text-muted';
    errorDetail.textContent = error.message || 'Óþekkt villa';
    errorDiv.appendChild(errorDetail);

    container.appendChild(errorDiv);
  }
}

/**
 * Clean up event listeners to prevent memory leaks
 */
function cleanupListeners(container) {
  const svg = container.querySelector('svg');
  if (!svg) return;

  const paths = svg.querySelectorAll('[data-municipality]');
  paths.forEach(path => {
    const listeners = listenerRegistry.get(path);
    if (listeners) {
      listeners.forEach(({ type, handler }) => {
        path.removeEventListener(type, handler);
      });
      listenerRegistry.delete(path);
    }
  });
}

/**
 * Add event listener and track it for cleanup
 */
function addTrackedListener(element, type, handler) {
  element.addEventListener(type, handler);

  const existing = listenerRegistry.get(element) || [];
  existing.push({ type, handler });
  listenerRegistry.set(element, existing);
}

/**
 * Setup hover/click interactions for municipalities with keyboard accessibility
 */
function setupInteractions(svg, data, tooltip, onClick) {
  // Clean up previous listeners first
  cleanupListeners(svg.parentElement);

  // Validate data
  if (!validateData(data)) return;

  // Create lookup map by name
  const dataMap = new Map(data.map(d => [d.name, d]));

  // Find all municipality paths (each has data-municipality attribute)
  const paths = svg.querySelectorAll('[data-municipality]');

  if (paths.length === 0) {
    debug.warn('No municipality paths found in SVG. Expected data-municipality attributes.');
    return;
  }

  debug.log(`Setting up interactions for ${paths.length} municipalities`);

  paths.forEach(path => {
    const name = path.getAttribute('data-municipality') || '';
    const municipalityData = dataMap.get(name) || { count: 0, percentage: 0 };

    // Apply color based on percentage
    path.style.fill = getColor(municipalityData.percentage);
    path.classList.add('iceland-map__region');

    // Accessibility: Add ARIA attributes
    path.setAttribute('role', 'button');
    path.setAttribute('aria-label', `${name}: ${municipalityData.count} félagar (${municipalityData.percentage}%)`);
    path.setAttribute('tabindex', '0');

    // Hover: show tooltip (using textContent for security)
    const handleMouseEnter = () => {
      // Build tooltip content safely
      tooltip.textContent = '';

      const strong = document.createElement('strong');
      strong.textContent = name;
      tooltip.appendChild(strong);

      tooltip.appendChild(document.createElement('br'));

      // Member count and percentage of total members
      const memberLine = document.createTextNode(
        `${municipalityData.count} félagar (${municipalityData.percentage}% félagsmanna)`
      );
      tooltip.appendChild(memberLine);

      // If we have voter data, show percentage of eligible voters
      if (municipalityData.voters_percentage !== undefined && municipalityData.eligible_voters) {
        tooltip.appendChild(document.createElement('br'));
        const voterLine = document.createTextNode(
          `${municipalityData.voters_percentage}% kjósenda (${municipalityData.eligible_voters.toLocaleString('is-IS')} kjósendur)`
        );
        tooltip.appendChild(voterLine);
      }

      tooltip.style.display = 'block';
      tooltip.setAttribute('aria-hidden', 'false');
      path.classList.add('iceland-map__region--hover');
    };

    const handleMouseMove = (e) => {
      const offsetX = 12;
      const offsetY = 12;
      // Use clientX/clientY for fixed positioning
      tooltip.style.left = `${e.clientX + offsetX}px`;
      tooltip.style.top = `${e.clientY + offsetY}px`;
    };

    const handleMouseLeave = () => {
      tooltip.style.display = 'none';
      tooltip.setAttribute('aria-hidden', 'true');
      path.classList.remove('iceland-map__region--hover');
    };

    // Keyboard accessibility
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (onClick) {
          onClick(name, municipalityData);
        }
      }
    };

    const handleFocus = () => {
      handleMouseEnter();
      // Position tooltip near element for keyboard users (using fixed positioning)
      const rect = path.getBoundingClientRect();
      tooltip.style.left = `${rect.left + rect.width / 2}px`;
      tooltip.style.top = `${rect.top - 50}px`;
    };

    const handleBlur = () => {
      handleMouseLeave();
    };

    // Add tracked event listeners
    addTrackedListener(path, 'mouseenter', handleMouseEnter);
    addTrackedListener(path, 'mousemove', handleMouseMove);
    addTrackedListener(path, 'mouseleave', handleMouseLeave);
    addTrackedListener(path, 'focus', handleFocus);
    addTrackedListener(path, 'blur', handleBlur);
    addTrackedListener(path, 'keydown', handleKeyDown);

    // Click handler
    if (onClick) {
      path.style.cursor = 'pointer';
      const handleClick = () => onClick(name, municipalityData);
      addTrackedListener(path, 'click', handleClick);
    }
  });
}

/**
 * Update map colors with new data
 */
function updateMapColors(container, data, tooltip, onClick) {
  const svg = container.querySelector('svg');
  if (!svg) return;

  setupInteractions(svg, data, tooltip, onClick);
}

/**
 * Create color scale legend
 */
function createLegend() {
  const legend = el('div', 'iceland-map__legend');
  legend.setAttribute('role', 'list');
  legend.setAttribute('aria-label', 'Litakvarði');

  const labels = ['0-1%', '1-5%', '5-10%', '10-20%', '20-40%', '40%+'];

  COLOR_SCALE.forEach((color, i) => {
    const item = el('div', 'iceland-map__legend-item');
    item.setAttribute('role', 'listitem');

    const swatch = el('div', 'iceland-map__legend-swatch');
    swatch.style.backgroundColor = color;
    swatch.setAttribute('aria-hidden', 'true');

    const label = el('span', 'iceland-map__legend-label', {}, labels[i]);

    item.appendChild(swatch);
    item.appendChild(label);
    legend.appendChild(item);
  });

  return legend;
}

/**
 * Create zoom controls for the map
 * @param {HTMLElement} mapContainer - The map container element
 * @returns {HTMLElement} Zoom controls element
 */
function createZoomControls(mapContainer) {
  const controls = el('div', 'iceland-map__zoom-controls');

  // Track current zoom state
  let currentZoom = 'full';

  // Zoom regions configuration
  const regions = [
    { id: 'full', label: 'Allt Ísland' },
    { id: 'capital', label: 'Höfuðborgarsvæðið' },
    { id: 'akureyri', label: 'Akureyri' },
    { id: 'egilsstadir', label: 'Egilsstaðir' }
  ];

  const buttons = {};

  // Create buttons for each region
  regions.forEach(region => {
    const btn = el('button', 'iceland-map__zoom-btn');
    if (region.id === 'full') {
      btn.classList.add('iceland-map__zoom-btn--active');
    }
    btn.textContent = region.label;
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-pressed', region.id === 'full' ? 'true' : 'false');
    btn.setAttribute('data-region', region.id);
    buttons[region.id] = btn;
    controls.appendChild(btn);
  });

  // Zoom handler
  const zoomTo = (regionId) => {
    if (currentZoom === regionId) return;

    const svg = mapContainer.querySelector('svg');
    if (svg && VIEWBOX[regionId]) {
      svg.setAttribute('viewBox', VIEWBOX[regionId]);

      if (regionId === 'full') {
        svg.classList.remove('iceland-map__map--zoomed');
      } else {
        svg.classList.add('iceland-map__map--zoomed');
      }
    }

    // Update button states
    Object.entries(buttons).forEach(([id, btn]) => {
      if (id === regionId) {
        btn.classList.add('iceland-map__zoom-btn--active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('iceland-map__zoom-btn--active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });

    currentZoom = regionId;
  };

  // Add click handlers
  Object.entries(buttons).forEach(([id, btn]) => {
    btn.addEventListener('click', () => zoomTo(id));
  });

  return controls;
}

/**
 * Get the color scale (for external use if needed)
 */
export function getColorScale() {
  return [...COLOR_SCALE];
}
