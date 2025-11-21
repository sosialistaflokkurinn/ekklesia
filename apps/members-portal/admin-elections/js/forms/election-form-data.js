/**
 * Election Form Data Module
 * 
 * Handles form data collection, population, and transformation for election forms.
 * Extracted from election-create.js for better organization and reusability.
 */

import { R } from '../../i18n/strings-loader.js';
import { debug } from '../../../js/utils/debug.js';

/**
 * Get answer options from the form
 * @returns {string[]} Array of non-empty answer text values
 */
export function getAnswers() {
  const answerInputs = document.querySelectorAll('.answer-item input[type="text"]');
  return Array.from(answerInputs)
    .map(input => input.value.trim())
    .filter(val => val); // Remove empty strings
}

/**
 * Collect form data from all steps into a single object
 * @param {boolean} isLoadingElectionData - Skip if currently loading data (prevents overwrite)
 * @returns {object|null} Form data object or null if loading
 */
export function collectFormData(isLoadingElectionData = false) {
  // Skip if we're currently loading election data (prevents overwrite)
  if (isLoadingElectionData) {
    debug.log('[Form Data] Skipping data collection (loading in progress)');
    return null;
  }
  
  const formData = {};
  
  // Step 1: Basic Info
  formData.title = document.getElementById('election-title').value.trim();
  formData.question = document.getElementById('election-question').value.trim();
  formData.description = document.getElementById('election-description').value.trim();
  
  // Step 2: Answer Options
  formData.voting_type = document.querySelector('input[name="voting_type"]:checked').value;
  formData.max_selections = formData.voting_type === 'multi-choice' 
    ? parseInt(document.getElementById('max-selections').value) 
    : 1; // Single-choice must have max_selections = 1
  formData.answers = getAnswers();
  
  // Step 3: Schedule
  formData.start_timing = document.querySelector('input[name="start_timing"]:checked').value;
  formData.scheduled_start = formData.start_timing === 'scheduled' 
    ? document.getElementById('scheduled-start').value 
    : null;

  const useManualEndTime = document.getElementById('use-manual-end-time').checked;
  if (useManualEndTime) {
    formData.duration_minutes = null;
    formData.scheduled_end = document.getElementById('scheduled-end').value;
  } else {
    formData.duration_minutes = parseInt(document.getElementById('duration-minutes').value);
    formData.scheduled_end = null;
  }
  
  return formData;
}

/**
 * Build API payload for creating a new election
 * @param {object} formData - Form data object
 * @param {string} status - Election status ('draft' or 'open')
 * @returns {object} API payload
 */
export function buildCreatePayload(formData, status = 'draft') {
  const payload = {
    title: formData.title,
    question: formData.question,
    description: formData.description || null,
    voting_type: formData.voting_type,
    max_selections: formData.max_selections,
    // Transform answers array to API format: [{answer_text, display_order}]
    answers: formData.answers.map((text, index) => ({
      answer_text: text,
      display_order: index
    }))
    // Note: status is NOT included - handled via separate /open endpoint
  };

  // Add schedule if timing is scheduled
  if (formData.start_timing === 'scheduled' && formData.scheduled_start) {
    payload.scheduled_start = formData.scheduled_start;
  }

  // Add duration or end time
  if (formData.scheduled_end) {
    payload.scheduled_end = formData.scheduled_end;
  } else if (formData.duration_minutes) {
    payload.duration_minutes = formData.duration_minutes;
  }

  return payload;
}

/**
 * Build API payload for updating an existing election (metadata-only for published/closed)
 * @param {object} formData - Form data object
 * @param {string} electionStatus - Current election status
 * @returns {object} API payload (full or metadata-only)
 */
export function buildUpdatePayload(formData, electionStatus) {
  // Metadata-only edit for published/closed elections
  if (electionStatus === 'published' || electionStatus === 'closed') {
    return {
      title: formData.title,
      description: formData.description || null
    };
  }

  // Full edit for draft elections
  return buildCreatePayload(formData, electionStatus);
}

/**
 * Populate form fields from an election object
 * @param {object} election - Election data from API
 * @param {Function} setLoadingFlag - Function to set loading flag (true before, false after)
 */
export function populateFormFromElection(election, setLoadingFlag) {
  // Set loading flag to prevent updateFormData from running during load
  setLoadingFlag(true);

  try {
    // Step 1: Basic Info
    document.getElementById('election-title').value = election.title || '';
    document.getElementById('election-question').value = election.question || '';
    document.getElementById('election-description').value = election.description || '';

    // Step 2: Answer Options
    const votingTypeRadio = document.querySelector(`input[name="voting_type"][value="${election.voting_type}"]`);
    if (votingTypeRadio) {
      votingTypeRadio.checked = true;
      
      // Show/hide max selections based on voting type
      const maxSelectionsGroup = document.getElementById('max-selections-group');
      if (election.voting_type === 'multi-choice') {
        maxSelectionsGroup.style.display = 'block';
        document.getElementById('max-selections').value = election.max_selections || 1;
      } else {
        maxSelectionsGroup.style.display = 'none';
      }
    }

    // Populate answers
    const answersContainer = document.getElementById('answers-container');
    answersContainer.innerHTML = ''; // Clear existing
    
    if (election.answers && election.answers.length > 0) {
      election.answers.forEach((answer, index) => {
        const answerItem = document.createElement('div');
        answerItem.className = 'answer-item';
        answerItem.innerHTML = `
          <span class="answer-item__drag-handle">⋮⋮</span>
          <input 
            type="text" 
            class="answer-item__input form-control" 
            value="${answer.text}"
            placeholder="${R.format(R.string.placeholder_answer, index + 1)}"
            maxlength="200"
            required
          >
          <button type="button" class="answer-item__remove-btn">${R.string.btn_remove_answer}</button>
        `;
        answersContainer.appendChild(answerItem);
      });
    }

    // Step 3: Schedule
    const startTiming = election.scheduled_start ? 'scheduled' : 'immediate';
    const startTimingRadio = document.querySelector(`input[name="start_timing"][value="${startTiming}"]`);
    if (startTimingRadio) {
      startTimingRadio.checked = true;
      
      // Show/hide scheduled start based on timing
      const scheduledStartGroup = document.getElementById('scheduled-start-group');
      if (startTiming === 'scheduled') {
        scheduledStartGroup.style.display = 'block';
        document.getElementById('scheduled-start').value = election.scheduled_start || '';
      } else {
        scheduledStartGroup.style.display = 'none';
      }
    }

    // Duration or end time
    if (election.scheduled_end) {
      document.getElementById('use-manual-end-time').checked = true;
      document.getElementById('manual-end-time-group').style.display = 'block';
      document.getElementById('scheduled-end').value = election.scheduled_end;
      document.getElementById('duration-group').style.display = 'none';
    } else if (election.duration_minutes) {
      document.getElementById('use-manual-end-time').checked = false;
      document.getElementById('duration-group').style.display = 'block';
      document.getElementById('duration-minutes').value = election.duration_minutes;
      document.getElementById('manual-end-time-group').style.display = 'none';
    }

  } finally {
    // Always clear loading flag, even if error occurs
    setLoadingFlag(false);
  }
}
