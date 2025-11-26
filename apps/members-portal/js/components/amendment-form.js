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
import { R } from '../../i18n/strings-loader.js';
import { submitAmendment } from '../api/elections-api.js';
import { el } from '../utils/dom.js';

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

  // Create form elements
  const sectionSelect = el('select', 'amendment-form__select', {
    id: 'amendment-section-select',
    required: true
  }, el('option', '', { value: '', disabled: true, selected: true }, strings.sectionPlaceholder));

  // Add section options
  sections.forEach(section => {
    sectionSelect.appendChild(el('option', '', {
      value: section.id,
      'data-text': section.text
    }, section.heading));
  });

  const sectionGroup = el('div', 'amendment-form__group', {},
    el('label', 'amendment-form__label', { htmlFor: 'amendment-section-select' }, strings.sectionLabel),
    sectionSelect
  );

  const originalTextDisplay = el('div', 'amendment-form__original-text', { id: 'amendment-original-text' });
  const originalTextGroup = el('div', 'amendment-form__group amendment-form__group--hidden', {},
    el('label', 'amendment-form__label', { htmlFor: 'amendment-original-text' }, strings.originalTextLabel),
    originalTextDisplay
  );

  const proposedTextArea = el('textarea', 'amendment-form__textarea', {
    id: 'amendment-proposed-text',
    rows: 6,
    placeholder: strings.proposedTextPlaceholder,
    required: true
  });
  const proposedTextGroup = el('div', 'amendment-form__group amendment-form__group--hidden', {},
    el('label', 'amendment-form__label', { htmlFor: 'amendment-proposed-text' }, strings.proposedTextLabel),
    proposedTextArea
  );

  const rationaleTextArea = el('textarea', 'amendment-form__textarea', {
    id: 'amendment-rationale',
    rows: 4,
    placeholder: strings.rationalePlaceholder
  });
  const rationaleGroup = el('div', 'amendment-form__group amendment-form__group--hidden', {},
    el('label', 'amendment-form__label', { htmlFor: 'amendment-rationale' }, strings.rationaleLabel),
    rationaleTextArea
  );

  const submitBtn = createButton({
    text: strings.submitButton,
    variant: 'primary',
    size: 'large',
    type: 'submit'
  });
  const buttonGroup = el('div', 'amendment-form__button-group', {}, submitBtn.element);

  const form = el('form', 'amendment-form__form', {},
    sectionGroup,
    originalTextGroup,
    proposedTextGroup,
    rationaleGroup,
    buttonGroup
  );

  const container = el('div', 'amendment-form', {}, form);

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
      debug.error('Amendment submission error:', error);
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
