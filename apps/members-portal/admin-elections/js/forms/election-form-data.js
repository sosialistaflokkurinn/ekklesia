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

  // Note: Schedule options (start timing, duration) are now configured when opening
  // the election from the elections list, not in the create/edit wizard.

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
    // Note: Schedule options are configured when opening from elections list
  };

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

    // Note: Schedule options are now configured when opening from elections list

  } finally {
    // Always clear loading flag, even if error occurs
    setLoadingFlag(false);
  }
}
