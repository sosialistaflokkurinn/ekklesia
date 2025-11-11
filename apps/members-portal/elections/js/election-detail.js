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

import { initAuthenticatedPage } from '../../js/page-init.js';
import { debug } from '../../js/utils/debug.js';
import { formatDateIcelandic } from '../../js/utils/format.js';
import { R } from '../i18n/strings-loader.js';
import { getElectionById } from '../../js/api/elections-api.js';
import { escapeHTML } from '../../js/utils/format.js';
import { showModal } from '../../js/components/modal.js';
import { electionState } from '../../js/utils/election-state.js';
import { createScheduleDisplay } from '../../js/components/schedule-display.js';
import { createVotingForm } from '../../js/components/voting-form.js';
import { createButton } from '../../js/components/button.js';

// State
let currentElection = null;
let scheduleDisplay = null;

// Button instances
let retryButton = null;
let votingForm = null;

/**
 * Initialize election detail page
 */
async function init() {
  try {
    // Load i18n strings
    await R.load('is');

    // Initialize authenticated page (header, navigation, auth check)
    await initAuthenticatedPage();

    // Update voting navigation link if it exists
    const navVoting = document.getElementById('nav-voting');
    if (navVoting) {
      navVoting.textContent = R.string.nav_voting;
    }

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
  document.getElementById('results-title').textContent = R.string.results_title;
  document.getElementById('results-total-votes-label').textContent = R.string.results_total_votes;
  document.getElementById('voted-badge-text').textContent = R.string.election_already_voted;
  document.getElementById('upcoming-message').textContent = R.string.election_upcoming_message;

  // Note: schedule labels and voting form labels are now handled by components
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
  // Map backend status to frontend status
  // Backend uses 'published', frontend expects 'active'
  if (election.status === 'published') {
    election.status = 'active';
  }

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

  // Initialize election state
  electionState.initialize(election);

  // Create schedule display component
  if (!scheduleDisplay) {
    scheduleDisplay = createScheduleDisplay({
      startLabel: R.string.election_starts,
      endLabel: R.string.election_ends,
      showCountdown: true
    });

    const container = document.getElementById('schedule-display-container');
    container.appendChild(scheduleDisplay.element);
  }

  // Description (if available)
  if (election.description) {
    const descSection = document.getElementById('election-description-section');
    const descContainer = document.getElementById('election-description');
    descContainer.innerHTML = '<p>' + escapeHTML(election.description) + '</p>';
    descSection.style.display = 'block';
  }

  // Note: Question is now displayed inside voting-form component

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
  const container = document.getElementById('voting-form-container');

  // Clear previous form if it exists
  if (votingForm) {
    votingForm.destroy();
    votingForm = null;
  }

  // Create voting form component
  votingForm = createVotingForm({
    question: election.question,
    answers: election.answers,
    questionLabel: R.string.election_question_label,
    votingTitle: R.string.voting_select_answer,
    voteButtonText: R.string.btn_vote,

    // Handle vote submission
    onSubmit: (answerIds) => {
      showConfirmationModal(answerIds);
    }
  });

  // Add to page
  container.appendChild(votingForm.element);
}

/**
 * Display results section (for closed elections)
 */
async function displayResultsSection(election) {
  const resultsSection = document.getElementById('results-section');
  const resultsList = document.getElementById('results-list');
  const totalVotesEl = document.getElementById('results-total-votes');

  try {
    // Fetch results from API
    const { getResults } = await import('../../js/api/elections-api.js');
    const results = await getResults(election.id);

    // Display total votes
    if (totalVotesEl && results.total_votes !== undefined) {
      totalVotesEl.textContent = results.total_votes;
    }

    // Clear previous results
    resultsList.innerHTML = '';

    // Check if we have results
    if (!results.results || results.results.length === 0) {
      resultsList.innerHTML = `<p class="election-results__empty">${R.string.results_not_available}</p>`;
      resultsSection.classList.remove('u-hidden');
      return;
    }

    // Find winner (most votes)
    const winner = results.results.reduce((max, current) =>
      current.votes > max.votes ? current : max
    );

    // Create result items
    results.results.forEach(result => {
      const resultItem = document.createElement('div');
      resultItem.className = 'election-results__item';

      const isWinner = result.answer_id === winner.answer_id && result.votes > 0;
      if (isWinner) {
        resultItem.classList.add('election-results__item--winner');
      }

      // Determine bar color class based on answer
      let barClass = 'election-results__bar';
      const answerText = result.text || result.answer_text || '';  // Support both field names
      const answerLower = answerText.toLowerCase();
      if (answerLower.includes('já') || answerLower.includes('yes') || answerLower.includes('samþykki')) {
        barClass += ' election-results__bar--yes';
      } else if (answerLower.includes('nei') || answerLower.includes('no') || answerLower.includes('hafna')) {
        barClass += ' election-results__bar--no';
      } else {
        barClass += ' election-results__bar--neutral';
      }

      resultItem.innerHTML = `
        <div class="election-results__answer">
          ${isWinner ? '<span class="election-results__winner-badge">✓</span>' : ''}
          <span class="election-results__answer-text">${escapeHTML(answerText)}</span>
        </div>
        <div class="election-results__stats">
          <div class="election-results__percentage">${result.percentage.toFixed(1)}%</div>
          <div class="election-results__bar-container">
            <div class="${barClass}" style="width: ${result.percentage}%"></div>
          </div>
          <div class="election-results__votes">${result.votes} ${result.votes === 1 ? 'atkvæði' : 'atkvæði'}</div>
        </div>
      `;

      resultsList.appendChild(resultItem);
    });

    resultsSection.classList.remove('u-hidden');

  } catch (error) {
    debug.error('Error loading results:', error);
    resultsList.innerHTML = `<p class="election-results__error">${R.string.results_error}</p>`;
    resultsSection.classList.remove('u-hidden');
  }
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
  const container = document.getElementById('voting-form-container');
  container.innerHTML = '<div class="election-detail__already-voted"><p>' + R.string.election_already_voted_message + '</p></div>';
}

/**
 * Show confirmation modal before submitting vote
 * @param {Array<string>} answerIds - Selected answer ID(s)
 */
function showConfirmationModal(answerIds) {
  // Validate that we have at least one selected answer
  if (!answerIds || answerIds.length === 0) {
    return;
  }

  // Get selected answer objects
  const selectedAnswers = answerIds.map(id =>
    currentElection.answers.find(a => a.id === id)
  ).filter(Boolean);

  if (selectedAnswers.length === 0) {
    return;
  }

  // Create selected answer display (single or multiple)
  let selectedAnswerHtml;
  if (selectedAnswers.length === 1) {
    selectedAnswerHtml = `
      <p class="modal__selected-answer">
        <strong>${R.string.your_answer}:</strong> ${escapeHTML(selectedAnswers[0].text)}
      </p>
    `;
  } else {
    const answersList = selectedAnswers.map(a =>
      `<li>${escapeHTML(a.text)}</li>`
    ).join('');
    selectedAnswerHtml = `
      <div class="modal__selected-answers">
        <p><strong>${R.string.your_answer}:</strong></p>
        <ul class="modal__answer-list">
          ${answersList}
        </ul>
      </div>
    `;
  }

  // Build modal content
  const content = `
    <p>${R.string.confirm_vote_message}</p>
    ${selectedAnswerHtml}
  `;

  // Show modal using reusable component
  const modal = showModal({
    title: R.string.confirm_vote_title,
    content: content,
    buttons: [
      {
        text: R.string.btn_cancel,
        onClick: () => modal.close(),
        primary: false
      },
      {
        text: R.string.btn_confirm,
        onClick: () => {
          modal.close();
          submitVote(answerIds);
        },
        primary: true
      }
    ],
    size: 'md'
  });
}

/**
 * Submit vote (placeholder for Day 3)
 * @param {Array<string>} answerIds - Selected answer ID(s)
 */
async function submitVote(answerIds) {
  debug.log('Vote submission (Day 3): Election ' + currentElection.id + ', Answers ' + answerIds.join(', '));

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

  // Create retry button if not exists
  if (!retryButton) {
    retryButton = createButton({
      text: R.string.btn_retry,
      variant: 'primary',
      onClick: () => {
        const electionId = getElectionIdFromURL();
        if (electionId) {
          loadElection(electionId);
        }
      }
    });

    // Append to error container
    const errorContainer = document.getElementById('election-error');
    if (errorContainer) {
      // Find existing button placeholder or append
      const existingButton = document.getElementById('retry-button');
      if (existingButton) {
        existingButton.replaceWith(retryButton.element);
      } else {
        errorContainer.appendChild(retryButton.element);
      }
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
