/**
 * Amendment Form Component
 *
 * Displays form for submitting amendments during policy session break period.
 * Allows members to select policy section, propose changes, and provide rationale.
 *
 * @module components/amendment-form
 */

import { createButton } from './button.js';
import { showToast } from './toast.js';
import { showAlert } from './modal.js';
import { submitAmendment } from '../api/elections-api.js';

/**
 * Creates an amendment submission form
 * @param {Object} options - Form configuration
 * @param {Array} options.sections - Array of policy sections {id, title, text}
 * @param {string} options.sessionId - Policy session ID
 * @param {Object} options.R - i18n strings resource object
 * @param {Function} [options.onSubmitSuccess] - Optional callback on successful submission
 * @returns {Object} - Form API {element, reset, destroy}
 */
export function createAmendmentForm({ sections, sessionId, R, onSubmitSuccess }) {
  // Validate inputs
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error('Sections array is required and must not be empty');
  }
  
  if (!sessionId) {
    throw new Error('Session ID is required');
  }

  if (!R || !R.string) {
    throw new Error('R strings resource is required');
  }

  // Get i18n strings
  const strings = {
    title: R.string.amendment_submit,
    sectionLabel: R.string.amendment_section_label,
    sectionPlaceholder: R.string.amendment_section_placeholder,
    originalTextLabel: R.string.amendment_original_text,
    proposedTextLabel: R.string.amendment_proposed_text,
    proposedTextPlaceholder: R.string.amendment_proposed_placeholder,
    rationaleLabel: R.string.amendment_rationale_label,
    rationalePlaceholder: R.string.amendment_rationale_placeholder,
    submitButton: R.string.amendment_submit,
    submittingButton: R.string.amendment_submitting,
    successMessage: R.string.amendment_success,
    confirmTitle: R.string.amendment_confirm_title,
    confirmMessage: R.string.amendment_confirm_message,
    errorRequired: R.string.amendment_error_required,
    errorSubmission: R.string.amendment_error_submission
  };

  // Create container element
  const container = document.createElement('div');
  container.className = 'amendment-form';

  // Create form
  const form = document.createElement('form');
  form.className = 'amendment-form__form';

  // Section selector
  const sectionGroup = document.createElement('div');
  sectionGroup.className = 'amendment-form__group';

  const sectionLabel = document.createElement('label');
  sectionLabel.className = 'amendment-form__label';
  sectionLabel.htmlFor = 'amendment-section-select';
  sectionLabel.textContent = strings.sectionLabel;

  const sectionSelect = document.createElement('select');
  sectionSelect.className = 'amendment-form__select';
  sectionSelect.id = 'amendment-section-select';
  sectionSelect.required = true;

  // Add placeholder option
  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = strings.sectionPlaceholder;
  placeholderOption.disabled = true;
  placeholderOption.selected = true;
  sectionSelect.appendChild(placeholderOption);

  // Add section options
  sections.forEach(section => {
    const option = document.createElement('option');
    option.value = section.id;
    option.textContent = section.heading;
    option.dataset.text = section.text;
    sectionSelect.appendChild(option);
  });

  sectionGroup.appendChild(sectionLabel);
  sectionGroup.appendChild(sectionSelect);

  // Original text display (read-only)
  const originalTextGroup = document.createElement('div');
  originalTextGroup.className = 'amendment-form__group amendment-form__group--hidden';

  const originalTextLabel = document.createElement('label');
  originalTextLabel.className = 'amendment-form__label';
  originalTextLabel.htmlFor = 'amendment-original-text';
  originalTextLabel.textContent = strings.originalTextLabel;

  const originalTextDisplay = document.createElement('div');
  originalTextDisplay.className = 'amendment-form__original-text';
  originalTextDisplay.id = 'amendment-original-text';

  originalTextGroup.appendChild(originalTextLabel);
  originalTextGroup.appendChild(originalTextDisplay);

  // Proposed text input
  const proposedTextGroup = document.createElement('div');
  proposedTextGroup.className = 'amendment-form__group amendment-form__group--hidden';

  const proposedTextLabel = document.createElement('label');
  proposedTextLabel.className = 'amendment-form__label';
  proposedTextLabel.htmlFor = 'amendment-proposed-text';
  proposedTextLabel.textContent = strings.proposedTextLabel;

  const proposedTextArea = document.createElement('textarea');
  proposedTextArea.className = 'amendment-form__textarea';
  proposedTextArea.id = 'amendment-proposed-text';
  proposedTextArea.rows = 6;
  proposedTextArea.placeholder = strings.proposedTextPlaceholder;
  proposedTextArea.required = true;

  proposedTextGroup.appendChild(proposedTextLabel);
  proposedTextGroup.appendChild(proposedTextArea);

  // Rationale input (optional)
  const rationaleGroup = document.createElement('div');
  rationaleGroup.className = 'amendment-form__group amendment-form__group--hidden';

  const rationaleLabel = document.createElement('label');
  rationaleLabel.className = 'amendment-form__label';
  rationaleLabel.htmlFor = 'amendment-rationale';
  rationaleLabel.textContent = strings.rationaleLabel;

  const rationaleTextArea = document.createElement('textarea');
  rationaleTextArea.className = 'amendment-form__textarea';
  rationaleTextArea.id = 'amendment-rationale';
  rationaleTextArea.rows = 4;
  rationaleTextArea.placeholder = strings.rationalePlaceholder;

  rationaleGroup.appendChild(rationaleLabel);
  rationaleGroup.appendChild(rationaleTextArea);

  // Submit button
  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'amendment-form__button-group';

  const submitBtn = createButton({
    text: strings.submitButton,
    variant: 'primary',
    size: 'large',
    type: 'submit'
  });

  buttonGroup.appendChild(submitBtn.element);

  // Assemble form
  form.appendChild(sectionGroup);
  form.appendChild(originalTextGroup);
  form.appendChild(proposedTextGroup);
  form.appendChild(rationaleGroup);
  form.appendChild(buttonGroup);

  container.appendChild(form);

  // Section change handler - show/hide text fields
  let selectedSectionText = '';

  sectionSelect.addEventListener('change', () => {
    const selectedOption = sectionSelect.options[sectionSelect.selectedIndex];
    
    if (selectedOption.value) {
      selectedSectionText = selectedOption.dataset.text || '';
      originalTextDisplay.textContent = selectedSectionText;
      
      // Show text input groups
      originalTextGroup.classList.remove('amendment-form__group--hidden');
      proposedTextGroup.classList.remove('amendment-form__group--hidden');
      rationaleGroup.classList.remove('amendment-form__group--hidden');
    } else {
      // Hide text input groups
      originalTextGroup.classList.add('amendment-form__group--hidden');
      proposedTextGroup.classList.add('amendment-form__group--hidden');
      rationaleGroup.classList.add('amendment-form__group--hidden');
      selectedSectionText = '';
    }
  });

  // Form submission handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate inputs
    const sectionId = sectionSelect.value;
    const proposedText = proposedTextArea.value.trim();
    const rationale = rationaleTextArea.value.trim();

    if (!sectionId || !proposedText) {
      showToast(strings.errorRequired, 'error');
      return;
    }

    // Show confirmation modal
    const confirmed = await showAlert({
      title: strings.confirmTitle,
      message: strings.confirmMessage,
      type: 'confirm'
    });

    if (!confirmed) {
      return;
    }

    // Show loading state
    submitBtn.setLoading(true, strings.submittingButton);

    try {
      // Submit amendment
      const response = await submitAmendment(sessionId, {
        section_id: sectionId,
        proposed_text: proposedText,
        rationale: rationale || undefined
      });

      // Success
      showToast(strings.successMessage, 'success');

      // Reset form
      resetForm();

      // Call success callback
      if (onSubmitSuccess && typeof onSubmitSuccess === 'function') {
        onSubmitSuccess(response);
      }

    } catch (error) {
      console.error('Amendment submission error:', error);
      showToast(`${strings.errorSubmission}: ${error.message}`, 'error');
    } finally {
      submitBtn.setLoading(false, strings.submitButton);
    }
  });

  // Reset form to initial state
  function resetForm() {
    form.reset();
    originalTextGroup.classList.add('amendment-form__group--hidden');
    proposedTextGroup.classList.add('amendment-form__group--hidden');
    rationaleGroup.classList.add('amendment-form__group--hidden');
    selectedSectionText = '';
  }

  // Cleanup function
  function destroy() {
    submitBtn.destroy();
    container.remove();
  }

  return {
    element: container,
    reset: resetForm,
    destroy
  };
}
