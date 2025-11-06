/**
 * Election Detail Page
 *
 * Display full election information and voting interface.
 * Handles:
 * - Election info display (title, question, schedule, status)
 * - Voting UI (radio buttons for answers)
 * - Vote submission with confirmation
 * - Results display (for closed elections)
 * - Already voted state
 */

import { initAuthenticatedPage } from './page-init.js';
import { debug } from './utils/debug.js';
import { R } from '../i18n/strings-loader.js';
import { getElectionById } from './api/elections-api.js';
import { escapeHTML } from './utils/format.js';

// State
let currentElection = null;
let selectedAnswerId = null;

/**
 * Initialize election detail page
 */
async function init() {
  try {
    // Load i18n strings
    await R.load('is');

    // Initialize authenticated page (header, navigation, auth check)
    await initAuthenticatedPage();

    // Update voting navigation link
    document.getElementById('nav-voting').textContent = R.string.nav_voting;

    // Update static text elements
    updateStaticText();

    // Get election ID from URL
    const electionId = getElectionIdFromURL();

    if (!electionId) {
      showError(R.string.error_missing_election_id);
      return;
    }

    // Load election data
    await loadElection(electionId);

  } catch (error) {
    debug.error('Error initializing election detail page:', error);
    showError(R.string.error_load_election);
  }
}

/**
 * Update all static text elements with i18n strings
 */
function updateStaticText() {
  document.getElementById('back-text').textContent = R.string.back_to_elections;
  document.getElementById('loading-message').textContent = R.string.loading_election;
  document.getElementById('error-message').textContent = R.string.error_load_election;
  document.getElementById('retry-button').textContent = R.string.btn_retry;
  document.getElementById('question-title-label').textContent = R.string.election_question_label;
  document.getElementById('voting-title').textContent = R.string.voting_select_answer;
  document.getElementById('vote-button-text').textContent = R.string.btn_vote;
  document.getElementById('results-title').textContent = R.string.results_title;
  document.getElementById('results-total-votes-label').textContent = R.string.results_total_votes;
  document.getElementById('schedule-starts-label').textContent = R.string.election_starts;
  document.getElementById('schedule-ends-label').textContent = R.string.election_ends;
  document.getElementById('voted-badge-text').textContent = R.string.election_already_voted;
  document.getElementById('upcoming-message').textContent = R.string.election_upcoming_message;

  // Modal text
  document.getElementById('modal-title').textContent = R.string.confirm_vote_title;
  document.getElementById('modal-message').textContent = R.string.confirm_vote_message;
  document.getElementById('modal-cancel').textContent = R.string.btn_cancel;
  document.getElementById('modal-confirm').textContent = R.string.btn_confirm;
}

/**
 * Get election ID from URL query parameter
 */
function getElectionIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

/**
 * Load election data from API
 */
async function loadElection(electionId) {
  try {
    showLoading();

    // Fetch election details
    currentElection = await getElectionById(electionId);

    // Update page title
    document.title = currentElection.title + ' - ' + R.string.app_name;

    // Display election
    displayElection(currentElection);

    hideLoading();

  } catch (error) {
    debug.error('Error loading election ' + electionId + ':', error);
    showError(R.string.error_load_election);
  }
}

/**
 * Display election information
 */
function displayElection(election) {
  // Update header
  document.getElementById('election-title').textContent = election.title;

  // Status badge
  const statusBadge = document.getElementById('election-status-badge');
  statusBadge.className = 'election-detail__status-badge election-detail__status-badge--' + election.status;

  if (election.status === 'active') {
    statusBadge.textContent = R.string.status_active;
  } else if (election.status === 'upcoming') {
    statusBadge.textContent = R.string.status_upcoming;
  } else if (election.status === 'closed') {
    statusBadge.textContent = R.string.status_closed;
  }

  // Already voted badge
  if (election.has_voted) {
    document.getElementById('already-voted-badge').classList.remove('u-hidden');
  }

  // Schedule
  document.getElementById('schedule-starts-value').textContent = formatDate(election.voting_starts_at);
  document.getElementById('schedule-ends-value').textContent = formatDate(election.voting_ends_at);

  // Description (if available)
  if (election.description) {
    document.getElementById('election-description').innerHTML = '<p>' + escapeHTML(election.description) + '</p>';
  }

  // Question
  document.getElementById('question-text').textContent = election.question;

  // Show appropriate section based on status and voting state
  if (election.status === 'active' && !election.has_voted) {
    displayVotingSection(election);
  } else if (election.status === 'closed') {
    displayResultsSection(election);
  } else if (election.status === 'upcoming') {
    displayUpcomingSection();
  } else if (election.has_voted) {
    displayAlreadyVotedSection();
  }

  // Show election content
  document.getElementById('election-content').classList.remove('u-hidden');
}

/**
 * Display voting section with answer options
 */
function displayVotingSection(election) {
  const votingSection = document.getElementById('voting-section');
  const answerOptionsContainer = document.getElementById('answer-options');
  const voteButton = document.getElementById('vote-button');
  const votingForm = document.getElementById('voting-form');

  // Clear previous options
  answerOptionsContainer.innerHTML = '';

  // Create radio buttons for each answer
  election.answers.forEach((answer, index) => {
    const optionDiv = document.createElement('div');
    optionDiv.className = 'election-detail__answer-option';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.id = 'answer-' + answer.id;
    radio.name = 'answer';
    radio.value = answer.id;
    radio.className = 'election-detail__answer-radio';

    // Enable vote button when answer is selected
    radio.addEventListener('change', () => {
      selectedAnswerId = answer.id;
      voteButton.disabled = false;
    });

    const label = document.createElement('label');
    label.htmlFor = 'answer-' + answer.id;
    label.className = 'election-detail__answer-label';
    label.textContent = answer.text;

    optionDiv.appendChild(radio);
    optionDiv.appendChild(label);
    answerOptionsContainer.appendChild(optionDiv);
  });

  // Handle vote form submission
  votingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (selectedAnswerId) {
      showConfirmationModal();
    }
  });

  votingSection.classList.remove('u-hidden');
}

/**
 * Display results section (for closed elections)
 */
function displayResultsSection(election) {
  const resultsSection = document.getElementById('results-section');
  const resultsList = document.getElementById('results-list');

  // TODO: Fetch and display actual results (Day 4)
  // For now, just show placeholder
  resultsList.innerHTML = '<p>Results will be displayed here (Day 4 implementation)</p>';

  resultsSection.classList.remove('u-hidden');
}

/**
 * Display upcoming section
 */
function displayUpcomingSection() {
  document.getElementById('upcoming-section').classList.remove('u-hidden');
}

/**
 * Display already voted section
 */
function displayAlreadyVotedSection() {
  const votingSection = document.getElementById('voting-section');
  votingSection.innerHTML = '<div class="election-detail__already-voted"><p>' + R.string.election_already_voted_message + '</p></div>';
  votingSection.classList.remove('u-hidden');
}

/**
 * Show confirmation modal before submitting vote
 */
function showConfirmationModal() {
  const modal = document.getElementById('confirmation-modal');
  const selectedAnswer = currentElection.answers.find(a => a.id === selectedAnswerId);

  if (selectedAnswer) {
    document.getElementById('modal-selected-answer').textContent = R.string.your_answer + ': ' + selectedAnswer.text;
  }

  modal.classList.remove('u-hidden');

  // Setup modal event listeners
  const confirmButton = document.getElementById('modal-confirm');
  const cancelButton = document.getElementById('modal-cancel');
  const closeButton = document.getElementById('modal-close');

  confirmButton.onclick = () => {
    hideConfirmationModal();
    submitVote();
  };

  cancelButton.onclick = hideConfirmationModal;
  closeButton.onclick = hideConfirmationModal;

  // Close on overlay click
  document.querySelector('.modal__overlay').onclick = hideConfirmationModal;
}

/**
 * Hide confirmation modal
 */
function hideConfirmationModal() {
  document.getElementById('confirmation-modal').classList.add('u-hidden');
}

/**
 * Submit vote (placeholder for Day 3)
 */
async function submitVote() {
  debug.log('Vote submission (Day 3): Election ' + currentElection.id + ', Answer ' + selectedAnswerId);

  // TODO: Implement actual vote submission on Day 3
  // For now, just show success message
  alert(R.string.vote_submitted_success + '\n\n(Actual submission will be implemented on Day 3)');

  // Simulate "has_voted" state
  currentElection.has_voted = true;
  displayElection(currentElection);
}

/**
 * Show loading state
 */
function showLoading() {
  document.getElementById('election-loading').classList.remove('u-hidden');
  document.getElementById('election-error').classList.add('u-hidden');
  document.getElementById('election-content').classList.add('u-hidden');
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
  document.getElementById('election-content').classList.add('u-hidden');

  // Retry button
  const retryButton = document.getElementById('retry-button');
  retryButton.onclick = () => {
    const electionId = getElectionIdFromURL();
    if (electionId) {
      loadElection(electionId);
    }
  };
}

/**
 * Format date for display
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
