/**
 * Uppstillingarnefnd Vote Page Logic
 * Two-step voting: 1) Ranking, 2) Justifications
 * @module uppstilling/vote
 */

import { getFirebaseAuth } from '../../../firebase/app.js';
import { getNominationElection, submitNominationVote } from '../../../js/api/api-nomination.js';
import { createRankedVotingForm } from '../../../js/components/election-ranked-vote-form.js';
import { debug } from '../../../js/utils/util-debug.js';
import { el } from '../../../js/utils/util-dom.js';
import { escapeHTML } from '../../../js/utils/util-format.js';

// =====================================================
// Constants
// =====================================================

const MODULE = 'uppstilling-vote';
const STORAGE_PREFIX = 'uppstilling_draft_';
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const AUTO_SAVE_INTERVAL_MS = 5000; // 5 seconds
const MIN_JUSTIFICATION_LENGTH = 30;

// =====================================================
// DOM Elements
// =====================================================

const electionTitle = document.getElementById('election-title');
const electionInfo = document.getElementById('election-info');
const loadingCard = document.getElementById('loading-card');
const errorCard = document.getElementById('error-card');
const alreadyVotedCard = document.getElementById('already-voted-card');
const votingContainer = document.getElementById('voting-container');
const step1Card = document.getElementById('step1-card');
const step2Card = document.getElementById('step2-card');
const successCard = document.getElementById('success-card');
const rankingFormContainer = document.getElementById('ranking-form-container');
const justificationsContainer = document.getElementById('justifications-container');
const errorMessage = document.getElementById('error-message');

// Step indicators
const step1Indicator = document.getElementById('step1-indicator');
const step2Indicator = document.getElementById('step2-indicator');

// Buttons
const nextStepBtn = document.getElementById('next-step-btn');
const prevStepBtn = document.getElementById('prev-step-btn');
const submitVoteBtn = document.getElementById('submit-vote-btn');
const viewResultsBtn = document.getElementById('view-results-btn');

// =====================================================
// State
// =====================================================

let election = null;
let rankedForm = null;
let currentRanking = [];
let justificationsRequired = 3;

// =====================================================
// LocalStorage Draft Functions
// =====================================================

/**
 * Get storage key for current election
 * @returns {string} Storage key
 */
function getStorageKey() {
  const urlParams = new URLSearchParams(window.location.search);
  const electionId = urlParams.get('id');
  return `${STORAGE_PREFIX}${electionId}`;
}

/**
 * Save draft to localStorage
 */
function saveDraft() {
  if (!election) return;

  const draft = {
    ranking: currentRanking,
    justifications: {},
    savedAt: Date.now()
  };

  // Collect justification texts
  const textareas = justificationsContainer.querySelectorAll('textarea');
  textareas.forEach(textarea => {
    const candidateId = textarea.dataset.candidateId;
    const value = textarea.value;
    if (value) {
      draft.justifications[candidateId] = value;
    }
  });

  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(draft));
    debug(MODULE, 'Draft saved');
  } catch (e) {
    debug(MODULE, 'Could not save draft:', e);
  }
}

/**
 * Load draft from localStorage
 * @returns {Object|null} Draft data or null
 */
function loadDraft() {
  try {
    const data = localStorage.getItem(getStorageKey());
    if (data) {
      const draft = JSON.parse(data);
      // Only use drafts less than 24 hours old
      if (draft.savedAt && (Date.now() - draft.savedAt) < DRAFT_MAX_AGE_MS) {
        debug(MODULE, 'Draft loaded');
        return draft;
      }
    }
  } catch (e) {
    debug(MODULE, 'Could not load draft:', e);
  }
  return null;
}

/**
 * Clear draft from localStorage
 */
function clearDraft() {
  try {
    localStorage.removeItem(getStorageKey());
    debug(MODULE, 'Draft cleared');
  } catch (e) {
    debug(MODULE, 'Could not clear draft:', e);
  }
}

// =====================================================
// Initialization
// =====================================================

/**
 * Initialize page
 */
async function init() {
  try {
    // Get election ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const electionId = urlParams.get('id');

    if (!electionId) {
      showError('Kosningar ID vantar í slóð');
      return;
    }

    // Wait for auth
    const auth = getFirebaseAuth();
    await new Promise((resolve, reject) => {
      const unsubscribe = auth.onAuthStateChanged(user => {
        unsubscribe();
        if (user) {
          resolve(user);
        } else {
          reject(new Error('Notandi er ekki innskráður'));
        }
      });
    });

    // Load election
    await loadElection(electionId);

    // Setup event listeners
    setupEventListeners();
  } catch (error) {
    debug(MODULE, 'Init error:', error);
    showError(error.message || 'Villa kom upp');
  }
}

/**
 * Load election data
 * @param {string} electionId - Election UUID
 */
async function loadElection(electionId) {
  try {
    const result = await getNominationElection(electionId);
    election = result.election;

    hideLoading();

    // Update header
    electionTitle.textContent = election.title;
    electionInfo.textContent = `Umferð ${election.round_number || 1}`;

    // Update results link
    viewResultsBtn.href = `results.html?id=${electionId}`;

    // Check if already voted
    if (election.has_voted) {
      showAlreadyVoted(result.previous_vote);
      return;
    }

    // Check if election is open for voting
    if (election.status !== 'published') {
      showError('Þessi kosning er ekki opin fyrir atkvæðagreiðslu');
      return;
    }

    // Setup voting form
    justificationsRequired = election.justification_required_for_top_n || 3;
    await setupVotingForm();

    votingContainer.style.display = 'block';
  } catch (error) {
    debug(MODULE, 'Load election error:', error);
    showError(error.message || 'Villa við að sækja kosningu');
  }
}

// =====================================================
// Form Setup
// =====================================================

/**
 * Setup the ranked voting form
 */
async function setupVotingForm() {
  // Check for saved draft with ranking
  const draft = loadDraft();
  let candidates;

  if (draft && draft.ranking && draft.ranking.length > 0) {
    // Use saved ranking order
    debug(MODULE, 'Restoring ranking from draft');
    candidates = draft.ranking.map(id => {
      const answer = election.answers.find(a => (a.id || a.text) === id);
      return {
        id: id,
        text: answer ? (answer.text || answer.id) : id,
      };
    });
    // Add any candidates that might be missing from the draft
    election.answers.forEach(a => {
      const id = a.id || a.text;
      if (!candidates.find(c => c.id === id)) {
        candidates.push({ id, text: a.text || a.id });
      }
    });
  } else {
    // Shuffle for random initial order
    candidates = shuffleArray(election.answers.map(a => ({
      id: a.id || a.text,
      text: a.text || a.id,
    })));
  }

  try {
    rankedForm = await createRankedVotingForm({
      question: election.question,
      candidates: candidates,
      seatsToFill: election.seats_to_fill || candidates.length,
      onSubmit: () => {
        // Not used - we handle step navigation manually
      },
    });

    rankingFormContainer.appendChild(rankedForm.element);
    nextStepBtn.disabled = false;
  } catch (error) {
    debug(MODULE, 'Setup form error:', error);
    showError('Villa við að setja upp atkvæðagreiðsluform');
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  nextStepBtn.addEventListener('click', goToStep2);
  prevStepBtn.addEventListener('click', goToStep1);
  submitVoteBtn.addEventListener('click', submitVote);

  // Save draft before page unload
  window.addEventListener('beforeunload', () => {
    if (rankedForm) {
      currentRanking = rankedForm.getRanking();
      saveDraft();
    }
  });

  // Auto-save periodically while on step 1
  setInterval(() => {
    if (rankedForm && step1Card.style.display !== 'none') {
      currentRanking = rankedForm.getRanking();
      saveDraft();
    }
  }, AUTO_SAVE_INTERVAL_MS);
}

// =====================================================
// Step Navigation
// =====================================================

/**
 * Go to step 2 (justifications)
 */
function goToStep2() {
  if (!rankedForm) return;

  currentRanking = rankedForm.getRanking();

  if (currentRanking.length === 0) {
    alert('Þú verður að raða frambjóðendum áður en þú heldur áfram');
    return;
  }

  createJustificationFields();
  saveDraft();

  // Update step indicators
  step1Indicator.classList.remove('step-indicator__step--active');
  step1Indicator.classList.add('step-indicator__step--completed');
  step2Indicator.classList.add('step-indicator__step--active');

  // Show/hide cards
  step1Card.style.display = 'none';
  step2Card.style.display = 'block';
}

/**
 * Go back to step 1 (ranking)
 */
function goToStep1() {
  // Update step indicators
  step2Indicator.classList.remove('step-indicator__step--active');
  step1Indicator.classList.remove('step-indicator__step--completed');
  step1Indicator.classList.add('step-indicator__step--active');

  // Show/hide cards
  step2Card.style.display = 'none';
  step1Card.style.display = 'block';
}

// =====================================================
// Justification Fields
// =====================================================

/**
 * Create justification fields for top N candidates
 */
function createJustificationFields() {
  justificationsContainer.innerHTML = '';

  const topCandidates = currentRanking.slice(0, justificationsRequired);
  const draft = loadDraft();

  topCandidates.forEach((candidateId, index) => {
    const candidate = election.answers.find(a => (a.id || a.text) === candidateId);
    const candidateName = candidate ? (candidate.text || candidate.id) : candidateId;
    const savedText = draft?.justifications?.[candidateId] || '';
    const rank = index + 1;

    // Create field using el() helper
    const field = el('div', 'justification-field', { id: `justification-field-${index}` },
      el('div', 'justification-field__header', {},
        el('span', 'justification-field__rank', {}, rank.toString()),
        el('span', 'justification-field__name', {}, candidateName)
      ),
      el('textarea', 'justification-field__textarea', {
        id: `justification-${candidateId}`,
        'data-candidate-id': candidateId,
        placeholder: `Rökstyðjið af hverju þessi frambjóðandi ætti að vera í ${rank}. sæti...`,
        minlength: MIN_JUSTIFICATION_LENGTH.toString(),
        required: 'required',
        oninput: saveDraft
      }, savedText),
      el('div', 'justification-field__hint', {}, `Að minnsta kosti ${MIN_JUSTIFICATION_LENGTH} stafir`),
      el('div', 'justification-field__error', {}, `Rökstuðningur er of stuttur (að minnsta kosti ${MIN_JUSTIFICATION_LENGTH} stafir)`)
    );

    justificationsContainer.appendChild(field);
  });
}

/**
 * Collect and validate justifications from form
 * @returns {Object|null} Justifications object or null if validation fails
 */
function collectJustifications() {
  const justifications = {};
  let valid = true;

  const textareas = justificationsContainer.querySelectorAll('textarea');

  textareas.forEach(textarea => {
    const candidateId = textarea.dataset.candidateId;
    const value = textarea.value.trim();
    const field = textarea.closest('.justification-field');

    if (value.length < MIN_JUSTIFICATION_LENGTH) {
      field.classList.add('justification-field--error');
      valid = false;
    } else {
      field.classList.remove('justification-field--error');
      justifications[candidateId] = value;
    }
  });

  return valid ? justifications : null;
}

// =====================================================
// Vote Submission
// =====================================================

/**
 * Submit vote to API
 */
async function submitVote() {
  const justifications = collectJustifications();

  if (!justifications) {
    return;
  }

  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  const voterName = user?.displayName || user?.email || 'Unknown';

  // Prevent double submit
  submitVoteBtn.disabled = true;
  submitVoteBtn.textContent = 'Sendir...';

  try {
    await submitNominationVote(election.id, {
      ranked_answers: currentRanking,
      justifications: justifications,
      voter_name: voterName,
    });

    clearDraft();
    votingContainer.style.display = 'none';
    showSuccessCard();

    debug(MODULE, 'Vote submitted successfully');
  } catch (error) {
    debug(MODULE, 'Submit error:', error);

    submitVoteBtn.disabled = false;
    submitVoteBtn.textContent = 'Skrá atkvæði';

    alert(error.message || 'Villa við að skrá atkvæði');
  }
}

// =====================================================
// UI State Functions
// =====================================================

/**
 * Show success card after vote submission
 */
function showSuccessCard() {
  const committeeSize = Array.isArray(election.committee_member_uids)
    ? election.committee_member_uids.length
    : 0;
  const votesCast = (parseInt(election.votes_cast) || 0) + 1;
  const allVoted = votesCast >= committeeSize;

  debug(MODULE, 'Success card', { committeeSize, votesCast, allVoted });

  const successCardContent = successCard.querySelector('p');
  const formActions = successCard.querySelector('.form-actions');

  if (allVoted) {
    successCardContent.textContent = 'Atkvæði þitt hefur verið skráð. Allir nefndarmenn hafa nú kosið.';
    formActions.innerHTML = '';
    formActions.appendChild(
      el('a', 'btn btn--primary', { href: `results.html?id=${election.id}` }, 'Skoða niðurstöður')
    );
    formActions.appendChild(
      el('a', 'btn btn--secondary', { href: 'index.html' }, 'Til baka')
    );
  } else {
    const remaining = committeeSize - votesCast;
    const suffix = remaining === 1 ? 'ður' : 'enn';
    successCardContent.textContent = `Atkvæði þitt hefur verið skráð. ${remaining} nefndarma${suffix} á eftir að kjósa.`;
    formActions.innerHTML = '';
    formActions.appendChild(
      el('a', 'btn btn--primary', { href: 'index.html' }, 'Til baka')
    );
  }

  successCard.style.display = 'block';
}

/**
 * Show already voted state
 * @param {Object} previousVote - Previous vote data
 */
function showAlreadyVoted(previousVote) {
  const display = document.getElementById('previous-vote-display');

  if (previousVote && previousVote.ranked_answers) {
    const ranking = previousVote.ranked_answers;
    display.innerHTML = '<strong>Þín röðun:</strong>';
    ranking.forEach((candidateId, index) => {
      const candidate = election.answers.find(a => (a.id || a.text) === candidateId);
      const name = candidate ? (candidate.text || candidate.id) : candidateId;
      display.appendChild(el('div', '', {}, `${index + 1}. ${name}`));
    });
  }

  // Check if all committee members have voted
  const committeeSize = Array.isArray(election.committee_member_uids)
    ? election.committee_member_uids.length
    : 0;
  const votesCast = parseInt(election.votes_cast) || 0;
  const allVoted = votesCast >= committeeSize;

  if (allVoted) {
    viewResultsBtn.style.display = '';
  } else {
    const remaining = committeeSize - votesCast;
    const suffix = remaining === 1 ? 'ður' : 'enn';
    viewResultsBtn.style.display = 'none';

    const infoEl = el('p', 'voting-status-info', {},
      `${remaining} nefndarma${suffix} á eftir að kjósa. Niðurstöður birtast þegar allir hafa kosið.`
    );
    alreadyVotedCard.insertBefore(infoEl, viewResultsBtn);
  }

  alreadyVotedCard.style.display = 'block';
}

/**
 * Hide loading state
 */
function hideLoading() {
  loadingCard.style.display = 'none';
}

/**
 * Show error state
 * @param {string} message - Error message
 */
function showError(message) {
  hideLoading();
  errorMessage.textContent = message;
  errorCard.style.display = 'block';
}

// =====================================================
// Utility Functions
// =====================================================

/**
 * Fisher-Yates shuffle algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array (new copy)
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// =====================================================
// Initialize
// =====================================================

init();
