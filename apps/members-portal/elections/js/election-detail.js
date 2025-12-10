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
import { debug } from '../../js/utils/util-debug.js';
import { formatDateIcelandic } from '../../js/utils/util-format.js';
import { R } from '../i18n/strings-loader.js';
import { getElectionById } from '../../js/api/api-elections.js';
import { escapeHTML } from '../../js/utils/util-format.js';
import { showModal } from '../../js/components/ui-modal.js';
import { electionState } from '../../js/utils/election-state.js';
import { createScheduleDisplay } from '../../js/components/election-schedule-display.js';
import { createVotingForm } from '../../js/components/election-vote-form.js';
import { createRankedVotingForm } from '../../js/components/election-ranked-vote-form.js';
import { createButton } from '../../js/components/ui-button.js';
import { setTextContentOptional, showElement, hideElement } from '../../ui/dom.js';

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
    
    // Translate elements with data-i18n attributes
    R.translatePage();

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
    // Handle auth redirect
    if (error.name === 'AuthenticationError') {
      window.location.href = error.redirectTo || '/';
      return;
    }

    debug.error('Error initializing election detail page:', error);
    showError(R.string.error_load_election);
  }
}

/**
 * Update all static text elements with i18n strings
 * Uses safe helpers that won't crash if elements are missing
 */
function updateStaticText() {
  setTextContentOptional('back-text', R.string.back_to_elections);
  setTextContentOptional('loading-message', R.string.loading_election);
  setTextContentOptional('error-message', R.string.error_load_election);
  setTextContentOptional('results-title', R.string.results_title);
  setTextContentOptional('results-total-votes-label', R.string.results_total_votes);
  setTextContentOptional('voted-badge-text', R.string.election_already_voted);
  setTextContentOptional('upcoming-message', R.string.election_upcoming_message);

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
 * Note: Status is already normalized by API layer (published → active)
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
 * Supports single-choice, multi-choice, and ranked-choice (STV) elections
 */
async function displayVotingSection(election) {
  const container = document.getElementById('voting-form-container');

  // Clear previous form if it exists
  if (votingForm) {
    votingForm.destroy();
    votingForm = null;
  }

  // Check if ranked-choice (STV) election
  if (election.voting_type === 'ranked-choice') {
    try {
      // Create ranked voting form (async because it loads SortableJS)
      votingForm = await createRankedVotingForm({
        question: election.question,
        candidates: election.answers,
        seatsToFill: election.seats_to_fill || 1,

        // Handle ranked vote submission
        onSubmit: (rankedIds) => {
          showRankedConfirmationModal(rankedIds);
        }
      });

      // Add to page
      container.appendChild(votingForm.element);
    } catch (error) {
      debug.error('Error creating ranked voting form:', error);
      container.innerHTML = '<p class="error">Villa við að hlaða röðunarviðmót.</p>';
    }
    return;
  }

  // Standard single-choice or multi-choice voting form
  votingForm = createVotingForm({
    question: election.question,
    answers: election.answers,
    allowMultiple: election.voting_type === 'multi-choice',
    maxSelections: election.max_selections,
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
    const { getResults } = await import('../../js/api/api-elections.js');
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
    currentElection.answers.find(a => {
      const aId = a.id || a.answer_id || (typeof a === 'string' ? a : a.text || a.answer_text);
      return aId === id;
    })
  ).filter(Boolean);

  if (selectedAnswers.length === 0) {
    return;
  }

  // Create selected answer display (single or multiple)
  let selectedAnswerHtml;
  if (selectedAnswers.length === 1) {
    const answerText = selectedAnswers[0].text || selectedAnswers[0].answer_text || '';
    selectedAnswerHtml = `
      <p class="modal__selected-answer">
        <strong>${R.string.your_answer}:</strong> ${escapeHTML(answerText)}
      </p>
    `;
  } else {
    const answersList = selectedAnswers.map(a =>
      `<li>${escapeHTML(a.text || a.answer_text || '')}</li>`
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
 * Submit vote to backend API
 * @param {Array<string>} answerIds - Selected answer ID(s)
 */
async function submitVote(answerIds) {
  debug.log('Submitting vote: Election ' + currentElection.id + ', Answers ' + answerIds.join(', '));

  try {
    // Import API function
    const { submitVote: submitVoteAPI } = await import('../../js/api/api-elections.js');

    // Submit vote to backend
    const response = await submitVoteAPI(currentElection.id, answerIds);

    // Show success message
    alert(R.string.vote_submitted_success);

    // Update local state
    currentElection.has_voted = true;
    displayElection(currentElection);

  } catch (error) {
    debug.error('Vote submission failed:', error);

    // Check if it's a duplicate vote error
    if (error.message && error.message.includes('already voted')) {
      alert(R.string.error_already_voted || 'Þú hefur þegar kosið í þessari kosningu.');
    } else {
      alert(R.string.error_submit_vote || 'Villa kom upp við að skila inn atkvæði. Vinsamlegast reyndu aftur.');
    }
  }
}

/**
 * Show confirmation modal for ranked-choice vote
 * @param {Array<string>} rankedIds - Ordered array of candidate IDs
 */
function showRankedConfirmationModal(rankedIds) {
  if (!rankedIds || rankedIds.length === 0) {
    return;
  }

  // Get ranked candidate objects
  const rankedCandidates = rankedIds.map(id =>
    currentElection.answers.find(a => {
      const aId = a.id || (typeof a === 'string' ? a : a.text);
      return aId === id;
    })
  ).filter(Boolean);

  if (rankedCandidates.length === 0) {
    return;
  }

  // Create ranked list display
  const rankingList = rankedCandidates.map((c, index) => {
    const text = c.text || c.answer_text || c.id || '';
    return `<li><strong>${index + 1}. val:</strong> ${escapeHTML(text)}</li>`;
  }).join('');

  const content = `
    <p>Þú ert að fara að skila eftirfarandi forgangsröðun:</p>
    <ol class="modal__ranking-list" style="margin: 1rem 0; padding-left: 1.5rem;">
      ${rankingList}
    </ol>
    <p><em>Athugið: Ekki er hægt að breyta atkvæði eftir að það hefur verið skilað.</em></p>
  `;

  const modal = showModal({
    title: 'Staðfesta forgangsröðun',
    content: content,
    buttons: [
      {
        text: R.string.btn_cancel || 'Hætta við',
        onClick: () => modal.close(),
        primary: false
      },
      {
        text: 'Skila forgangsröðun',
        onClick: () => {
          modal.close();
          submitRankedVote(rankedIds);
        },
        primary: true
      }
    ],
    size: 'md'
  });
}

/**
 * Submit ranked vote to backend API
 * @param {Array<string>} rankedIds - Ordered array of candidate IDs (1st preference first)
 */
async function submitRankedVote(rankedIds) {
  debug.log('Submitting ranked vote: Election ' + currentElection.id + ', Ranking: ' + rankedIds.join(' > '));

  try {
    // Import API function
    const { submitRankedVote: submitRankedVoteAPI } = await import('../../js/api/api-elections.js');

    // Show loading state on form
    if (votingForm && votingForm.showLoading) {
      votingForm.showLoading();
    }

    // Submit ranked vote to backend
    const response = await submitRankedVoteAPI(currentElection.id, rankedIds);

    // Show success message
    alert(R.string.ranked_vote_success || 'Forgangsröðun þín hefur verið skráð!');

    // Update local state
    currentElection.has_voted = true;
    displayElection(currentElection);

  } catch (error) {
    debug.error('Ranked vote submission failed:', error);

    // Hide loading state
    if (votingForm && votingForm.hideLoading) {
      votingForm.hideLoading();
    }

    // Check if it's a duplicate vote error
    if (error.message && error.message.includes('already voted')) {
      alert(R.string.error_already_voted || 'Þú hefur þegar kosið í þessari kosningu.');
    } else {
      alert(R.string.error_submit_vote || 'Villa kom upp við að skila inn forgangsröðun. Vinsamlegast reyndu aftur.');
    }
  }
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
