/**
 * Admin Election Control Page
 *
 * Allows administrators to control election schedule:
 * - Start election immediately
 * - Schedule election for specific time
 * - Close election manually
 * - Preview how members see the election
 */

import { initAuthenticatedPage } from '../../js/page-init.js';
import { debug } from '../../js/utils/debug.js';
import { R } from '../i18n/strings-loader.js';
import { getAdminElectionById } from '../../js/api/elections-api.js';
import { electionState } from '../../js/utils/election-state.js';
import { createScheduleControl } from '../../js/components/schedule-control.js';
import { createScheduleDisplay } from '../../js/components/schedule-display.js';

/**
 * Get election ID from URL query parameter
 */
function getElectionIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

/**
 * Show loading state
 */
function showLoading() {
  document.getElementById('loading-state').classList.remove('u-hidden');
  document.getElementById('error-state').classList.add('u-hidden');
  document.getElementById('election-control-content').classList.add('u-hidden');
}

/**
 * Hide loading state
 */
function hideLoading() {
  document.getElementById('loading-state').classList.add('u-hidden');
}

/**
 * Show error state
 */
function showError(message) {
  document.getElementById('error-state').classList.remove('u-hidden');
  document.getElementById('error-message').textContent = message;
  document.getElementById('loading-state').classList.add('u-hidden');
  document.getElementById('election-control-content').classList.add('u-hidden');
}

/**
 * Display election control interface
 */
function displayElectionControl(election) {
  // Update header
  document.getElementById('election-title').textContent = election.title;
  document.getElementById('election-question').textContent = election.question;

  // Initialize election state
  electionState.initialize(election);

  // Create schedule control component
  const scheduleControl = createScheduleControl({
    electionId: election.id,
    onStarted: (state) => {
      debug.log('Election started:', state);
      // TODO: Call API to update election status
      alert('Kosning byrjuð! ✅\n\n(Í production myndi þetta kalla á API)');
    },
    onClosed: (state) => {
      debug.log('Election closed:', state);
      // TODO: Call API to close election
      alert('Kosningu lokað! 🔒\n\n(Í production myndi þetta kalla á API)');
    },
    onScheduled: (state) => {
      debug.log('Election scheduled:', state);
      // TODO: Call API to schedule election
      alert('Kosning áætluð! 📅\n\n(Í production myndi þetta kalla á API)');
    }
  });

  const controlContainer = document.getElementById('schedule-control-container');
  controlContainer.appendChild(scheduleControl.element);

  // Create member preview (schedule display)
  const memberPreview = createScheduleDisplay({
    startLabel: R.string.election_starts,
    endLabel: R.string.election_ends,
    showCountdown: true
  });

  const previewContainer = document.getElementById('member-preview-container');
  previewContainer.appendChild(memberPreview.element);

  // Show content
  document.getElementById('election-control-content').classList.remove('u-hidden');
}

/**
 * Load election data
 */
async function loadElection(electionId) {
  try {
    showLoading();

    // Fetch election using Admin API (to access draft/hidden elections)
    const election = await getAdminElectionById(electionId);

    // Display control interface
    displayElectionControl(election);

    hideLoading();

  } catch (error) {
    debug.error('Failed to load election:', error);
    showError(R.string.error_load_election_generic);
  }
}

/**
 * Initialize page
 */
async function init() {
  try {
    // Load i18n
    await R.load('is');

    // Initialize authenticated page
    await initAuthenticatedPage();

    // Update navigation
    document.getElementById('nav-admin-dashboard').textContent = R.string.nav_admin_dashboard || 'Yfirlit';
    document.getElementById('nav-admin-members').textContent = R.string.nav_admin_members || 'Félagsmenn';
    document.getElementById('nav-back-to-member').textContent = R.string.nav_back_to_member || 'Til baka í félagasvæði';
    document.getElementById('nav-logout').textContent = R.string.nav_logout;

    // Get election ID from URL
    const electionId = getElectionIdFromURL();

    if (!electionId) {
      showError(R.string.error_no_election_id_in_path);
      return;
    }

    // Load election
    await loadElection(electionId);

    // Setup retry button
    document.getElementById('retry-button').addEventListener('click', () => {
      loadElection(electionId);
    });

  } catch (error) {
    debug.error('Failed to initialize election control page:', error);
    showError(R.string.error_page_load_generic);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
