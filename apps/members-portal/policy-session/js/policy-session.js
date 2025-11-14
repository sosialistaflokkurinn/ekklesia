/**
 * Policy Session Page Controller
 *
 * Manages policy session page state and component integration.
 * Handles phase transitions (discussion → break → voting → results).
 */

import { initAuthenticatedPage } from '../../js/page-init.js';
import { R } from '../i18n/strings-loader.js';
import PolicySessionAPI from './api/policy-session-api-mock.js';
import { createAmendmentForm } from './amendment-form.js';
import { createAmendmentVoteCard } from './amendment-vote-card.js';
import { createPolicyItemVoteCard } from './policy-item-vote-card.js';
import { createVotingForm } from '../../js/components/voting-form.js';
import { createPolicyResultsDisplay } from './policy-results-display.js';
import { showToast } from '../../js/components/toast.js';

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

    // Override nav brand for policy-session page
    document.getElementById('nav-brand').textContent = 'Stefnumótun';

    // Set filter button text
    document.getElementById('filter-discussion-text').textContent = R.string.filter_discussion;
    document.getElementById('filter-break-text').textContent = R.string.filter_break;
    document.getElementById('filter-voting-text').textContent = R.string.filter_voting;
    document.getElementById('filter-closed-text').textContent = R.string.filter_closed;

    // Set static page text
    document.getElementById('discussion-title').textContent = R.string.phase_discussion_title;
    document.getElementById('discussion-message').textContent = R.string.phase_discussion_message;
    document.getElementById('break-title').textContent = R.string.phase_break_title;
    document.getElementById('voting-title').textContent = R.string.phase_voting_title;
    document.getElementById('policy-items-heading').textContent = R.string.policy_items_voting_heading;
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
    currentSession = await PolicySessionAPI.getPolicySession(sessionId);

    // Update page title
    document.getElementById('page-title').textContent = `${currentSession.title} - Policy Session`;
    document.getElementById('session-title').textContent = currentSession.title;

    // Setup phase filters
    setupPhaseFilters(currentSession.status);

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

// Setup phase filter buttons
function setupPhaseFilters(currentPhase) {
  const filterBtns = document.querySelectorAll('.policy-session__filter-btn');
  
  filterBtns.forEach(btn => {
    const phase = btn.getAttribute('data-phase');
    
    // Set active state based on current phase
    if (phase === currentPhase) {
      btn.classList.add('policy-session__filter-btn--active');
    } else {
      btn.classList.remove('policy-session__filter-btn--active');
    }
    
    // Add click handler to switch phases
    btn.addEventListener('click', () => {
      // Update active state
      filterBtns.forEach(b => b.classList.remove('policy-session__filter-btn--active'));
      btn.classList.add('policy-session__filter-btn--active');
      
      // Render selected phase
      renderPhase(phase);
    });
  });
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

  // Render introduction if present
  if (currentSession.policy_draft.introduction) {
    const introEl = document.createElement('div');
    introEl.className = 'policy-session__introduction';
    introEl.innerHTML = `<p>${currentSession.policy_draft.introduction}</p>`;
    draftDisplay.appendChild(introEl);
  }

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
  const policyItemsList = document.getElementById('policy-items-list');
  const amendmentsList = document.getElementById('amendments-list');
  const finalVoteContainer = document.getElementById('final-vote-form-container');

  // Clear previous content
  policyItemsList.innerHTML = '';
  amendmentsList.innerHTML = '';
  finalVoteContainer.innerHTML = '';

  // FIRST: Render policy items vote cards
  if (currentSession.policy_draft && currentSession.policy_draft.sections) {
    currentSession.policy_draft.sections.forEach(item => {
      const itemCard = createPolicyItemVoteCard({
        sessionId: sessionId,
        item: item,
        R: R,
        onVote: async (itemId, vote) => {
          // Call API to vote
          return await PolicySessionAPI.voteOnPolicyItem(sessionId, itemId, vote);
        },
        onVoteSuccess: (data) => {
          console.log('Policy item vote recorded:', data);
        }
      });

      policyItemsList.appendChild(itemCard.element);
      components.push(itemCard);
    });
  }

  // SECOND: Render amendment vote cards
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
    onSubmit: async (selectedAnswers) => {
      try {
        // Extract first answer (single-choice)
        const vote = Array.isArray(selectedAnswers) ? selectedAnswers[0] : selectedAnswers;
        const response = await PolicySessionAPI.voteOnFinalPolicy(sessionId, vote);
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
