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
 *   import { createVotingForm } from './components/voting-form.js';
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

import { debug } from '../utils/debug.js';
import { escapeHTML } from '../utils/format.js';

/**
 * Create voting form element
 * @param {Object} options - Form options
 * @param {string} options.question - Question text (editable by admin)
 * @param {Array<Object>} options.answers - Answer options [{id, text}, ...] (editable by admin)
 * @param {boolean} options.allowMultiple - Allow multiple selections (checkboxes) vs single (radio). Default: false
 * @param {number} options.maxSelections - Maximum selections allowed (only for allowMultiple: true). Optional.
 * @param {number} options.minSelections - Minimum selections required (only for allowMultiple: true). Default: 1
 * @param {Function} options.onSubmit - Callback when form submitted (receives array of answerIds)
 * @param {string} options.questionLabel - Label for question section (i18n)
 * @param {string} options.votingTitle - Title for voting section (i18n)
 * @param {string} options.voteButtonText - Text for submit button (i18n)
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
    questionLabel = 'Spurning',
    votingTitle = 'Veldu þitt svar',
    voteButtonText = 'Kjósa'
  } = options;

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

  // Create container
  const container = document.createElement('div');
  container.className = 'voting-form';
  if (allowMultiple) {
    container.classList.add('voting-form--multiple');
  }

  // Question section
  const questionSection = document.createElement('section');
  questionSection.className = 'voting-form__question';

  const questionTitle = document.createElement('h2');
  questionTitle.className = 'voting-form__question-title';
  questionTitle.textContent = questionLabel;

  const questionText = document.createElement('p');
  questionText.className = 'voting-form__question-text';
  questionText.textContent = question;

  questionSection.appendChild(questionTitle);
  questionSection.appendChild(questionText);

  // Voting section
  const votingSection = document.createElement('section');
  votingSection.className = 'voting-form__voting';

  const votingTitleEl = document.createElement('h3');
  votingTitleEl.className = 'voting-form__voting-title';
  votingTitleEl.textContent = votingTitle;

  // Selection helper text (for multi-select)
  let selectionHelperEl = null;
  if (allowMultiple && maxSelections) {
    selectionHelperEl = document.createElement('p');
    selectionHelperEl.className = 'voting-form__selection-helper';
    selectionHelperEl.textContent = `Veldu allt að ${maxSelections} valkosti`;
  }

  // Form
  const form = document.createElement('form');
  form.className = 'voting-form__form';

  // Answer options container
  const answerOptions = document.createElement('div');
  answerOptions.className = 'voting-form__answer-options';

  // Generate unique form ID to avoid conflicts
  const formId = 'voting-form-' + Math.random().toString(36).substr(2, 9);

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
      if (selectionHelperEl) {
        if (maxSelections) {
          selectionHelperEl.textContent = `Valið ${count} af ${maxSelections} valkostum`;
          if (count >= maxSelections) {
            selectionHelperEl.classList.add('voting-form__selection-helper--max');
          } else {
            selectionHelperEl.classList.remove('voting-form__selection-helper--max');
          }
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
    
    const optionDiv = document.createElement('div');
    optionDiv.className = 'voting-form__answer-option';

    const input = document.createElement('input');
    input.type = inputType;
    input.id = `${formId}-answer-${answerId}`;
    input.name = allowMultiple ? `${formId}-answer-${answerId}` : `${formId}-answer`;
    input.value = answerId;
    input.className = inputClassName;

    // Handle selection
    input.addEventListener('change', () => {
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
    });

    const label = document.createElement('label');
    label.htmlFor = `${formId}-answer-${answerId}`;
    label.className = 'voting-form__answer-label';
    // Support both 'text' and 'answer_text' properties, or string
    label.textContent = answer.text || answer.answer_text || (typeof answer === 'string' ? answer : '');

    optionDiv.appendChild(input);
    optionDiv.appendChild(label);
    answerOptions.appendChild(optionDiv);
  });

  // Vote button
  const voteButton = document.createElement('button');
  voteButton.type = 'submit';
  voteButton.className = 'btn btn--primary voting-form__vote-btn';
  voteButton.disabled = true; // Disabled until selection
  voteButton.textContent = voteButtonText;

  // Form submission
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    if (selectedAnswerIds.length > 0) {
      debug.log('Form submitted with answers:', selectedAnswerIds);
      onSubmit(selectedAnswerIds);
    }
  });

  // Assemble form
  form.appendChild(answerOptions);
  form.appendChild(voteButton);

  votingSection.appendChild(votingTitleEl);
  if (selectionHelperEl) {
    votingSection.appendChild(selectionHelperEl);
  }
  votingSection.appendChild(form);

  // Assemble container
  container.appendChild(questionSection);
  container.appendChild(votingSection);

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
      selectionHelperEl.textContent = `Veldu allt að ${maxSelections} valkosti`;
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
   * @param {string} loadingText - Text to show while loading
   */
  function showLoading(loadingText = 'Sendir atkvæði...') {
    voteButton.disabled = true;
    voteButton.textContent = loadingText;
    voteButton.classList.add('voting-form__vote-btn--loading');

    debug.log('Voting form showing loading state');
  }

  /**
   * Hide loading state on button
   */
  function hideLoading() {
    voteButton.textContent = voteButtonText;
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
