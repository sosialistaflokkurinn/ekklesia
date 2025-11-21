/**
 * Election Validation Module
 * 
 * Centralized validation logic for election create/edit forms.
 * Extracted from election-create.js for better maintainability and testability.
 */

import { R } from '../../i18n/strings-loader.js';

/**
 * Validate basic election information (step 1: title, question, description)
 * @returns {boolean} True if all basic info is valid
 */
export function validateBasicInfo() {
  const title = document.getElementById('election-title').value.trim();
  const question = document.getElementById('election-question').value.trim();

  if (!title) {
    alert(R.string.validation_title_required);
    return false;
  }

  if (!question) {
    alert(R.string.validation_question_required);
    return false;
  }

  return true;
}

/**
 * Get answer options from the form
 * @returns {string[]} Array of non-empty answer text values
 */
function getAnswers() {
  const answerInputs = document.querySelectorAll('.answer-item input[type="text"]');
  return Array.from(answerInputs)
    .map(input => input.value.trim())
    .filter(val => val); // Remove empty strings
}

/**
 * Validate answer options (step 2: voting type, answers, max selections)
 * @returns {boolean} True if all answers are valid
 */
export function validateAnswerOptions() {
  const answers = getAnswers();

  // Check minimum answers
  if (answers.length < 2) {
    alert(R.string.validation_min_answers);
    return false;
  }

  // Check maximum answers
  if (answers.length > 10) {
    alert(R.string.validation_max_answers);
    return false;
  }

  // Check for empty answers
  const emptyAnswers = answers.filter(a => !a.trim());
  if (emptyAnswers.length > 0) {
    alert(R.string.validation_empty_answer);
    return false;
  }

  // Check for duplicate answers (case-insensitive)
  const uniqueAnswers = new Set(answers.map(a => a.toLowerCase()));
  if (uniqueAnswers.size !== answers.length) {
    alert(R.string.validation_duplicate_answers);
    return false;
  }

  // Validate max selections for multi-choice
  const votingType = document.querySelector('input[name="voting_type"]:checked').value;
  if (votingType === 'multi-choice') {
    const maxSelections = parseInt(document.getElementById('max-selections').value);
    if (!maxSelections || maxSelections < 1 || maxSelections > answers.length) {
      alert(R.format(R.string.validation_max_selections_invalid, answers.length));
      return false;
    }
  }

  return true;
}

/**
 * Validate schedule configuration (step 3: timing, duration, end time)
 * @returns {boolean} True if schedule is valid
 */
export function validateSchedule() {
  const startTiming = document.querySelector('input[name="start_timing"]:checked').value;

  // Validate scheduled start time
  if (startTiming === 'scheduled') {
    const scheduledStart = document.getElementById('scheduled-start').value;
    
    if (!scheduledStart) {
      alert(R.string.validation_scheduled_start_required);
      return false;
    }

    // Check if start time is in the future
    const startDate = new Date(scheduledStart);
    if (startDate <= new Date()) {
      alert(R.string.validation_start_future);
      return false;
    }
  }

  // Validate duration or end time
  const useManualEndTime = document.getElementById('use-manual-end-time').checked;

  if (useManualEndTime) {
    const scheduledEnd = document.getElementById('scheduled-end').value;
    
    if (!scheduledEnd) {
      alert(R.string.validation_scheduled_end_required);
      return false;
    }

    // Check if end time is after start time
    const startDate = startTiming === 'scheduled' 
      ? new Date(document.getElementById('scheduled-start').value)
      : new Date();
    const endDate = new Date(scheduledEnd);

    if (endDate <= startDate) {
      alert(R.string.validation_end_after_start);
      return false;
    }
  } else {
    // Validate duration
    const durationMinutes = parseInt(document.getElementById('duration-minutes').value);
    
    if (!durationMinutes || durationMinutes < 1) {
      alert(R.string.validation_duration_min);
      return false;
    }
  }

  return true;
}

/**
 * Validate based on current wizard step
 * @param {number} step - The step number to validate (1, 2, or 3)
 * @returns {boolean} True if the step is valid
 */
export function validateStep(step) {
  switch (step) {
    case 1:
      return validateBasicInfo();
    case 2:
      return validateAnswerOptions();
    case 3:
      return validateSchedule();
    default:
      return false;
  }
}
