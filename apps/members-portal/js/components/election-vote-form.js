/**
 * Voting Form Component
 *
 * Reusable voting interface with:
 * - Question display (editable by admin)
 * - Single-choice (radio) or multi-choice (checkbox) answers (editable by admin)
 * - Vote submission button
 * - Auto-validation (button disabled until selection)
 *
 * Supports two modes:
 * - Single-choice: Radio buttons (allowMultiple: false) - default
 * - Multi-choice: Checkboxes (allowMultiple: true)
 *
 * Usage:
 *   import { createVotingForm } from './components/election-vote-form.js';
 *
 *   // Single choice (radio buttons)
 *   const form = createVotingForm({
 *     question: "Hver ætti að vera formaður?",
 *     answers: [
 *       { id: '1a', text: 'Alice Johnson' },
 *       { id: '1b', text: 'Bob Smith' }
 *     ],
 *     allowMultiple: false,  // Radio buttons
 *     onSubmit: (answerIds) => { ... },  // Single ID: ['1a']
 *   });
 *
 *   // Multi choice (checkboxes)
 *   const form = createVotingForm({
 *     question: "Veldu alla sem eiga að vera í stjórn (veldu allt að 3)",
 *     answers: [...],
 *     allowMultiple: true,   // Checkboxes
 *     maxSelections: 3,      // Optional limit
 *     onSubmit: (answerIds) => { ... },  // Multiple IDs: ['1a', '1b', '1c']
 *   });
 *
 *   container.appendChild(form.element);
 */

import { debug } from '../utils/util-debug.js';
import { escapeHTML } from '../utils/util-format.js';
import { el } from '../utils/util-dom.js';
import { R } from '../../i18n/strings-loader.js';

/**
 * Default i18n strings for the component
 * Can be overridden by R.string values or options.strings
 */
const DEFAULT_STRINGS = {
  question_label: 'Spurning',
  voting_title: 'Veldu þitt svar',
  vote_button: 'Kjósa',
  selection_helper: 'Veldu allt að {0} valkosti',
  selection_count: 'Valið {0} af {1} valkostum',
  loading_text: 'Sendir atkvæði...'
};

/**
 * Create voting form element
 * @param {Object} options - Form options
 * @param {string} options.question - Question text (editable by admin)
 * @param {Array<Object>} options.answers - Answer options [{id, text}, ...] (editable by admin)
 * @param {boolean} options.allowMultiple - Allow multiple selections (checkboxes) vs single (radio). Default: false
 * @param {number} options.maxSelections - Maximum selections allowed (only for allowMultiple: true). Optional.
 * @param {number} options.minSelections - Minimum selections required (only for allowMultiple: true). Default: 1
 * @param {Function} options.onSubmit - Callback when form submitted (receives array of answerIds)
 * @param {string} options.questionLabel - Label for question section (i18n) - deprecated, use strings
 * @param {string} options.votingTitle - Title for voting section (i18n) - deprecated, use strings
 * @param {string} options.voteButtonText - Text for submit button (i18n) - deprecated, use strings
 * @param {Object} options.strings - i18n strings for the component
 * @returns {Object} Form instance with element and control methods
 */
export function createVotingForm(options = {}) {
  const {
    question,
    answers = [],
    allowMultiple = false,
    maxSelections = null,
    minSelections = 1,
    onSubmit,
    questionLabel,
    votingTitle,
    voteButtonText,
    strings: optionStrings = {}
  } = options;

  // Merge with defaults, allow legacy options and R.string values
  const strings = {
    ...DEFAULT_STRINGS,
    ...optionStrings,
    question_label: questionLabel || R.string?.voting_question_label || optionStrings.question_label || DEFAULT_STRINGS.question_label,
    voting_title: votingTitle || R.string?.voting_title || optionStrings.voting_title || DEFAULT_STRINGS.voting_title,
    vote_button: voteButtonText || R.string?.voting_button_text || optionStrings.vote_button || DEFAULT_STRINGS.vote_button,
    selection_helper: R.string?.voting_selection_helper || optionStrings.selection_helper || DEFAULT_STRINGS.selection_helper,
    selection_count: R.string?.voting_selection_count || optionStrings.selection_count || DEFAULT_STRINGS.selection_count,
    loading_text: R.string?.voting_loading_text || optionStrings.loading_text || DEFAULT_STRINGS.loading_text
  };

  if (!question) {
    throw new Error('createVotingForm: question is required');
  }

  if (!answers || answers.length === 0) {
    throw new Error('createVotingForm: answers array is required and must not be empty');
  }

  if (!onSubmit || typeof onSubmit !== 'function') {
    throw new Error('createVotingForm: onSubmit callback is required');
  }

  // Selected answer IDs (array to support both single and multiple)
  let selectedAnswerIds = [];

  // Generate unique form ID to avoid conflicts
  const formId = 'voting-form-' + Math.random().toString(36).substr(2, 9);

  // Question section
  const questionTitle = el('h2', 'voting-form__question-title', {}, strings.question_label);
  const questionText = el('p', 'voting-form__question-text', {}, question);
  const questionSection = el('section', 'voting-form__question', {}, questionTitle, questionText);

  // Generate unique IDs for ARIA
  const helperId = `${formId}-helper`;

  // Selection helper text (for multi-select)
  let selectionHelperEl = null;
  if (allowMultiple && maxSelections) {
    const helperText = strings.selection_helper.replace('{0}', maxSelections);
    
    selectionHelperEl = el('p', 'voting-form__selection-helper', { id: helperId }, helperText);
  }

  // Answer options container
  const answerOptions = el('div', 'voting-form__answer-options');

  // Fieldset and Legend (Accessibility improvement)
  const legend = el('legend', 'voting-form__legend', {}, strings.voting_title);
  
  const fieldset = el('fieldset', 'voting-form__fieldset', {
    'aria-describedby': selectionHelperEl ? helperId : undefined
  }, legend, selectionHelperEl, answerOptions);

  // Vote button
  const voteButton = el('button', 'btn btn--primary voting-form__vote-btn', {
    type: 'submit',
    disabled: true
  }, strings.vote_button);

  // Form
  const form = el('form', 'voting-form__form', {
    onsubmit: (e) => {
      e.preventDefault();
      if (selectedAnswerIds.length > 0) {
        debug.log('Form submitted with answers:', selectedAnswerIds);
        onSubmit(selectedAnswerIds);
      }
    }
  }, fieldset, voteButton);

  const votingSection = el('section', 'voting-form__voting', {}, 
    form
  );

  // Main Container
  const container = el('div', 
    ['voting-form', allowMultiple ? 'voting-form--multiple' : ''], 
    {}, 
    questionSection, 
    votingSection
  );

  // Input type based on allowMultiple
  const inputType = allowMultiple ? 'checkbox' : 'radio';
  const inputClassName = allowMultiple ? 'voting-form__answer-checkbox' : 'voting-form__answer-radio';

  /**
   * Update vote button state based on selections
   */
  function updateButtonState() {
    const count = selectedAnswerIds.length;

    if (allowMultiple) {
      // Multi-select: check min/max
      const isValid = count >= minSelections && (!maxSelections || count <= maxSelections);
      voteButton.disabled = !isValid;

      // Update helper text
      if (selectionHelperEl && maxSelections) {
        const helperText = strings.selection_count
          .replace('{0}', count)
          .replace('{1}', maxSelections);
        
        selectionHelperEl.textContent = helperText;
        
        if (count >= maxSelections) {
          selectionHelperEl.classList.add('voting-form__selection-helper--max');
        } else {
          selectionHelperEl.classList.remove('voting-form__selection-helper--max');
        }
      }
    } else {
      // Single-select: must have exactly 1
      voteButton.disabled = count !== 1;
    }
  }

  // Create answer options
  answers.forEach((answer) => {
    // Support both id and answer_id, or use text/string as fallback
    const answerId = answer.id || answer.answer_id || (typeof answer === 'string' ? answer : answer.text || answer.answer_text);
    const answerText = answer.text || answer.answer_text || (typeof answer === 'string' ? answer : '');
    const inputId = `${formId}-answer-${answerId}`;
    const inputName = allowMultiple ? `${formId}-answer-${answerId}` : `${formId}-answer`;

    const input = el('input', inputClassName, {
      type: inputType,
      id: inputId,
      name: inputName,
      value: answerId,
      onchange: () => {
        if (allowMultiple) {
          // Checkbox: toggle in array
          if (input.checked) {
            // Check max limit
            if (maxSelections && selectedAnswerIds.length >= maxSelections) {
              input.checked = false;
              debug.log('Max selections reached:', maxSelections);
              return;
            }
            selectedAnswerIds.push(answerId);
          } else {
            selectedAnswerIds = selectedAnswerIds.filter(id => id !== answerId);
          }
        } else {
          // Radio: replace selection
          selectedAnswerIds = [answerId];
        }
  
        updateButtonState();
        debug.log('Selected answers:', selectedAnswerIds);
      }
    });

    const label = el('label', 'voting-form__answer-label', {
      htmlFor: inputId
    }, answerText);

    const optionDiv = el('div', 'voting-form__answer-option', {}, input, label);
    answerOptions.appendChild(optionDiv);
  });

  /**
   * Get currently selected answer IDs
   * @returns {Array<string>} Array of selected answer IDs (empty if none selected)
   */
  function getSelectedAnswers() {
    return [...selectedAnswerIds];
  }

  /**
   * Reset form (clear selection, disable button)
   */
  function reset() {
    selectedAnswerIds = [];

    // Uncheck all inputs (radio or checkbox)
    const inputs = form.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    inputs.forEach(input => {
      input.checked = false;
    });

    // Reset helper text if present
    if (selectionHelperEl && maxSelections) {
      selectionHelperEl.textContent = strings.selection_helper.replace('{0}', maxSelections);
      selectionHelperEl.classList.remove('voting-form__selection-helper--max');
    }

    // Disable button
    voteButton.disabled = true;

    debug.log('Voting form reset');
  }

  /**
   * Disable form (prevent interaction)
   */
  function disable() {
    const inputs = form.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    inputs.forEach(input => {
      input.disabled = true;
    });

    voteButton.disabled = true;

    debug.log('Voting form disabled');
  }

  /**
   * Enable form (allow interaction)
   */
  function enable() {
    const inputs = form.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    inputs.forEach(input => {
      input.disabled = false;
    });

    // Update button state based on current selections
    updateButtonState();

    debug.log('Voting form enabled');
  }

  /**
   * Show loading state on button
   * @param {string} loadingText - Text to show while loading (uses strings.loading_text if not provided)
   */
  function showLoading(loadingText) {
    voteButton.disabled = true;
    voteButton.textContent = loadingText || strings.loading_text;
    voteButton.classList.add('voting-form__vote-btn--loading');

    debug.log('Voting form showing loading state');
  }

  /**
   * Hide loading state on button
   */
  function hideLoading() {
    voteButton.textContent = strings.vote_button;
    voteButton.classList.remove('voting-form__vote-btn--loading');

    debug.log('Voting form hiding loading state');
  }

  /**
   * Destroy form and cleanup
   */
  function destroy() {
    container.remove();
    debug.log('Voting form destroyed');
  }

  return {
    element: container,
    getSelectedAnswers,
    reset,
    disable,
    enable,
    showLoading,
    hideLoading,
    destroy
  };
}
