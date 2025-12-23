/**
 * Amendment Vote Card Component
 *
 * Displays single amendment with Yes/No voting buttons.
 * Shows section, original text vs proposed text, rationale, and voting state.
 *
 * @module components/amendment-vote-card
 */

import { createButton } from './ui-button.js';
import { createBadge } from './ui-badge.js';
import { showToast } from './ui-toast.js';
import { showConfirm } from './ui-modal.js';
import { R } from '../../i18n/strings-loader.js';
import { voteOnAmendment as defaultVoteOnAmendment } from '../api/api-elections.js';
import { el } from '../utils/util-dom.js';

/**
 * Create amendment vote card
 *
 * @param {Object} options - Configuration options
 * @param {string} options.sessionId - Policy session identifier
 * @param {Object} options.amendment - Amendment data
 * @param {string} options.amendment.id - Amendment ID
 * @param {number} options.amendment.voting_order - Display order
 * @param {string} options.amendment.section_heading - Section name
 * @param {string} options.amendment.original_text - Current text
 * @param {string} options.amendment.proposed_text - Proposed text
 * @param {string} options.amendment.rationale - Explanation (optional)
 * @param {boolean} options.amendment.has_voted - Already voted flag
 * @param {Object} options.R - i18n strings resource object
 * @param {Function} options.onVoteSuccess - Callback after successful vote
 * @param {Object} [options.api] - Optional API override for testing/mocking
 * @param {Function} [options.api.voteOnAmendment] - Custom voteOnAmendment function
 * @returns {Object} { element, markAsVoted, destroy }
 */
export function createAmendmentVoteCard(options = {}) {
  const {
    sessionId,
    amendment,
    R,
    onVoteSuccess,
    api
  } = options;

  // Use provided API or default
  const voteOnAmendment = api?.voteOnAmendment || defaultVoteOnAmendment;

  // Validate required options
  if (!sessionId) {
    throw new Error('createAmendmentVoteCard requires sessionId');
  }

  if (!amendment) {
    throw new Error('createAmendmentVoteCard requires amendment object');
  }

  if (!R || !R.string) {
    throw new Error('R strings resource is required');
  }

  // Get i18n strings
  const strings = {
    amendmentNumber: R.string.amendment_number,
    originalTextLabel: R.string.amendment_original_text,
    proposedTextLabel: R.string.amendment_proposed_text,
    rationaleLabel: R.string.amendment_rationale_label,
    yesButton: R.string.vote_yes,
    noButton: R.string.vote_no,
    votingButton: R.string.vote_voting,
    alreadyVoted: R.string.vote_already_voted,
    successMessage: R.string.vote_success,
    confirmTitle: R.string.vote_confirm_title,
    confirmYesMessage: R.string.vote_confirm_yes,
    confirmNoMessage: R.string.vote_confirm_no,
    errorVote: R.string.vote_error
  };

  // Track voted state
  let hasVoted = amendment.has_voted || false;

  // Already voted badge (initially hidden)
  const votedBadge = createBadge(
    `✓ ${strings.alreadyVoted}`,
    { variant: 'success' }
  );
  votedBadge.element.classList.add('amendment-vote-card__voted-badge');
  votedBadge.element.style.display = hasVoted ? 'inline-flex' : 'none';

  const header = el('div', 'amendment-vote-card__header', {},
    el('h3', 'amendment-vote-card__title', {}, `${strings.amendmentNumber} ${amendment.voting_order}: ${amendment.section_heading}`),
    votedBadge.element
  );

  const originalSection = el('div', 'amendment-vote-card__text-section', {},
    el('div', 'amendment-vote-card__text-label amendment-vote-card__text-label--original', {}, strings.originalTextLabel),
    el('div', 'amendment-vote-card__text amendment-vote-card__text--original', {}, amendment.original_text)
  );

  const proposedSection = el('div', 'amendment-vote-card__text-section', {},
    el('div', 'amendment-vote-card__text-label amendment-vote-card__text-label--proposed', {}, strings.proposedTextLabel),
    el('div', 'amendment-vote-card__text amendment-vote-card__text--proposed', {}, amendment.proposed_text)
  );

  const body = el('div', 'amendment-vote-card__body', {}, originalSection, proposedSection);

  // Rationale section (optional)
  if (amendment.rationale && amendment.rationale.trim()) {
    body.appendChild(el('div', 'amendment-vote-card__rationale', {},
      el('div', 'amendment-vote-card__rationale-label', {}, strings.rationaleLabel),
      el('div', 'amendment-vote-card__rationale-text', {}, amendment.rationale)
    ));
  }

  const yesBtn = createButton({
    text: strings.yesButton,
    variant: 'success',
    size: 'medium',
    disabled: hasVoted
  });

  const noBtn = createButton({
    text: strings.noButton,
    variant: 'danger',
    size: 'medium',
    disabled: hasVoted
  });

  const footer = el('div', 'amendment-vote-card__footer', {}, yesBtn.element, noBtn.element);

  const container = el('div', 'amendment-vote-card', {}, header, body, footer);

  // Vote handler
  async function handleVote(vote) {
    // Show confirmation
    const confirmMessage = vote === 'yes' ? strings.confirmYesMessage : strings.confirmNoMessage;
    const confirmed = await showConfirm(
      strings.confirmTitle,
      confirmMessage
    );

    if (!confirmed) {
      return;
    }

    // Show loading state
    yesBtn.setLoading(true, strings.votingButton);
    noBtn.setLoading(true, strings.votingButton);

    try {
      // Submit vote
      const response = await voteOnAmendment(sessionId, amendment.id, vote);

      // Success
      showToast(strings.successMessage, 'success');

      // Mark as voted
      markAsVoted();

      // Call success callback
      if (onVoteSuccess && typeof onVoteSuccess === 'function') {
        onVoteSuccess({
          amendmentId: amendment.id,
          vote,
          response
        });
      }

    } catch (error) {
      console.error('Vote submission error:', error);
      showToast(`${strings.errorVote}: ${error.message}`, 'error');
      
      // Reset loading state on error
      yesBtn.setLoading(false, strings.yesButton);
      noBtn.setLoading(false, strings.noButton);
    }
  }

  // Button event listeners
  // Cleanup in destroy() - buttons removed when container.remove() is called
  yesBtn.element.addEventListener('click', () => handleVote('yes'));
  noBtn.element.addEventListener('click', () => handleVote('no'));

  // Mark as voted - update UI
  function markAsVoted() {
    hasVoted = true;

    // Show voted badge
    votedBadge.element.style.display = 'inline-flex';
    
    // Disable buttons
    yesBtn.disable();
    noBtn.disable();
    
    // Reset button text
    yesBtn.setLoading(false, strings.yesButton);
    noBtn.setLoading(false, strings.noButton);
    
    // Add voted class to container
    container.classList.add('amendment-vote-card--voted');
  }

  // Cleanup function
  function destroy() {
    yesBtn.destroy();
    noBtn.destroy();
    container.remove();
  }

  return {
    element: container,
    markAsVoted,
    destroy
  };
}
