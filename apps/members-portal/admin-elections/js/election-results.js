/**
 * Election Results Page - Admin Elections
 *
 * Displays election results with vote distribution and export options.
 * Supports both standard elections and ranked choice (raðkosning).
 *
 * Module cleanup not needed - page reloads on navigation.
 */

import { fetchElectionResults, fetchElection } from './api/elections-admin-api.js';
import { initAuthenticatedPage } from '../../js/page-init.js';
import { formatDateTimeIcelandic } from '../../js/utils/util-format.js';

// DOM Elements
const elements = {
  loadingState: null,
  errorState: null,
  errorMessage: null,
  retryButton: null,
  resultsContent: null,
  electionTitle: null,
  electionQuestion: null,
  electionDates: null,
  totalVotes: null,
  totalOptions: null,
  electionStatus: null,
  resultsTbody: null,
  btnExportCsv: null,
  btnPrint: null
};

let currentElection = null;
let currentResults = null;

/**
 * Initialize DOM element references
 */
function initElements() {
  elements.loadingState = document.getElementById('loading-state');
  elements.errorState = document.getElementById('error-state');
  elements.errorMessage = document.getElementById('error-message');
  elements.retryButton = document.getElementById('retry-button');
  elements.resultsContent = document.getElementById('results-content');
  elements.electionTitle = document.getElementById('election-title');
  elements.electionQuestion = document.getElementById('election-question');
  elements.electionDates = document.getElementById('election-dates');
  elements.totalVotes = document.getElementById('total-votes');
  elements.totalOptions = document.getElementById('total-options');
  elements.electionStatus = document.getElementById('election-status');
  elements.resultsTbody = document.getElementById('results-tbody');
  elements.btnExportCsv = document.getElementById('btn-export-csv');
  elements.btnPrint = document.getElementById('btn-print');
}

/**
 * Get election ID from URL
 */
function getElectionId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return '-';
  return formatDateTimeIcelandic(dateString);
}

/**
 * Get status label in Icelandic
 */
function getStatusLabel(status) {
  const labels = {
    draft: 'Drög',
    published: 'Opin',
    closed: 'Lokað'
  };
  return labels[status] || status;
}

/**
 * Show loading state
 */
function showLoading() {
  elements.loadingState?.classList.remove('u-hidden');
  elements.errorState?.classList.add('u-hidden');
  elements.resultsContent?.classList.add('u-hidden');
}

/**
 * Hide loading state
 */
function hideLoading() {
  elements.loadingState?.classList.add('u-hidden');
}

/**
 * Show error state
 */
function showError(message) {
  hideLoading();
  elements.errorState?.classList.remove('u-hidden');
  elements.resultsContent?.classList.add('u-hidden');
  if (elements.errorMessage) {
    elements.errorMessage.textContent = message;
  }
}

/**
 * Show info message (not an error, just informational)
 */
function showInfo(title, message) {
  hideLoading();
  elements.errorState?.classList.remove('u-hidden');
  elements.resultsContent?.classList.add('u-hidden');
  // Change error heading to info style
  const errorHeading = elements.errorState?.querySelector('h2');
  if (errorHeading) {
    errorHeading.textContent = title;
    errorHeading.classList.remove('u-text-error');
  }
  if (elements.errorMessage) {
    elements.errorMessage.textContent = message;
  }
  // Hide retry button for info messages
  if (elements.retryButton?.style) {
    elements.retryButton.style.display = 'none';
  }
}

/**
 * Show results content
 */
function showResults() {
  elements.loadingState?.classList.add('u-hidden');
  elements.errorState?.classList.add('u-hidden');
  elements.resultsContent?.classList.remove('u-hidden');
}

/**
 * Load and display results
 */
async function loadResults() {
  const electionId = getElectionId();

  if (!electionId) {
    showError('Engin kosning valin.');
    return;
  }

  showLoading();

  try {
    // First fetch the election to check status
    const election = await fetchElection(electionId);
    currentElection = election;

    // Check if election is still open - results not available yet
    if (election.status === 'published' || election.status === 'active') {
      const voteCount = election.vote_count || 0;
      showInfo(
        'Kosning í gangi',
        `Niðurstöður verða aðgengilegar þegar kosningu er lokað. ${voteCount} ${voteCount === 1 ? 'atkvæði hefur' : 'atkvæði hafa'} verið skráð.`
      );
      return;
    }

    // Check if election is draft - no results
    if (election.status === 'draft') {
      showInfo(
        'Kosning ekki hafin',
        'Þessi kosning er enn í drögum og hefur ekki verið opnuð.'
      );
      return;
    }

    // Election is closed - fetch results
    let results = null;
    try {
      results = await fetchElectionResults(electionId);
    } catch (resultsError) {
      console.warn('Results endpoint failed, falling back to election data:', resultsError);
      // Fall back to using election data (may have vote counts on answers)
    }

    currentResults = results;
    renderResults(election, results);
    showResults();
  } catch (error) {
    console.error('Failed to load results:', error);
    showError(error.message || 'Ekki tókst að sækja niðurstöður.');
  }
}

/**
 * Render results to the page
 */
function renderResults(election, results) {
  // Update header
  elements.electionTitle.textContent = election.title || 'Ónefnd kosning';
  elements.electionQuestion.textContent = election.question || '';

  // Date info
  const dates = [];
  if (election.voting_starts_at) {
    dates.push(`Opnuð: ${formatDate(election.voting_starts_at)}`);
  }
  if (election.closed_at) {
    dates.push(`Lokuð: ${formatDate(election.closed_at)}`);
  }
  elements.electionDates.textContent = dates.join(' | ');

  // Summary stats
  const totalVotes = results?.total_votes || election.vote_count || 0;
  // Use results if available, otherwise fall back to election answers
  const resultsData = results?.results?.length > 0 ? results.results : null;
  const answers = resultsData || election.answers || [];

  elements.totalVotes.textContent = totalVotes;
  elements.totalOptions.textContent = answers.length;
  elements.electionStatus.textContent = getStatusLabel(election.status);

  // Render vote distribution table
  renderVoteDistribution(answers, totalVotes, election.type);
}

/**
 * Render vote distribution table
 */
function renderVoteDistribution(answers, totalVotes, electionType) {
  elements.resultsTbody.innerHTML = '';

  if (!answers || answers.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="4" class="u-text-center u-text-muted">Engar niðurstöður fundust.</td>';
    elements.resultsTbody.appendChild(row);
    return;
  }

  // Sort by votes (descending)
  const sortedAnswers = [...answers].sort((a, b) => {
    const votesA = a.votes || a.vote_count || 0;
    const votesB = b.votes || b.vote_count || 0;
    return votesB - votesA;
  });

  // Find winner(s)
  const maxVotes = sortedAnswers[0]?.votes || sortedAnswers[0]?.vote_count || 0;

  sortedAnswers.forEach((answer, index) => {
    const votes = answer.votes || answer.vote_count || 0;
    const percentage = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : 0;
    const isWinner = votes === maxVotes && votes > 0;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        ${answer.text || answer.answer_text || 'Svar ' + (index + 1)}
        ${isWinner ? '<span class="winner-badge">Sigurvegari</span>' : ''}
      </td>
      <td>${votes}</td>
      <td>${percentage}%</td>
      <td class="results-table__bar-cell">
        <div class="results-bar">
          <div class="results-bar__fill ${isWinner ? 'results-bar__fill--winner' : ''}" style="width: ${percentage}%"></div>
        </div>
      </td>
    `;
    elements.resultsTbody.appendChild(row);
  });
}

/**
 * Export results to CSV
 */
function exportToCsv() {
  if (!currentElection) return;

  const answers = currentResults?.results || currentElection.answers || [];
  const totalVotes = currentResults?.total_votes || currentElection.vote_count || 0;

  const rows = [
    ['Kosning', currentElection.title],
    ['Spurning', currentElection.question || ''],
    ['Heildaratkvæði', totalVotes],
    [''],
    ['Svar', 'Atkvæði', 'Hlutfall']
  ];

  answers.forEach(answer => {
    const votes = answer.votes || answer.vote_count || 0;
    const percentage = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : 0;
    rows.push([
      answer.text || answer.answer_text || '',
      votes,
      `${percentage}%`
    ]);
  });

  const csvContent = rows.map(row => row.map(cell =>
    `"${String(cell).replace(/"/g, '""')}"`
  ).join(',')).join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `nidurstodur-${currentElection.id}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Print results
 */
function printResults() {
  window.print();
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  elements.retryButton?.addEventListener('click', loadResults);
  elements.btnExportCsv?.addEventListener('click', exportToCsv);
  elements.btnPrint?.addEventListener('click', printResults);
}

/**
 * Initialize the page
 */
async function init() {
  try {
    // Initialize authentication first
    await initAuthenticatedPage();
  } catch (error) {
    // Handle auth redirect
    if (error.name === 'AuthenticationError') {
      window.location.href = error.redirectTo || '/';
      return;
    }
    console.error('Auth initialization failed:', error);
  }

  initElements();
  setupEventListeners();
  await loadResults();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
