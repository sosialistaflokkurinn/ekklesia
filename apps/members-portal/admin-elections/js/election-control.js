/**
 * Admin Election Control Page
 *
 * Allows administrators to:
 * - View election status and vote count
 * - Close election manually
 * - Preview how members see the election
 *
 * Note: Elections are started/opened from the elections list page.
 */

import { initAuthenticatedPage } from '../../js/page-init.js';
import { debug } from '../../js/utils/util-debug.js';
import { R } from '../i18n/strings-loader.js';
import { getAdminElectionById } from '../../js/api/api-elections.js';
import { closeElection } from './api/elections-admin-api.js';
import { electionState } from '../../js/utils/election-state.js';
import { createScheduleControl } from '../../js/components/election-schedule-control.js';
import { createScheduleDisplay } from '../../js/components/election-schedule-display.js';
import { createShareButton } from '../../js/components/election-share-qr.js';

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

  // Add share button to header
  const headerElement = document.querySelector('.card__title#election-title');
  if (headerElement) {
    const shareBtn = createShareButton({
      electionId: election.id,
      electionTitle: election.title,
      buttonText: '📱 QR kóði',
      buttonClass: 'btn btn--secondary btn--sm'
    });
    shareBtn.style.marginLeft = '1rem';
    headerElement.parentNode.insertBefore(shareBtn, headerElement.nextSibling);
  }

  // Initialize election state
  electionState.initialize(election);

  // Create schedule control component
  const scheduleControl = createScheduleControl({
    electionId: election.id,
    voteCount: election.vote_count || election.total_votes || 0,
    onClosed: async (state) => {
      debug.log('Election closed:', state);
      try {
        await closeElection(election.id);
        // Reload to sync state
        await loadElection(election.id);
      } catch (error) {
        debug.error('Failed to close election:', error);
        alert(R.string.error_generic || 'Villa kom upp við að loka kosningu');
      }
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
    
    // Translate elements with data-i18n attributes
    R.translatePage();

    // Initialize authenticated page
    await initAuthenticatedPage();

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
