/**
 * Ranked Voting Form Component (STV/Forgangsröðun)
 *
 * Drag-and-drop interface for ranked-choice voting (Single Transferable Vote).
 * Supports both mouse and touch interactions for mobile and desktop.
 *
 * Uses SortableJS for drag-and-drop functionality (loaded from CDN).
 *
 * Usage:
 *   import { createRankedVotingForm } from './components/election-ranked-vote-form.js';
 *
 *   const form = createRankedVotingForm({
 *     question: "Raðaðu frambjóðendunum í forgangsröð",
 *     candidates: [
 *       { id: 'anna', text: 'Anna Jónsdóttir' },
 *       { id: 'bjorn', text: 'Björn Sigurðsson' },
 *       { id: 'gudrun', text: 'Guðrún Ólafsdóttir' }
 *     ],
 *     seatsToFill: 2,
 *     onSubmit: (rankedIds) => { ... },  // ['anna', 'gudrun', 'bjorn'] - ordered preferences
 *   });
 *
 *   container.appendChild(form.element);
 */

import { debug } from '../utils/util-debug.js';
import { escapeHTML } from '../utils/util-format.js';
import { el } from '../utils/util-dom.js';
import { R } from '../../i18n/strings-loader.js';

// SortableJS CDN URL
const SORTABLE_CDN = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js';

/**
 * Default i18n strings for the component
 */
const DEFAULT_STRINGS = {
  question_label: 'Spurning',
  voting_title: 'Raðaðu í forgangsröð',
  vote_button: 'Skila forgangsröðun',
  helper_text: 'Dragðu frambjóðendur til að raða þeim. Nr. 1 er þitt fyrsta val.',
  helper_touch: 'Haltu fingri á frambjóðanda og dragðu til að færa.',
  rank_label: '{0}. val',
  seats_info: 'Fjöldi sæta: {0}',
  loading_text: 'Sendir forgangsröðun...',
  reset_button: 'Núllstilla röðun',
  confirm_title: 'Staðfesta forgangsröðun',
  confirm_message: 'Ertu viss um að þú viljir skila þessari forgangsröðun?'
};

// Track if SortableJS is loaded
let sortableLoaded = false;
let sortableLoadPromise = null;

/**
 * Dynamically load SortableJS from CDN
 */
async function loadSortable() {
  if (sortableLoaded && window.Sortable) {
    return window.Sortable;
  }

  if (sortableLoadPromise) {
    return sortableLoadPromise;
  }

  sortableLoadPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.Sortable) {
      sortableLoaded = true;
      resolve(window.Sortable);
      return;
    }

    const script = document.createElement('script');
    script.src = SORTABLE_CDN;
    script.async = true;

    script.onload = () => {
      sortableLoaded = true;
      debug.log('SortableJS loaded successfully');
      resolve(window.Sortable);
    };

    script.onerror = () => {
      reject(new Error('Failed to load SortableJS'));
    };

    document.head.appendChild(script);
  });

  return sortableLoadPromise;
}

/**
 * Create ranked voting form element
 * @param {Object} options - Form options
 * @param {string} options.question - Question text
 * @param {Array<Object>} options.candidates - Candidate options [{id, text}, ...]
 * @param {number} options.seatsToFill - Number of seats to fill (for info display)
 * @param {Function} options.onSubmit - Callback when form submitted (receives ordered array of candidateIds)
 * @param {Object} options.strings - i18n strings for the component
 * @returns {Object} Form instance with element and control methods
 */
export async function createRankedVotingForm(options = {}) {
  const {
    question,
    candidates = [],
    seatsToFill = 1,
    onSubmit,
    strings: optionStrings = {}
  } = options;

  // Merge with defaults and R.string values
  const strings = {
    ...DEFAULT_STRINGS,
    ...optionStrings,
    question_label: R.string?.voting_question_label || optionStrings.question_label || DEFAULT_STRINGS.question_label,
    voting_title: R.string?.ranked_voting_title || optionStrings.voting_title || DEFAULT_STRINGS.voting_title,
    vote_button: R.string?.ranked_vote_button || optionStrings.vote_button || DEFAULT_STRINGS.vote_button,
    helper_text: R.string?.ranked_helper_text || optionStrings.helper_text || DEFAULT_STRINGS.helper_text,
    helper_touch: R.string?.ranked_helper_touch || optionStrings.helper_touch || DEFAULT_STRINGS.helper_touch,
    rank_label: R.string?.ranked_rank_label || optionStrings.rank_label || DEFAULT_STRINGS.rank_label,
    seats_info: R.string?.ranked_seats_info || optionStrings.seats_info || DEFAULT_STRINGS.seats_info,
    loading_text: R.string?.ranked_loading_text || optionStrings.loading_text || DEFAULT_STRINGS.loading_text,
    reset_button: R.string?.ranked_reset_button || optionStrings.reset_button || DEFAULT_STRINGS.reset_button
  };

  if (!question) {
    throw new Error('createRankedVotingForm: question is required');
  }

  if (!candidates || candidates.length < 3) {
    throw new Error('createRankedVotingForm: at least 3 candidates are required for ranked-choice voting');
  }

  if (!onSubmit || typeof onSubmit !== 'function') {
    throw new Error('createRankedVotingForm: onSubmit callback is required');
  }

  // Load SortableJS
  let Sortable;
  try {
    Sortable = await loadSortable();
  } catch (error) {
    debug.error('Failed to load SortableJS:', error);
    throw new Error('Could not load drag-and-drop library');
  }

  // Generate unique form ID
  const formId = 'ranked-form-' + Math.random().toString(36).substr(2, 9);

  // Current order (starts with original candidate order)
  let currentOrder = candidates.map(c => c.id || c.text);

  // Sortable instance reference
  let sortableInstance = null;

  // Question section
  const questionTitle = el('h2', 'ranked-form__question-title', {}, strings.question_label);
  const questionText = el('p', 'ranked-form__question-text', {}, question);
  const questionSection = el('section', 'ranked-form__question', {}, questionTitle, questionText);

  // Seats info
  const seatsInfo = el('p', 'ranked-form__seats-info', {},
    strings.seats_info.replace('{0}', seatsToFill)
  );

  // Helper text
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const helperText = el('p', 'ranked-form__helper', {},
    isTouchDevice ? strings.helper_touch : strings.helper_text
  );

  // Candidate list container
  const candidateList = el('ul', 'ranked-form__candidate-list', {
    id: `${formId}-list`,
    'aria-label': strings.voting_title
  });

  // Create candidate items
  candidates.forEach((candidate, index) => {
    const candidateId = candidate.id || candidate.text;
    const candidateText = candidate.text || candidate.id;

    const rankBadge = el('span', 'ranked-form__rank-badge', {}, (index + 1).toString());
    const candidateName = el('span', 'ranked-form__candidate-name', {}, candidateText);
    const dragHandle = el('span', 'ranked-form__drag-handle', {
      'aria-hidden': 'true'
    }, '⋮⋮');

    const listItem = el('li', 'ranked-form__candidate-item', {
      'data-id': candidateId,
      draggable: 'false', // Sortable handles this
      tabindex: '0',
      role: 'listitem'
    }, dragHandle, rankBadge, candidateName);

    candidateList.appendChild(listItem);
  });

  // Update rank badges after reorder
  function updateRankBadges() {
    const items = candidateList.querySelectorAll('.ranked-form__candidate-item');
    items.forEach((item, index) => {
      const badge = item.querySelector('.ranked-form__rank-badge');
      if (badge) {
        badge.textContent = (index + 1).toString();
      }
    });

    // Update current order array
    currentOrder = Array.from(items).map(item => item.dataset.id);
    debug.log('New ranking order:', currentOrder);
  }

  // Initialize Sortable
  sortableInstance = new Sortable(candidateList, {
    animation: 150,
    ghostClass: 'ranked-form__candidate-item--ghost',
    chosenClass: 'ranked-form__candidate-item--chosen',
    dragClass: 'ranked-form__candidate-item--drag',
    handle: '.ranked-form__drag-handle',
    forceFallback: isTouchDevice, // Better touch support
    fallbackTolerance: 3,
    onEnd: () => {
      updateRankBadges();
    }
  });

  // Reset button
  const resetButton = el('button', 'btn btn--secondary ranked-form__reset-btn', {
    type: 'button',
    onclick: () => {
      reset();
    }
  }, strings.reset_button);

  // Vote button
  const voteButton = el('button', 'btn btn--primary ranked-form__vote-btn', {
    type: 'submit'
  }, strings.vote_button);

  // Button container
  const buttonContainer = el('div', 'ranked-form__buttons', {}, resetButton, voteButton);

  // Form
  const form = el('form', 'ranked-form__form', {
    onsubmit: (e) => {
      e.preventDefault();
      debug.log('Ranked form submitted with order:', currentOrder);
      onSubmit(currentOrder);
    }
  });

  // Fieldset and Legend
  const legend = el('legend', 'ranked-form__legend', {}, strings.voting_title);
  const fieldset = el('fieldset', 'ranked-form__fieldset', {},
    legend,
    seatsInfo,
    helperText,
    candidateList,
    buttonContainer
  );

  form.appendChild(fieldset);

  // Voting section
  const votingSection = el('section', 'ranked-form__voting', {}, form);

  // Main container
  const container = el('div', 'ranked-form', {},
    questionSection,
    votingSection
  );

  /**
   * Get current ranking order
   * @returns {Array<string>} Ordered array of candidate IDs
   */
  function getRanking() {
    return [...currentOrder];
  }

  /**
   * Reset to original order
   */
  function reset() {
    // Restore original order
    const items = candidateList.querySelectorAll('.ranked-form__candidate-item');
    const originalOrder = candidates.map(c => c.id || c.text);

    // Sort items back to original order
    originalOrder.forEach(id => {
      const item = candidateList.querySelector(`[data-id="${id}"]`);
      if (item) {
        candidateList.appendChild(item);
      }
    });

    updateRankBadges();
    debug.log('Ranked form reset to original order');
  }

  /**
   * Disable form (prevent interaction)
   */
  function disable() {
    if (sortableInstance) {
      sortableInstance.option('disabled', true);
    }
    voteButton.disabled = true;
    resetButton.disabled = true;
    container.classList.add('ranked-form--disabled');
    debug.log('Ranked form disabled');
  }

  /**
   * Enable form (allow interaction)
   */
  function enable() {
    if (sortableInstance) {
      sortableInstance.option('disabled', false);
    }
    voteButton.disabled = false;
    resetButton.disabled = false;
    container.classList.remove('ranked-form--disabled');
    debug.log('Ranked form enabled');
  }

  /**
   * Show loading state on button
   */
  function showLoading() {
    disable();
    voteButton.textContent = strings.loading_text;
    voteButton.classList.add('ranked-form__vote-btn--loading');
    debug.log('Ranked form showing loading state');
  }

  /**
   * Hide loading state on button
   */
  function hideLoading() {
    enable();
    voteButton.textContent = strings.vote_button;
    voteButton.classList.remove('ranked-form__vote-btn--loading');
    debug.log('Ranked form hiding loading state');
  }

  /**
   * Destroy form and cleanup
   */
  function destroy() {
    if (sortableInstance) {
      sortableInstance.destroy();
      sortableInstance = null;
    }
    container.remove();
    debug.log('Ranked form destroyed');
  }

  return {
    element: container,
    getRanking,
    reset,
    disable,
    enable,
    showLoading,
    hideLoading,
    destroy
  };
}
