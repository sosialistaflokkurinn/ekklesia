/**
 * Policy Results Display Component
 *
 * Displays real-time results for policy session with:
 * - Amendment results (votes, accepted/rejected status)
 * - Final policy results (yes/no/abstain counts, approved status)
 * - Auto-polling for updates
 *
 * @module components/policy-results-display
 */

import { createBadge } from '../../js/components/badge.js';
import { showErrorIn } from '../../js/components/error-state.js';
import PolicySessionAPI from './api/policy-session-api-mock.js';

/**
 * Create policy results display
 *
 * @param {Object} options - Configuration options
 * @param {string} options.sessionId - Policy session identifier
 * @param {number} options.pollInterval - Polling interval in ms (default: 3000)
 * @param {Object} options.R - i18n strings resource object
 * @param {Function} options.onError - Callback on error
 * @returns {Object} { element, refresh, startPolling, stopPolling, destroy }
 */
export function createPolicyResultsDisplay(options = {}) {
  const {
    sessionId,
    pollInterval = 3000,
    R,
    onError
  } = options;

  // Validate required options
  if (!sessionId) {
    throw new Error('createPolicyResultsDisplay requires sessionId');
  }

  if (!R || !R.string) {
    throw new Error('R strings resource is required');
  }

  // Get i18n strings
  const strings = {
    title: R.string.results_title,
    amendmentsHeading: R.string.results_amendments_heading,
    finalPolicyHeading: R.string.results_final_policy_heading,
    participantsLabel: R.string.results_participants,
    yesLabel: R.string.vote_yes,
    noLabel: R.string.vote_no,
    abstainLabel: R.string.vote_abstain,
    acceptedLabel: R.string.results_accepted,
    rejectedLabel: R.string.results_rejected,
    approvedLabel: R.string.results_approved,
    notApprovedLabel: R.string.results_not_approved,
    loadingMessage: R.string.results_loading,
    errorMessage: R.string.results_error
  };

  // Polling state
  let pollIntervalId = null;
  let currentResults = null;

  // Create container element
  const container = document.createElement('div');
  container.className = 'policy-results';

  // Loading state initially
  container.innerHTML = `<div class="policy-results__loading">${strings.loadingMessage}</div>`;

  // Fetch and display results
  async function refresh() {
    try {
      const results = await PolicySessionAPI.getPolicyResults(sessionId);
      currentResults = results;
      renderResults(results);
    } catch (error) {
      console.error('Error fetching policy results:', error);
      showErrorIn(container, `${strings.errorMessage}: ${error.message}`);
      
      if (onError && typeof onError === 'function') {
        onError(error);
      }
    }
  }

  // Render results to DOM
  function renderResults(results) {
    // Clear container
    container.innerHTML = '';

    // Participants count
    const participantsDiv = document.createElement('div');
    participantsDiv.className = 'policy-results__participants';
    participantsDiv.textContent = `${strings.participantsLabel} ${results.total_participants}`;
    container.appendChild(participantsDiv);

    // Amendment results section
    if (results.amendment_results && results.amendment_results.length > 0) {
      const amendmentsSection = document.createElement('div');
      amendmentsSection.className = 'policy-results__section';

      const amendmentsHeading = document.createElement('h3');
      amendmentsHeading.className = 'policy-results__heading';
      amendmentsHeading.textContent = strings.amendmentsHeading;
      amendmentsSection.appendChild(amendmentsHeading);

      const amendmentsList = document.createElement('div');
      amendmentsList.className = 'policy-results__list';

      // Sort by voting order
      const sortedAmendments = [...results.amendment_results].sort((a, b) => a.voting_order - b.voting_order);

      sortedAmendments.forEach(amendment => {
        const card = createAmendmentResultCard(amendment, strings);
        amendmentsList.appendChild(card);
      });

      amendmentsSection.appendChild(amendmentsList);
      container.appendChild(amendmentsSection);
    }

    // Final policy results section
    if (results.final_policy_results) {
      const finalSection = document.createElement('div');
      finalSection.className = 'policy-results__section';

      const finalHeading = document.createElement('h3');
      finalHeading.className = 'policy-results__heading';
      finalHeading.textContent = strings.finalPolicyHeading;
      finalSection.appendChild(finalHeading);

      const finalCard = createFinalPolicyResultCard(results.final_policy_results, strings);
      finalSection.appendChild(finalCard);

      container.appendChild(finalSection);
    }
  }

  // Create amendment result card
  function createAmendmentResultCard(amendment, strings) {
    const card = document.createElement('div');
    card.className = 'policy-results__card';

    // Heading
    const heading = document.createElement('div');
    heading.className = 'policy-results__card-heading';
    heading.textContent = `${amendment.voting_order}. ${amendment.section_heading}`;

    // Status badge
    const statusBadge = createBadge(
      amendment.accepted ? strings.acceptedLabel : strings.rejectedLabel,
      { variant: amendment.accepted ? 'success' : 'error' }
    );
    statusBadge.className += ' policy-results__status-badge';

    heading.appendChild(statusBadge);
    card.appendChild(heading);

    // Vote counts
    const votesDiv = document.createElement('div');
    votesDiv.className = 'policy-results__votes';

    const totalVotes = amendment.yes_votes + amendment.no_votes;
    const yesPercentage = totalVotes > 0 ? Math.round((amendment.yes_votes / totalVotes) * 100) : 0;
    const noPercentage = totalVotes > 0 ? Math.round((amendment.no_votes / totalVotes) * 100) : 0;

    votesDiv.innerHTML = `
      <div class="policy-results__vote-item policy-results__vote-item--yes">
        <span class="policy-results__vote-label">${strings.yesLabel}:</span>
        <span class="policy-results__vote-count">${amendment.yes_votes} (${yesPercentage}%)</span>
      </div>
      <div class="policy-results__vote-item policy-results__vote-item--no">
        <span class="policy-results__vote-label">${strings.noLabel}:</span>
        <span class="policy-results__vote-count">${amendment.no_votes} (${noPercentage}%)</span>
      </div>
    `;

    card.appendChild(votesDiv);

    return card;
  }

  // Create final policy result card
  function createFinalPolicyResultCard(finalResults, strings) {
    const card = document.createElement('div');
    card.className = 'policy-results__card policy-results__card--final';

    // Status badge
    const statusBadge = createBadge(
      finalResults.approved ? strings.approvedLabel : strings.notApprovedLabel,
      { variant: finalResults.approved ? 'success' : 'error' }
    );
    statusBadge.className += ' policy-results__status-badge';

    card.appendChild(statusBadge);

    // Vote counts
    const votesDiv = document.createElement('div');
    votesDiv.className = 'policy-results__votes policy-results__votes--final';

    const totalVotes = finalResults.yes_votes + finalResults.no_votes + finalResults.abstain_votes;
    const yesPercentage = totalVotes > 0 ? Math.round((finalResults.yes_votes / totalVotes) * 100) : 0;
    const noPercentage = totalVotes > 0 ? Math.round((finalResults.no_votes / totalVotes) * 100) : 0;
    const abstainPercentage = totalVotes > 0 ? Math.round((finalResults.abstain_votes / totalVotes) * 100) : 0;

    votesDiv.innerHTML = `
      <div class="policy-results__vote-item policy-results__vote-item--yes">
        <span class="policy-results__vote-label">${strings.yesLabel}:</span>
        <span class="policy-results__vote-count">${finalResults.yes_votes} (${yesPercentage}%)</span>
      </div>
      <div class="policy-results__vote-item policy-results__vote-item--no">
        <span class="policy-results__vote-label">${strings.noLabel}:</span>
        <span class="policy-results__vote-count">${finalResults.no_votes} (${noPercentage}%)</span>
      </div>
      <div class="policy-results__vote-item policy-results__vote-item--abstain">
        <span class="policy-results__vote-label">${strings.abstainLabel}:</span>
        <span class="policy-results__vote-count">${finalResults.abstain_votes} (${abstainPercentage}%)</span>
      </div>
    `;

    card.appendChild(votesDiv);

    return card;
  }

  // Start polling for updates
  function startPolling() {
    if (pollIntervalId) {
      return; // Already polling
    }

    // Initial fetch
    refresh();

    // Poll at interval
    pollIntervalId = setInterval(refresh, pollInterval);
  }

  // Stop polling
  function stopPolling() {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
  }

  // Cleanup function
  function destroy() {
    stopPolling();
    container.remove();
  }

  return {
    element: container,
    refresh,
    startPolling,
    stopPolling,
    destroy
  };
}
