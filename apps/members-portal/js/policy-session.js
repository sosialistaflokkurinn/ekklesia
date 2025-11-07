/**
 * Policy Session Page Controller
 *
 * Manages policy session page state and component integration.
 * Handles phase transitions (discussion → break → voting → results).
 */

import { initAuthenticatedPage } from './page-init.js';
import { R } from '../i18n/strings-loader.js';
import { getPolicySession } from './api/elections-api.js';
import { createAmendmentForm } from './components/amendment-form.js';
import { createAmendmentVoteCard } from './components/amendment-vote-card.js';
import { createVotingForm } from './components/voting-form.js';
import { createPolicyResultsDisplay } from './components/policy-results-display.js';
import { voteOnFinalPolicy } from './api/elections-api.js';
import { showToast } from './components/toast.js';

// Get session ID from URL query params
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('id') || 'policy-session-001'; // Default for testing

// State
let currentSession = null;
let components = [];

// Initialize page
async function init() {
  try {
    // Load i18n strings
    await R.load('is');

    // Initialize authenticated page (requires member role)
    await initAuthenticatedPage();

    // Update elections navigation link (page-specific)
    document.getElementById('nav-voting').textContent = R.string.nav_voting;
    
    // Set back link text
    document.getElementById('back-text').textContent = R.string.back_to_elections;

    // Set static page text
    document.getElementById('discussion-title').textContent = R.string.phase_discussion_title;
    document.getElementById('discussion-message').textContent = R.string.phase_discussion_message;
    document.getElementById('break-title').textContent = R.string.phase_break_title;
    document.getElementById('voting-title').textContent = R.string.phase_voting_title;
    document.getElementById('amendments-heading').textContent = R.string.amendments_voting_heading;
    document.getElementById('final-vote-heading').textContent = R.string.final_vote_heading;
    document.getElementById('final-vote-description').textContent = R.string.final_vote_description;
    document.getElementById('results-title').textContent = R.string.results_title;

    // Load policy session
    await loadPolicySession();

  } catch (error) {
    console.error('Initialization error:', error);
    showError(error.message);
  }
}

// Load policy session data
async function loadPolicySession() {
  const loadingEl = document.getElementById('session-loading');
  const errorEl = document.getElementById('session-error');
  const contentEl = document.getElementById('session-content');

  try {
    // Show loading
    loadingEl.classList.remove('u-hidden');
    errorEl.classList.add('u-hidden');
    contentEl.classList.add('u-hidden');

    // Fetch session
    currentSession = await getPolicySession(sessionId);

    // Update page title
    document.getElementById('page-title').textContent = `${currentSession.title} - Policy Session`;
    document.getElementById('session-title').textContent = currentSession.title;

    // Update status badge
    const statusBadge = document.getElementById('session-status-badge');
    statusBadge.textContent = formatStatus(currentSession.status);
    statusBadge.className = `policy-session__status-badge policy-session__status-badge--${currentSession.status}`;

    // Render appropriate phase
    renderPhase(currentSession.status);

    // Show content
    loadingEl.classList.add('u-hidden');
    contentEl.classList.remove('u-hidden');

  } catch (error) {
    console.error('Error loading policy session:', error);
    showError(`Failed to load policy session: ${error.message}`);
  }
}

// Render phase based on session status
function renderPhase(status) {
  // Hide all phases
  document.getElementById('phase-discussion').classList.add('u-hidden');
  document.getElementById('phase-break').classList.add('u-hidden');
  document.getElementById('phase-voting').classList.add('u-hidden');
  document.getElementById('phase-results').classList.add('u-hidden');

  // Show appropriate phase
  switch (status) {
    case 'discussion':
      renderDiscussionPhase();
      break;
    case 'break':
      renderBreakPhase();
      break;
    case 'voting':
      renderVotingPhase();
      break;
    case 'closed':
      renderResultsPhase();
      break;
  }
}

// Render discussion phase
function renderDiscussionPhase() {
  const phaseEl = document.getElementById('phase-discussion');
  const draftDisplay = document.getElementById('policy-draft-display');

  // Clear previous content
  draftDisplay.innerHTML = '';

  // Render policy draft sections
  currentSession.policy_draft.sections.forEach(section => {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'policy-session__policy-section';
    sectionEl.innerHTML = `
      <h4 class="policy-session__policy-section-heading">${section.heading}</h4>
      <p class="policy-session__policy-section-text">${section.text}</p>
    `;
    draftDisplay.appendChild(sectionEl);
  });

  phaseEl.classList.remove('u-hidden');
}

// Render break phase (amendment submission)
function renderBreakPhase() {
  const phaseEl = document.getElementById('phase-break');
  const formContainer = document.getElementById('amendment-form-container');

  // Clear previous content
  formContainer.innerHTML = '';

  // Create amendment form
  const amendmentForm = createAmendmentForm({
    sessionId: sessionId,
    sections: currentSession.policy_draft.sections,
    R: R,
    onSubmitSuccess: (response) => {
      console.log('Amendment submitted:', response);
      // Optionally reload session to show new amendment
      loadPolicySession();
    }
  });

  formContainer.appendChild(amendmentForm.element);
  components.push(amendmentForm);

  phaseEl.classList.remove('u-hidden');
}

// Render voting phase
function renderVotingPhase() {
  const phaseEl = document.getElementById('phase-voting');
  const amendmentsList = document.getElementById('amendments-list');
  const finalVoteContainer = document.getElementById('final-vote-form-container');

  // Clear previous content
  amendmentsList.innerHTML = '';
  finalVoteContainer.innerHTML = '';

  // Render amendment vote cards
  if (currentSession.amendments && currentSession.amendments.length > 0) {
    currentSession.amendments.forEach(amendment => {
      const voteCard = createAmendmentVoteCard({
        sessionId: sessionId,
        amendment: amendment,
        R: R,
        onVoteSuccess: (data) => {
          console.log('Amendment vote recorded:', data);
        }
      });

      amendmentsList.appendChild(voteCard.element);
      components.push(voteCard);
    });
  } else {
    amendmentsList.innerHTML = `<p>${R.string.no_amendments}</p>`;
  }

  // Render final policy vote form
  const votingForm = createVotingForm({
    electionId: sessionId,
    question: currentSession.final_vote.question,
    answers: [
      { id: 'yes', text: R.string.final_vote_yes },
      { id: 'no', text: R.string.final_vote_no },
      { id: 'abstain', text: R.string.final_vote_abstain }
    ],
    hasVoted: currentSession.final_vote.has_voted,
    onSubmit: async (answerId) => {
      try {
        const response = await voteOnFinalPolicy(sessionId, answerId);
        showToast(R.string.vote_success, 'success');
        currentSession.final_vote.has_voted = true;
        return response;
      } catch (error) {
        showToast(`${R.string.vote_error}: ${error.message}`, 'error');
        throw error;
      }
    }
  });

  finalVoteContainer.appendChild(votingForm.element);
  components.push(votingForm);

  phaseEl.classList.remove('u-hidden');
}

// Render results phase
function renderResultsPhase() {
  const phaseEl = document.getElementById('phase-results');
  const resultsContainer = document.getElementById('results-display-container');

  // Clear previous content
  resultsContainer.innerHTML = '';

  // Create results display
  const resultsDisplay = createPolicyResultsDisplay({
    sessionId: sessionId,
    R: R,
    pollInterval: 3000,
    onError: (error) => {
      console.error('Results polling error:', error);
    }
  });

  resultsContainer.appendChild(resultsDisplay.element);
  components.push(resultsDisplay);

  // Start polling for updates
  resultsDisplay.startPolling();

  phaseEl.classList.remove('u-hidden');
}

// Format status for display
function formatStatus(status) {
  const statusMap = {
    'discussion': 'Discussion',
    'break': 'Break Period',
    'voting': 'Voting',
    'closed': 'Closed'
  };
  return statusMap[status] || status;
}

// Show error state
function showError(message) {
  const loadingEl = document.getElementById('session-loading');
  const errorEl = document.getElementById('session-error');
  const contentEl = document.getElementById('session-content');

  loadingEl.classList.add('u-hidden');
  contentEl.classList.add('u-hidden');
  errorEl.classList.remove('u-hidden');

  document.getElementById('error-message').textContent = message;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  components.forEach(component => {
    if (component.destroy) {
      component.destroy();
    }
  });
});

// Start initialization
init();
