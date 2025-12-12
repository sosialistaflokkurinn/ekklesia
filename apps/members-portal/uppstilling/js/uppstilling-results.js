/**
 * Uppstillingarnefnd Results Page Logic
 * Displays non-anonymous voting results with full voter identity.
 */

import { getFirebaseAuth } from '../../../firebase/app.js';
import { requireAuth } from '../../../js/auth.js';
import { getNominationResults } from '../../../js/api/api-nomination.js';
import { debug } from '../../../js/utils/util-debug.js';
import { escapeHTML } from '../../../js/utils/util-format.js';

// DOM Elements
const electionTitle = document.getElementById('election-title');
const electionInfo = document.getElementById('election-info');
const loadingCard = document.getElementById('loading-card');
const errorCard = document.getElementById('error-card');
const resultsContainer = document.getElementById('results-container');
const errorMessage = document.getElementById('error-message');

// Summary stats
const votesCastEl = document.getElementById('votes-cast');
const committeeSizeEl = document.getElementById('committee-size');
const seatsToFillEl = document.getElementById('seats-to-fill');

// Results sections
const averageRankingsEl = document.getElementById('average-rankings');
const stvWinnersCard = document.getElementById('stv-winners-card');
const stvWinnersEl = document.getElementById('stv-winners');
const individualVotesEl = document.getElementById('individual-votes');

// State
let results = null;

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

    // Wait for auth - redirects to login if not authenticated
    await requireAuth();

    // Load results
    await loadResults(electionId);
  } catch (error) {
    debug.error('[Results] Init error:', error);
    showError(error.message || 'Villa kom upp');
  }
}

/**
 * Load results data
 * @param {string} electionId - Election UUID
 */
async function loadResults(electionId) {
  try {
    results = await getNominationResults(electionId);

    hideLoading();

    // Update header
    electionTitle.textContent = results.title;
    electionInfo.textContent = `Umferð ${results.round_number || 1} - ${getStatusText(results.status)}`;

    // Update summary stats
    votesCastEl.textContent = results.votes_cast || 0;
    committeeSizeEl.textContent = results.committee_size || 0;
    seatsToFillEl.textContent = results.seats_to_fill || '-';

    // Render sections
    renderAverageRankings();
    renderSTVWinners();
    renderIndividualVotes();

    resultsContainer.style.display = 'block';
  } catch (error) {
    debug.error('[Results] Load results error:', error);
    showError(error.message || 'Villa við að sækja niðurstöður');
  }
}

/**
 * Render average rankings table
 */
function renderAverageRankings() {
  if (!results.average_rankings || results.average_rankings.length === 0) {
    averageRankingsEl.innerHTML = '<p class="empty-state">Engin atkvæði skráð</p>';
    return;
  }

  averageRankingsEl.innerHTML = results.average_rankings.map((ranking, index) => `
    <div class="ranking-row">
      <span class="ranking-row__position">#${index + 1}</span>
      <span class="ranking-row__name">${escapeHTML(ranking.candidate_name || ranking.candidate_id)}</span>
      <span class="ranking-row__score">${ranking.average_rank}</span>
      <span class="ranking-row__first-votes">(${ranking.first_place_votes} fyrstu val)</span>
    </div>
  `).join('');
}

/**
 * Render STV winners (if applicable)
 */
function renderSTVWinners() {
  if (!results.stv_results || !results.stv_results.winners || results.stv_results.winners.length === 0) {
    stvWinnersCard.style.display = 'none';
    return;
  }

  stvWinnersCard.style.display = 'block';

  const winnersHtml = results.stv_results.winners.map(winnerId => {
    const candidate = results.candidates?.find(c => (c.id || c.text) === winnerId);
    const name = candidate ? (candidate.text || candidate.id) : winnerId;
    return `
      <div class="winner-item">
        <span class="winner-item__icon">🏆</span>
        <span class="winner-item__name">${escapeHTML(name)}</span>
      </div>
    `;
  }).join('');

  stvWinnersEl.innerHTML = winnersHtml;
}

/**
 * Render individual votes with voter names
 */
function renderIndividualVotes() {
  if (!results.votes || results.votes.length === 0) {
    individualVotesEl.innerHTML = '<p class="empty-state">Engin atkvæði skráð</p>';
    return;
  }

  const votesHtml = results.votes.map(vote => {
    // Build ranking display
    const rankingHtml = vote.ranking.map((candidateId, index) => {
      const candidate = results.candidates?.find(c => (c.id || c.text) === candidateId);
      const name = candidate ? (candidate.text || candidate.id) : candidateId;
      return `
        <span class="vote-card__rank-item">
          <span class="vote-card__rank-number">${index + 1}.</span>
          ${escapeHTML(name)}
        </span>
      `;
    }).join('');

    // Build justifications display
    let justificationsHtml = '';
    if (vote.justifications && vote.justifications.length > 0) {
      const justificationItems = vote.justifications.map(j => {
        const candidate = results.candidates?.find(c => (c.id || c.text) === j.candidate_id);
        const name = candidate ? (candidate.text || candidate.id) : j.candidate_id;
        return `
          <div class="vote-card__justification">
            <div class="vote-card__justification-header">${j.rank}. ${escapeHTML(name)}</div>
            <div class="vote-card__justification-text">${escapeHTML(j.text)}</div>
          </div>
        `;
      }).join('');

      justificationsHtml = `
        <div class="vote-card__justifications" id="justifications-${vote.voter_uid}">
          ${justificationItems}
        </div>
      `;
    }

    // Format timestamp
    const time = vote.submitted_at ? formatTime(vote.submitted_at) : '';

    return `
      <div class="vote-card">
        <div class="vote-card__header">
          <span class="vote-card__voter">${escapeHTML(vote.voter_name)}</span>
          <span class="vote-card__time">${time}</span>
        </div>
        <div class="vote-card__ranking">
          ${rankingHtml}
        </div>
        ${justificationsHtml}
      </div>
    `;
  }).join('');

  individualVotesEl.innerHTML = votesHtml;
}

/**
 * Get human-readable status text
 * @param {string} status - Election status
 * @returns {string} Status text in Icelandic
 */
function getStatusText(status) {
  const statusMap = {
    'draft': 'Drög',
    'published': 'Opin',
    'paused': 'Í bið',
    'closed': 'Lokað',
    'archived': 'Geymd',
  };
  return statusMap[status] || status;
}

/**
 * Format timestamp for display
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Formatted time string
 */
function formatTime(timestamp) {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('is-IS', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
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

// Initialize on load
init();
