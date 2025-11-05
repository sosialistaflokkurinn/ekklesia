/**
 * Election Detail & Voting Page
 *
 * Displays election details and handles voting.
 * - Shows voting form for active elections
 * - Shows "Already voted" message for voted elections
 * - Shows results for closed elections
 * - Two-step voting: confirmation modal before submission
 */

import { initAuthenticatedPage } from './page-init.js';
import { debug } from './utils/debug.js';
import { R } from '../i18n/strings-loader.js';
import { debug } from './utils/debug.js';
import { getElectionById, submitVote, getResults } from './api/elections-api.js';
import { debug } from './utils/debug.js';
import { auth } from './auth.js';
import { debug } from './utils/debug.js';
import { escapeHTML } from './utils/format.js';
import { debug } from './utils/debug.js';

// State
let currentElection = null;
let pendingAnswer = null;

/**
 * Update all static HTML text with R.string values
 */
function updateHTMLStrings() {
  // Page title (will be overridden with election title later)
  document.getElementById('page-title').textContent = R.string.page_title_election_detail;

  // Back link
  document.getElementById('back-link').textContent = R.string.election_detail_back_link;

  // Loading message
  document.getElementById('loading-message').textContent = R.string.loading_election_detail;

  // Error messages
  document.getElementById('error-message').textContent = R.string.error_load_election_detail;
  document.getElementById('error-back-link').textContent = R.string.btn_back_to_elections;

  // Election title (placeholder, will be replaced with API data)
  document.getElementById('election-title').textContent = R.string.election_detail_title;

  // Voting section
  document.getElementById('voting-title').textContent = R.string.voting_section_title;
  document.getElementById('submit-vote-btn').textContent = R.string.btn_vote;

  // Already voted section
  document.getElementById('already-voted-msg').textContent = R.string.msg_already_voted;

  // Upcoming section
  document.getElementById('upcoming-text').textContent = R.string.msg_upcoming_election;

  // Results section
  document.getElementById('results-title').textContent = R.string.results_title;

  // Confirmation modal
  document.getElementById('confirm-title').textContent = R.string.modal_confirm_title;
  document.getElementById('confirm-message').textContent = R.string.modal_confirm_message;
  document.getElementById('confirm-cancel-text').textContent = R.string.btn_cancel;
  document.getElementById('confirm-submit-text').textContent = R.string.btn_confirm;

  // Success modal
  document.getElementById('success-title').textContent = R.string.modal_success_title;
  document.getElementById('success-message').textContent = R.string.modal_success_message;
  document.getElementById('success-back-link').textContent = R.string.btn_back_to_elections;
}

/**
 * Initialize election detail page
 */
async function init() {
  try {
    // Load i18n strings
    await R.load('is');

    // Update all static HTML text with R.string values
    updateHTMLStrings();

    // Initialize authenticated page
    await initAuthenticatedPage();

    // Update elections navigation link (page-specific)
    document.getElementById('nav-voting').textContent = R.string.nav_voting;

    // Get election ID from URL
    const params = new URLSearchParams(window.location.search);
    const electionId = params.get('id');

    if (!electionId) {
      showError(R.string.error_no_election_selected);
      return;
    }

    // Load election
    await loadElection(electionId);

  } catch (error) {
    debug.error('Error initializing election detail page:', error);
    showError(R.string.error_load_election_detail);
  }
}

/**
 * Load election details from API
 */
async function loadElection(electionId) {
  try {
    showLoading();

    const election = await getElectionById(electionId);
    currentElection = election;

    document.title = `${election.title} - ${R.string.app_name}`;

    // Display election
    displayElection(election);

    hideLoading();

  } catch (error) {
    debug.error('Error loading election:', error);
    showError(R.string.error_load_election_detail);
  }
}

/**
 * Display election based on status
 */
function displayElection(election) {
  // Hide all sections first
  document.getElementById('voting-section').classList.add('u-hidden');
  document.getElementById('already-voted-section').classList.add('u-hidden');
  document.getElementById('upcoming-section').classList.add('u-hidden');
  document.getElementById('results-section').classList.add('u-hidden');

  // Show main election detail
  document.getElementById('election-detail').classList.remove('u-hidden');

  // Update header
  document.getElementById('election-title').textContent = election.title;
  document.getElementById('election-question').textContent = election.question;

  // Update status and date
  let statusText = '';
  if (election.status === 'active') {
    statusText = R.string.status_active;
  } else if (election.status === 'upcoming') {
    statusText = R.string.status_upcoming;
  } else if (election.status === 'closed') {
    statusText = R.string.status_closed;
  }
  const statusClass = `election-detail__status--${election.status}`;
  document.getElementById('election-status').textContent = statusText;
  document.getElementById('election-status').className = `election-detail__status ${statusClass}`;
  document.getElementById('election-date').textContent = formatDate(election.voting_starts_at);

  // Show appropriate section based on status
  if (election.status === 'active') {
    if (election.has_voted) {
      document.getElementById('already-voted-section').classList.remove('u-hidden');
    } else {
      showVotingSection(election);
    }
  } else if (election.status === 'upcoming') {
    document.getElementById('upcoming-section').classList.remove('u-hidden');
  } else if (election.status === 'closed') {
    showResults(election.id);
  }
}

/**
 * Show voting section with vote form
 */
function showVotingSection(election) {
  const votingSection = document.getElementById('voting-section');
  const optionsContainer = document.getElementById('vote-options');

  votingSection.classList.remove('u-hidden');

  // Clear previous options
  optionsContainer.innerHTML = '';

  // Create radio buttons for each answer
  election.answers.forEach(answer => {
    const label = document.createElement('label');
    label.className = 'voting__option';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'answer';
    radio.value = answer.id;
    radio.required = true;

    const labelText = document.createElement('span');
    labelText.className = 'voting__option-label';
    labelText.textContent = answer.text;

    label.appendChild(radio);
    label.appendChild(labelText);
    optionsContainer.appendChild(label);
  });

  // Setup form submission
  const form = document.getElementById('vote-form');
  form.removeEventListener('submit', handleVoteSubmit);
  form.addEventListener('submit', handleVoteSubmit);

  // Setup confirmation modal
  setupConfirmationModal();
}

/**
 * Handle vote form submission (show confirmation modal)
 */
function handleVoteSubmit(e) {
  e.preventDefault();

  // Get selected answer
  const selectedRadio = document.querySelector('input[name="answer"]:checked');
  if (!selectedRadio) {
    return;
  }

  pendingAnswer = selectedRadio.value;

  // Show confirmation modal
  const modal = document.getElementById('confirm-modal');
  modal.classList.remove('u-hidden');
}

/**
 * Setup confirmation modal buttons
 */
function setupConfirmationModal() {
  const modal = document.getElementById('confirm-modal');
  const cancelBtn = document.getElementById('confirm-cancel');
  const submitBtn = document.getElementById('confirm-submit');

  cancelBtn.addEventListener('click', () => {
    modal.classList.add('u-hidden');
    pendingAnswer = null;
  });

  submitBtn.addEventListener('click', async () => {
    modal.classList.add('u-hidden');
    await confirmVote();
  });
}

/**
 * Confirm vote and submit to API
 */
async function confirmVote() {
  if (!pendingAnswer || !currentElection) {
    return;
  }

  try {
    showLoading();

    // Submit vote
    await submitVote(currentElection.id, pendingAnswer);

    // Show success modal
    const successModal = document.getElementById('success-modal');
    successModal.classList.remove('u-hidden');

    // Reload election after 2 seconds
    setTimeout(() => {
      window.location.reload();
    }, 2000);

  } catch (error) {
    debug.error('Error submitting vote:', error);
    showError(R.string.error_submit_vote);
  }
}

/**
 * Load and display election results
 */
async function showResults(electionId) {
  try {
    const results = await getResults(electionId);

    // Calculate percentages
    const totalVotes = results.answers.reduce((sum, a) => sum + a.count, 0);
    const answersWithPercent = results.answers.map(a => ({
      ...a,
      percentage: totalVotes > 0 ? Math.round((a.count / totalVotes) * 100) : 0
    }));

    // Display results
    const resultsContainer = document.getElementById('results-container');
    resultsContainer.innerHTML = '';

    answersWithPercent.forEach(answer => {
      const resultItem = document.createElement('div');
      resultItem.className = 'results__item';

      resultItem.innerHTML = `
        <div class="results__item-header">
          <span class="results__item-label">${escapeHTML(answer.text)}</span>
          <span class="results__item-percentage">${answer.percentage}%</span>
        </div>
        <div class="results__bar">
          <div class="results__bar-fill" style="width: ${answer.percentage}%"></div>
        </div>
        <span class="results__votes">${R.format(R.string.results_votes, answer.count)}</span>
      `;

      resultsContainer.appendChild(resultItem);
    });

    document.getElementById('results-section').classList.remove('u-hidden');

  } catch (error) {
    debug.error('Error loading results:', error);
    showError(R.string.error_load_results);
  }
}

/**
 * Show loading state
 */
function showLoading() {
  document.getElementById('election-loading').classList.remove('u-hidden');
  document.getElementById('election-error').classList.add('u-hidden');
  document.getElementById('election-detail').classList.add('u-hidden');
}

/**
 * Hide loading state
 */
function hideLoading() {
  document.getElementById('election-loading').classList.add('u-hidden');
}

/**
 * Show error state
 */
function showError(message) {
  document.getElementById('election-error').classList.remove('u-hidden');
  document.getElementById('error-message').textContent = message;
  document.getElementById('election-loading').classList.add('u-hidden');
  document.getElementById('election-detail').classList.add('u-hidden');
}

/**
 * Utility: Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('is-IS', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
