/**
 * Policy Item Vote Card Component
 *
 * Displays a single policy item with Yes/No voting buttons.
 * Used for voting on original policy items before amendments.
 *
 * @module components/policy-item-vote-card
 */

import { createButton } from './button.js';
import { createBadge } from './badge.js';
import { showToast } from './toast.js';
import { showConfirm } from './modal.js';

/**
 * Create policy item vote card
 *
 * @param {Object} options - Configuration options
 * @param {string} options.sessionId - Policy session identifier
 * @param {Object} options.item - Policy item data
 * @param {string} options.item.id - Item ID
 * @param {string} options.item.heading - Item heading (e.g., "Liður 1")
 * @param {string} options.item.text - Item text content
 * @param {number} options.item.order - Display order
 * @param {boolean} options.item.has_voted - Already voted flag
 * @param {Object} options.R - i18n strings resource object
 * @param {Function} options.onVote - Callback function for voting (async)
 * @param {Function} options.onVoteSuccess - Callback after successful vote
 * @returns {Object} { element, markAsVoted, destroy }
 */
export function createPolicyItemVoteCard(options = {}) {
  const {
    sessionId,
    item,
    R,
    onVote,
    onVoteSuccess
  } = options;

  // Validate required options
  if (!sessionId) {
    throw new Error('createPolicyItemVoteCard requires sessionId');
  }

  if (!item) {
    throw new Error('createPolicyItemVoteCard requires item object');
  }

  if (!R || !R.string) {
    throw new Error('R strings resource is required');
  }

  // Get i18n strings
  const strings = {
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
  let hasVoted = item.has_voted || false;

  // Create container element
  const container = document.createElement('div');
  container.className = 'policy-item-vote-card';

  // Card header
  const header = document.createElement('div');
  header.className = 'policy-item-vote-card__header';

  const title = document.createElement('h3');
  title.className = 'policy-item-vote-card__title';
  title.textContent = item.heading;

  header.appendChild(title);

  // Already voted badge (initially hidden)
  const votedBadge = createBadge({
    text: `✓ ${strings.alreadyVoted}`,
    variant: 'success'
  });
  votedBadge.element.classList.add('policy-item-vote-card__voted-badge');
  votedBadge.element.style.display = hasVoted ? 'inline-block' : 'none';
  
  header.appendChild(votedBadge.element);

  // Item text
  const textContainer = document.createElement('div');
  textContainer.className = 'policy-item-vote-card__text';

  const textParagraph = document.createElement('p');
  textParagraph.className = 'policy-item-vote-card__text-content';
  textParagraph.textContent = item.text;

  textContainer.appendChild(textParagraph);

  // Voting buttons container
  const votingContainer = document.createElement('div');
  votingContainer.className = 'policy-item-vote-card__voting';

  // Yes button
  const yesButton = createButton({
    text: strings.yesButton,
    variant: 'primary',
    size: 'medium',
    fullWidth: false,
    onClick: () => handleVote('yes')
  });
  yesButton.element.classList.add('policy-item-vote-card__vote-btn');

  // No button
  const noButton = createButton({
    text: strings.noButton,
    variant: 'secondary',
    size: 'medium',
    fullWidth: false,
    onClick: () => handleVote('no')
  });
  noButton.element.classList.add('policy-item-vote-card__vote-btn');

  votingContainer.appendChild(yesButton.element);
  votingContainer.appendChild(noButton.element);

  // Hide voting buttons if already voted
  if (hasVoted) {
    votingContainer.style.display = 'none';
  }

  // Assemble card
  container.appendChild(header);
  container.appendChild(textContainer);
  container.appendChild(votingContainer);

  /**
   * Handle vote submission
   * @param {string} vote - 'yes' or 'no'
   */
  async function handleVote(vote) {
    // Confirm vote
    const confirmMessage = vote === 'yes' 
      ? strings.confirmYesMessage 
      : strings.confirmNoMessage;
    
    const confirmed = await showConfirm(strings.confirmTitle, confirmMessage);
    
    if (!confirmed) {
      return;
    }

    // Disable buttons and show loading state
    yesButton.setLoading(true);
    noButton.setLoading(true);
    yesButton.element.disabled = true;
    noButton.element.disabled = true;

    try {
      // Call onVote callback if provided
      if (onVote && typeof onVote === 'function') {
        await onVote(item.id, vote);
      }

      // Show success message
      showToast(strings.successMessage, 'success');

      // Mark as voted
      markAsVoted();

      // Call success callback
      if (onVoteSuccess && typeof onVoteSuccess === 'function') {
        onVoteSuccess({ itemId: item.id, vote });
      }

    } catch (error) {
      console.error('Error voting on policy item:', error);
      showToast(`${strings.errorVote}: ${error.message}`, 'error');
      
      // Re-enable buttons on error
      yesButton.setLoading(false);
      noButton.setLoading(false);
      yesButton.element.disabled = false;
      noButton.element.disabled = false;
    }
  }

  /**
   * Mark card as voted (hide buttons, show badge)
   */
  function markAsVoted() {
    hasVoted = true;
    votingContainer.style.display = 'none';
    votedBadge.element.style.display = 'inline-block';
  }

  /**
   * Cleanup function
   */
  function destroy() {
    yesButton.destroy();
    noButton.destroy();
    votedBadge.destroy();
    container.remove();
  }

  // Return public API
  return {
    element: container,
    markAsVoted,
    destroy
  };
}
