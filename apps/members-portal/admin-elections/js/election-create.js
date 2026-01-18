/**
 * Election Creation Wizard
 * Multi-step form for creating elections
 *
 * Module cleanup not needed - page reloads on navigation.
 * i18n: Strings loaded by HTML before this module - initI18n not needed here.
 */

import { getFirebaseAuth } from '../../firebase/app.js';
import { getElectionRole, requireAdmin, hasPermission, PERMISSIONS } from '../../js/rbac.js';
import { R } from '../i18n/strings-loader.js';
import { debug } from '../../js/utils/util-debug.js';
import { getAdminElectionById } from '../../js/api/api-elections.js';
import { formatDateTime, formatDateOnly, formatTimeInput } from './date-utils.js';
import { showModal } from '../../js/components/ui-modal.js';
import { el } from '../../js/utils/util-dom.js';
import { escapeHTML } from '../../js/utils/util-format.js';

// Refactored modules (Phase 2)
import { validateBasicInfo, validateAnswerOptions, validateSchedule, validateStep } from './validation/election-validation.js';
import { collectFormData, buildCreatePayload, buildUpdatePayload, populateFormFromElection, getAnswers } from './forms/election-form-data.js';
import { createElection, updateElection, fetchElection, openElection } from './api/elections-admin-api.js';

const auth = getFirebaseAuth();

// Constants
const DOM_INIT_DELAY_MS = 100; // Time for wizard to initialize DOM elements

// ============================================
// STATE
// ============================================

let currentStep = 1;
const totalSteps = 3;  // Reduced: Basic Info, Answers, Review (Schedule moved to "Open" action)
let isEditMode = false;
let editingElectionId = null;
let editingElectionStatus = 'draft'; // Track status of election being edited
let isLoadingElectionData = false; // Flag to prevent updateFormData during load

// Form data
const formData = {
  title: '',
  question: '',
  description: '',
  voting_type: 'single-choice',
  max_selections: null,
  num_seats: null,
  answers: [],
  start_timing: 'immediate',
  scheduled_start: null,
  duration_minutes: 60,
  scheduled_end: null
};

// ============================================
// URL PARAMETERS
// ============================================

/**
 * Get election ID from URL query parameter (for edit mode)
 * @returns {string|null} Election UUID or null if not present
 */
function getElectionIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Check authentication and role
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = '/session/login.html';
      return;
    }

    try {
      // Require admin role
      await requireAdmin();
      
      // Check create permission
      const canCreate = await hasPermission(PERMISSIONS.CREATE_ELECTION);
      if (!canCreate) {
        alert(R.string.error_not_authorized || 'Þú hefur ekki heimild til að stofna kosningar.');
        window.location.href = '/admin-elections/';
        return;
      }

      // Get election role
      const electionRole = await getElectionRole();
      debug.log('[Create Election] User has election role:', electionRole);

      // Show user role
      const roleIndicator = document.getElementById('user-role-indicator');
      if (roleIndicator) {
        roleIndicator.textContent = electionRole === 'superadmin' ? '👑 Superadmin' : '📊 Election Manager';
        roleIndicator.className = `role-indicator role-${electionRole}`;
      }

      // Initialize wizard
      const electionId = getElectionIdFromURL();
      initWizard(electionId); // Pass electionId to skip initial answers in edit mode
      
      // Check if we're in edit mode (wait for DOM to be ready)
      if (electionId) {
        // Give wizard time to initialize DOM elements
        setTimeout(async () => {
          await loadElectionForEdit(electionId);
        }, DOM_INIT_DELAY_MS);
      }
    } catch (error) {
      console.error('[Create Election] Authorization error:', error);
      // requireAdmin already handles redirect
    }
  });
});

// ============================================
// WIZARD INITIALIZATION
// ============================================

function initWizard(electionId) {
  // Initialize answer options (start with 2) - ONLY in create mode
  // In edit mode, answers will be populated by loadElectionForEdit()
  if (!electionId) {
    debug.log('[Create Election] Initializing with 2 empty answers (create mode)');
    addAnswerOption();
    addAnswerOption();
  } else {
    debug.log('[Create Election] Skipping initial answers (edit mode - will load from API)');
  }

  // Step navigation
  document.getElementById('next-btn').addEventListener('click', handleNext);
  document.getElementById('prev-btn').addEventListener('click', handlePrev);

  // Form submission - only draft creation from wizard
  // (Opening election is done from elections list)
  document.getElementById('create-draft-btn').addEventListener('click', () => handleSubmit('draft'));

  // Voting type change
  document.querySelectorAll('input[name="voting_type"]').forEach(radio => {
    radio.addEventListener('change', handleVotingTypeChange);
  });

  // Add answer button
  document.getElementById('add-answer-btn').addEventListener('click', addAnswerOption);

  // Note: Schedule-related event listeners removed - schedule is now configured when opening election

  // Update progress on form changes
  document.getElementById('election-wizard-form').addEventListener('input', updateFormData);

  // Initialize first step display
  showStep(1);
  debug.log('[Create Election] Wizard initialized, showing step 1');
}

/**
 * Load election data for editing
 */
// ============================================
// EDIT MODE
// ============================================

/**
 * Load election data for editing in the wizard
 * 
 * Fetches election from Admin API, validates it's a draft, and populates
 * all form fields with existing data. Also updates UI for edit mode.
 * 
 * @param {string} electionId - UUID of the election to edit
 * @returns {Promise<void>}
 * @throws {Error} If election not found or not in draft status
 * 
 * @example
 * await loadElectionForEdit('c027a4a7-c32c-49fe-9ec4-f03a1170a1d2');
 */
async function loadElectionForEdit(electionId) {
  try {
    // Set flag to prevent updateFormData from overwriting during load
    isLoadingElectionData = true;
    debug.log('[Create Election] Loading election for edit:', electionId);
    debug.log('[Create Election] isLoadingElectionData flag set to TRUE');
    
    // Fetch election data
    const election = await getAdminElectionById(electionId);
    debug.log('[Create Election] Raw election data:', election);
    
    // Store election status for field restrictions
    const electionStatus = election.status || 'draft';
    const isDraft = electionStatus === 'draft';
    
    // Set edit mode
    isEditMode = true;
    editingElectionId = electionId;
    editingElectionStatus = electionStatus; // Store status globally
    
    // Update page title
    const pageTitle = document.querySelector('h1');
    if (pageTitle) {
      pageTitle.textContent = R.string.page_title_edit_election || 'Breyta kosningu';
    }
    
    // Populate form data
    formData.title = election.title || '';
    formData.question = election.question || '';
    formData.description = election.description || '';
    formData.voting_type = election.voting_type || 'single-choice';
    formData.max_selections = election.max_selections || null;
    
    // Handle answers - API may return different formats
    debug.log('[Create Election] Raw answers from API:', election.answers);
    if (election.answers && Array.isArray(election.answers)) {
      formData.answers = election.answers.map(ans => {
        debug.log('[Create Election] Processing answer:', ans);
        // Handle object formats: {text: "..."}, {answer_text: "..."}, or string directly
        if (typeof ans === 'string') {
          return ans;
        } else if (ans && typeof ans === 'object') {
          return ans.text || ans.answer_text || ans.answer || JSON.stringify(ans);
        }
        return String(ans);
      });
      debug.log('[Create Election] Mapped answers:', formData.answers);
    } else {
      formData.answers = [];
    }
    
    formData.duration_minutes = election.duration_minutes || 60;
    
    debug.log('[Create Election] Processed formData:', formData);
    
    // Populate form fields
    document.getElementById('election-title').value = formData.title;
    document.getElementById('election-question').value = formData.question;
    document.getElementById('election-description').value = formData.description;
    
    // Set voting type
    const votingTypeRadio = document.querySelector(`input[name="voting_type"][value="${formData.voting_type}"]`);
    if (votingTypeRadio) {
      votingTypeRadio.checked = true;
      handleVotingTypeChange({ target: votingTypeRadio });
    }
    
    // Set max selections if multi-choice
    if (formData.voting_type === 'multi-choice' && formData.max_selections) {
      document.getElementById('max-selections').value = formData.max_selections;
    }
    
    // Populate answers
    const answersContainer = document.getElementById('answers-container');
    
    if (!answersContainer) {
      console.error('[Create Election] answers-container not found in DOM!');
      throw new Error('Answer options container not found. Page may not be fully loaded.');
    }
    
    debug.log('[Create Election] Clearing answers container (had', answersContainer.children.length, 'children)');
    answersContainer.innerHTML = ''; // Clear any existing answers
    
    if (formData.answers.length > 0) {
      debug.log('[Create Election] Adding', formData.answers.length, 'answers from loaded election');
      formData.answers.forEach((answerText, index) => {
        debug.log(`[Create Election] Adding answer ${index + 1}:`, answerText);
        addAnswerOption();
        const inputs = document.querySelectorAll('#answers-container .answer-item input');
        const lastInput = inputs[inputs.length - 1];
        if (lastInput) {
          lastInput.value = answerText;
          debug.log(`[Create Election] Set input value to:`, lastInput.value);
        } else {
          console.error('[Create Election] Could not find input for answer:', answerText);
        }
      });
    } else {
      debug.log('[Create Election] No answers in election data, adding 2 empty');
      // Add 2 empty answers if none exist
      addAnswerOption();
      addAnswerOption();
    }
    
    // Note: duration-minutes field removed - schedule is now configured when opening election

    // Disable core fields if election is not draft
    if (!isDraft) {
      debug.log('[Create Election] Election is', electionStatus, '- disabling core fields');
      
      // Disable question field
      const questionField = document.getElementById('election-question');
      if (questionField) {
        questionField.disabled = true;
        questionField.title = 'Ekki er hægt að breyta spurningu fyrir opnaða/lokaða kosningu';
      }
      
      // Disable voting type radio buttons
      document.querySelectorAll('input[name="voting_type"]').forEach(radio => {
        radio.disabled = true;
      });
      
      // Disable max selections
      const maxSelectionsField = document.getElementById('max-selections');
      if (maxSelectionsField) {
        maxSelectionsField.disabled = true;
      }
      
      // Disable all answer inputs and remove buttons
      document.querySelectorAll('#answers-container .answer-item input').forEach(input => {
        input.disabled = true;
        input.title = 'Ekki er hægt að breyta svarmöguleikum fyrir opnaða/lokaða kosningu';
      });
      document.querySelectorAll('#answers-container .answer-item .remove-answer').forEach(btn => {
        btn.style.display = 'none';
      });
      
      // Hide "Bæta við svarmöguleika" button
      const addAnswerBtn = document.getElementById('add-answer-btn');
      if (addAnswerBtn) {
        addAnswerBtn.style.display = 'none';
      }
      
      // Add warning message
      const step3Container = document.querySelector('.wizard-step[data-step="3"]');
      if (step3Container && !step3Container.querySelector('.edit-restriction-warning')) {
        const statusText = electionStatus === 'published' ? R.string.status_open : R.string.status_closed;
        const warning = el('div', 'alert alert-warning edit-restriction-warning', { style: 'margin-bottom: 1rem;' },
          el('strong', '', {}, R.string.edit_restriction_title),
          el('br'),
          R.string.edit_restriction_message.replace('%s', statusText)
        );
        step3Container.insertBefore(warning, step3Container.firstChild);
      }
    }
    
    // Update button text for edit mode
    // NOTE: Declare variables BEFORE using them (avoid ReferenceError)
    const createDraftBtn = document.getElementById('create-draft-btn');
    const createOpenBtn = document.getElementById('create-open-btn');
    
    if (createDraftBtn) {
      createDraftBtn.textContent = R.string.btn_save_changes || 'Vista breytingar';
    }
    
    // In edit mode, hide "Vista og opna" button entirely
    // Users should use the separate "Opna" button from elections list
    if (createOpenBtn) {
      createOpenBtn.style.display = 'none';
      debug.log('[Create Election] Hiding "Vista og opna" button (edit mode)');
    }
    
    debug.log('[Create Election] Election loaded for editing successfully');
    debug.log('[Create Election] Final form state - Title:', document.getElementById('election-title').value);
    debug.log('[Create Election] Final form state - Question:', document.getElementById('election-question').value);
    debug.log('[Create Election] Final form state - Answers:', Array.from(document.querySelectorAll('#answers-container .answer-item input')).map(i => i.value));
    debug.log('[Create Election] Final form state - Current wizard step:', currentStep);
    
    // Clear loading flag - allow updateFormData to work normally now
    isLoadingElectionData = false;
    debug.log('[Create Election] isLoadingElectionData flag set to FALSE (load complete)');
    
  } catch (error) {
    // Clear loading flag on error too
    isLoadingElectionData = false;
    debug.log('[Create Election] isLoadingElectionData flag set to FALSE (error occurred)');
    
    console.error('[Create Election] Error loading election:', error);
    console.error('[Create Election] Error details:', error.message, error.stack);
    alert((R.string.error_load_election || 'Villa kom upp við að hlaða kosningu.') + '\n\n' + (error.message || ''));
    window.location.href = '/admin-elections/';
  }
}

// ============================================
// NAVIGATION
// ============================================

function handleNext() {
  if (!validateCurrentStep()) {
    return;
  }

  updateFormData();

  if (currentStep < totalSteps) {
    currentStep++;
    showStep(currentStep);
  }
}

function handlePrev() {
  if (currentStep > 1) {
    currentStep--;
    showStep(currentStep);
  }
}

function showStep(step) {
  // Hide all steps - use classList for reliability
  document.querySelectorAll('.wizard-content').forEach(content => {
    content.classList.add('hidden');
    content.style.display = '';  // Clear inline style
  });

  // Show current step - remove hidden class
  const currentContent = document.querySelector(`.wizard-content[data-step="${step}"]`);
  if (currentContent) {
    currentContent.classList.remove('hidden');
    currentContent.style.display = '';  // Clear inline style, let CSS handle it
  }

  // Update progress indicators
  document.querySelectorAll('.wizard-step').forEach((stepEl, index) => {
    stepEl.classList.remove('active', 'completed');
    if (index + 1 === step) {
      stepEl.classList.add('active');
    } else if (index + 1 < step) {
      stepEl.classList.add('completed');
    }
  });

  // Update navigation buttons - use classList for reliability
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const createDraftBtn = document.getElementById('create-draft-btn');

  // Previous button: show on steps 2+
  prevBtn.classList.toggle('hidden', step <= 1);
  prevBtn.style.display = '';

  // Next button: show on steps 1-2 (not on final review step)
  nextBtn.classList.toggle('hidden', step >= totalSteps);
  nextBtn.style.display = '';

  // Create draft button: show on final step (step 3)
  createDraftBtn.classList.toggle('hidden', step !== totalSteps);
  createDraftBtn.style.display = '';

  // Update review if on last step
  if (step === totalSteps) {
    updateReview();
  }
}

// ============================================
// VALIDATION
// ============================================

/**
/**
 * Validate the current wizard step
 * @returns {boolean} True if validation passes
 */
function validateCurrentStep() {
  if (currentStep === 3) {
    return true; // Review step (step 3), no validation
  }

  // Use imported validation module - only steps 1 and 2 need validation
  return validateStep(currentStep);
}

// ============================================
// FORM DATA MANAGEMENT
// ============================================

/**
 * Update formData from current form state
 * Uses imported collectFormData() from forms module
 */
function updateFormData() {
  const collectedData = collectFormData(isLoadingElectionData);
  
  if (collectedData) {
    // Update global formData object with collected data
    Object.assign(formData, collectedData);
  }
}

// Note: getAnswers() is now imported from forms/election-form-data.js

// ============================================
// ANSWER OPTIONS
// ============================================

function addAnswerOption() {
  const container = document.getElementById('answers-container');
  const answerCount = container.querySelectorAll('.answer-item').length;

  if (answerCount >= 10) {
    alert(R.string.validation_max_answers_alert);
    return;
  }

  const removeBtn = el('button', 'answer-item__remove-btn', { type: 'button' }, R.string.btn_remove_answer);
  
  const answerItem = el('div', 'answer-item', {},
    el('span', 'answer-item__drag-handle', {}, '⋮⋮'),
    el('input', 'answer-item__input form-control', {
      type: 'text',
      placeholder: R.format(R.string.placeholder_answer, answerCount + 1),
      maxlength: '200',
      required: true
    }),
    removeBtn
  );

  // Remove button handler
  removeBtn.addEventListener('click', () => {
    const answerCount = container.querySelectorAll('.answer-item').length;
    if (answerCount <= 2) {
      alert(R.string.validation_min_answers_alert);
      return;
    }
    answerItem.remove();
    updateAnswerPlaceholders();
  });

  container.appendChild(answerItem);
  updateAnswerPlaceholders();
}

function updateAnswerPlaceholders() {
  const answerInputs = document.querySelectorAll('.answer-item input[type="text"]');
  answerInputs.forEach((input, index) => {
    input.placeholder = R.format(R.string.placeholder_answer, index + 1);
  });
}

// ============================================
// EVENT HANDLERS
// ============================================

function handleVotingTypeChange(e) {
  const maxSelectionsGroup = document.getElementById('max-selections-group');
  const numSeatsGroup = document.getElementById('num-seats-group');

  maxSelectionsGroup.classList.toggle('hidden', e.target.value !== 'multi-choice');
  numSeatsGroup.classList.toggle('hidden', e.target.value !== 'ranked-choice');
}

function handleStartTimingChange(e) {
  const scheduledStartGroup = document.getElementById('scheduled-start-group');
  scheduledStartGroup.classList.toggle('hidden', e.target.value !== 'scheduled');
}

function handleDurationClick(e) {
  const btn = e.target;
  const minutes = btn.dataset.minutes;

  // Remove active from all buttons
  document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const customDurationGroup = document.getElementById('custom-duration-group');
  const durationInput = document.getElementById('duration-minutes');
  const manualEndTimeCheckbox = document.getElementById('use-manual-end-time');

  if (minutes === 'custom') {
    customDurationGroup.classList.remove('hidden');
    durationInput.value = '';
  } else {
    customDurationGroup.classList.add('hidden');
    durationInput.value = minutes;
  }

  // Uncheck manual end time
  manualEndTimeCheckbox.checked = false;
  document.getElementById('manual-end-time-group').classList.add('hidden');
}

// Handle custom duration input
document.addEventListener('DOMContentLoaded', () => {
  const customDurationInput = document.getElementById('custom-duration');
  if (customDurationInput) {
    customDurationInput.addEventListener('input', (e) => {
      document.getElementById('duration-minutes').value = e.target.value;
    });
  }
});

// ============================================
// REVIEW
// ============================================

function updateReview() {
  updateFormData();

  // Basic Info
  document.getElementById('review-title').textContent = formData.title || '-';
  document.getElementById('review-question').textContent = formData.question || '-';
  document.getElementById('review-description').innerHTML = formData.description
    ? escapeHTML(formData.description)
    : `<em>${R.string.review_no_description}</em>`;

  // Answer Options
  let votingTypeText;
  if (formData.voting_type === 'single-choice') {
    votingTypeText = R.string.voting_type_single;
  } else if (formData.voting_type === 'multi-choice') {
    votingTypeText = R.string.voting_type_multi;
  } else if (formData.voting_type === 'ranked-choice') {
    votingTypeText = R.string.voting_type_ranked;
  }
  document.getElementById('review-voting-type').textContent = votingTypeText;

  let maxSelectionsText;
  if (formData.voting_type === 'multi-choice') {
    maxSelectionsText = R.format(R.string.duration_max_selections, formData.max_selections);
  } else if (formData.voting_type === 'ranked-choice') {
    maxSelectionsText = R.format(R.string.label_num_seats + ': %d', formData.num_seats || 1);
  } else {
    maxSelectionsText = R.string.duration_one_selection;
  }
  document.getElementById('review-max-selections').textContent = maxSelectionsText;

  // Securely build answer list using DOM API to prevent XSS
  const reviewAnswersList = document.getElementById('review-answers');
  reviewAnswersList.innerHTML = ''; // Clear existing content

  if (formData.answers && formData.answers.length > 0) {
    formData.answers.forEach(answer => {
      reviewAnswersList.appendChild(el('li', '', {}, answer));
    });
  } else {
    reviewAnswersList.appendChild(
      el('li', '', {}, el('em', '', {}, R.string.review_no_answers))
    );
  }

  // Note: Schedule section removed - now configured when opening election from list
}

// Date formatting is now handled by date-utils.js module

function formatDuration(minutes) {
  if (!minutes) return '-';
  if (minutes < 60) {
    return R.format(R.string.duration_minutes, minutes);
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return hours === 1 
      ? R.format(R.string.duration_hour, hours)
      : R.format(R.string.duration_hours, hours);
  }
  return R.format(R.string.duration_hour_minutes, hours, remainingMinutes);
}

// ============================================
// SUBMISSION
// ============================================

/**
 * Handle form submission (create or update election)
 * Uses imported API client from api/elections-admin-api.js
 * @param {string} status - Election status ('draft' or 'open')
 * @returns {Promise<void>}
 */
async function handleSubmit(status) {
  // Update form data from UI inputs (skips if loading)
  updateFormData();

  // For closed/published elections, skip validation (we're only updating metadata)
  // For draft elections or new elections, run full validation
  const shouldValidate = !isEditMode || editingElectionStatus === 'draft';
  
  if (shouldValidate) {
    // Final validation
    if (!validateCurrentStep()) {
      return;
    }
  } else {
    debug.log('[Election Create] Skipping validation for', editingElectionStatus, 'election (metadata-only edit)');
  }

  // Show warning if editing published/closed election
  if (isEditMode && editingElectionStatus !== 'draft') {
    const statusText = editingElectionStatus === 'published' ? R.string.status_open_dative : R.string.status_closed_dative;
    const confirmed = await showModal({
      title: R.string.edit_confirm_title.replace('%s', statusText),
      message: `
        <p>${R.string.edit_confirm_message_p1.replace('%s', statusText)}</p>
        <p>${R.string.edit_confirm_message_p2}</p>
        <p>${R.string.edit_confirm_message_p3}</p>
        <p>${R.string.edit_confirm_message_p4}</p>
      `,
      confirmText: 'Já, vista breytingar',
      cancelText: 'Hætta við'
    });
    
    if (!confirmed) {
      debug.log('[Election Create] User cancelled edit of', editingElectionStatus, 'election');
      return;
    }
  }

  // Build request payload using imported buildCreatePayload or buildUpdatePayload
  let payload;
  
  if (isEditMode) {
    // Update existing election
    payload = buildUpdatePayload(formData, editingElectionStatus);
    debug.log('[Election Create] Update payload:', payload);
  } else {
    // Create new election
    payload = buildCreatePayload(formData, 'draft'); // Always create as draft first
    debug.log('[Election Create] Create payload:', payload);
  }

  // Show loading
  document.getElementById('loading-overlay').style.display = 'flex';

  try {
    let result;
    let finalElectionId;
    
    if (isEditMode) {
      // Update existing election
      result = await updateElection(editingElectionId, payload);
      finalElectionId = editingElectionId;
    } else {
      // Create new election
      result = await createElection(payload);
      finalElectionId = result.election?.id;
    }

    // If status is 'open', make separate API call to open the election
    if (status === 'open' && finalElectionId) {
      debug.log(`[Election Create] Opening election via /elections/${finalElectionId}/open`);
      
      try {
        await openElection(finalElectionId);
        debug.log('[Election Create] Election opened successfully');
        
      } catch (openError) {
        console.error('[Election Create] Error opening election:', openError);
        
        // Show warning but don't fail entire operation
        alert(`Kosning var búin til en ekki opnuð: ${openError.message}\n\nÞú getur opnað hana handvirkt úr kosningalistanum.`);
        window.location.href = '/admin-elections/';
        return;
      }
    }

    // Success!
    const successMessage = isEditMode
      ? (R.string.success_election_updated || 'Kosningu breytt!')
      : (status === 'draft' ? R.string.success_draft_created : R.string.success_election_created);
    
    alert(successMessage);
    window.location.href = '/admin-elections/';

  } catch (error) {
    // Error already logged and shown in modal by API client
    console.error('[Election Create] Operation failed:', error.message);
    
  } finally {
    document.getElementById('loading-overlay').style.display = 'none';
  }
}
