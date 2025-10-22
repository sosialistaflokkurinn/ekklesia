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
import { R } from '../i18n/strings-loader.js';
import { getElectionById, submitVote, getResults } from './api/elections-api.js';
import { auth } from './auth.js';

// State
let currentElection = null;
let pendingAnswer = null;

/**
 * Initialize election detail page
 */
async function init() {
  try {
    // Load i18n strings
    await R.load('is');

    // Initialize authenticated page
    await initAuthenticatedPage();

    // Get election ID from URL
    const params = new URLSearchParams(window.location.search);
    const electionId = params.get('id');

    if (!electionId) {
      showError('Engin kosning er valin');
      return;
    }

    // Load election
    await loadElection(electionId);

  } catch (error) {
    console.error('Error initializing election detail page:', error);
    showError(R.string.error_generic || 'Villa við að hlaða kosningum');
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

    document.title = `${election.title} - Sósíalistaflokkurinn`;

    // Display election
    displayElection(election);

    hideLoading();

  } catch (error) {
    console.error('Error loading election:', error);
    showError(R.string.error_generic || 'Villa við að hlaða kosningum');
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
  const statusText = election.status === 'active' ? 'Virk' : election.status === 'upcoming' ? 'Væntanleg' : 'Lokuð';
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
    console.error('Error submitting vote:', error);
    showError(R.string.error_generic || 'Villa við að skrá atkvæði');
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
        <span class="results__votes">${answer.count} atkvæði</span>
      `;

      resultsContainer.appendChild(resultItem);
    });

    document.getElementById('results-section').classList.remove('u-hidden');

  } catch (error) {
    console.error('Error loading results:', error);
    showError(R.string.error_generic || 'Villa við að hlaða niðurstöðum');
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
 * Utility: Escape HTML to prevent XSS
 */
function escapeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
