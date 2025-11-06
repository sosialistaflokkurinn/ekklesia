/**
 * Election Creation Wizard
 * Multi-step form for creating elections
 */

import { auth } from '../../firebase/firebase-init.js';
import { getCurrentUserRole, requireRole } from './rbac.js';
import { R } from '../../i18n/strings-loader.js';

// Load i18n strings
await R.load('is');

// ============================================
// STATE
// ============================================

let currentStep = 1;
const totalSteps = 4;

// Form data
const formData = {
  title: '',
  question: '',
  description: '',
  voting_type: 'single-choice',
  max_selections: null,
  answers: [],
  start_timing: 'immediate',
  scheduled_start: null,
  duration_minutes: 60,
  scheduled_end: null
};

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

    // Require election-manager or superadmin
    const userRole = await getCurrentUserRole();
    if (!userRole || !['election-manager', 'superadmin'].includes(userRole)) {
      alert(R.string.validation_not_authorized);
      window.location.href = '/admin-elections/';
      return;
    }

    // Show user role
    const roleIndicator = document.getElementById('user-role-indicator');
    if (roleIndicator) {
      roleIndicator.textContent = userRole === 'superadmin' ? '👑 Superadmin' : '📊 Election Manager';
      roleIndicator.className = `role-indicator role-${userRole}`;
    }

    // Initialize wizard
    initWizard();
  });
});

// ============================================
// WIZARD INITIALIZATION
// ============================================

function initWizard() {
  // Initialize answer options (start with 2)
  addAnswerOption();
  addAnswerOption();

  // Step navigation
  document.getElementById('next-btn').addEventListener('click', handleNext);
  document.getElementById('prev-btn').addEventListener('click', handlePrev);

  // Form submission
  document.getElementById('create-draft-btn').addEventListener('click', () => handleSubmit('draft'));
  document.getElementById('create-open-btn').addEventListener('click', () => handleSubmit('open'));

  // Voting type change
  document.querySelectorAll('input[name="voting_type"]').forEach(radio => {
    radio.addEventListener('change', handleVotingTypeChange);
  });

  // Start timing change
  document.querySelectorAll('input[name="start_timing"]').forEach(radio => {
    radio.addEventListener('change', handleStartTimingChange);
  });

  // Add answer button
  document.getElementById('add-answer-btn').addEventListener('click', addAnswerOption);

  // Duration buttons
  document.querySelectorAll('.duration-btn').forEach(btn => {
    btn.addEventListener('click', handleDurationClick);
  });

  // Manual end time toggle
  document.getElementById('use-manual-end-time').addEventListener('change', (e) => {
    document.getElementById('manual-end-time-group').style.display = e.target.checked ? 'block' : 'none';
    document.getElementById('custom-duration-group').style.display = 'none';
    document.querySelector('.duration-btn.active')?.classList.remove('active');
  });

  // Update progress on form changes
  document.getElementById('election-wizard-form').addEventListener('input', updateFormData);
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
  // Hide all steps
  document.querySelectorAll('.wizard-content').forEach(content => {
    content.style.display = 'none';
  });

  // Show current step
  const currentContent = document.querySelector(`.wizard-content[data-step="${step}"]`);
  if (currentContent) {
    currentContent.style.display = 'block';
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

  // Update navigation buttons
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const createDraftBtn = document.getElementById('create-draft-btn');
  const createOpenBtn = document.getElementById('create-open-btn');

  prevBtn.style.display = step > 1 ? 'block' : 'none';
  nextBtn.style.display = step < totalSteps ? 'block' : 'none';
  createDraftBtn.style.display = step === totalSteps ? 'block' : 'none';
  createOpenBtn.style.display = step === totalSteps ? 'block' : 'none';

  // Update review if on last step
  if (step === totalSteps) {
    updateReview();
  }
}

// ============================================
// VALIDATION
// ============================================

function validateCurrentStep() {
  switch (currentStep) {
    case 1:
      return validateBasicInfo();
    case 2:
      return validateAnswerOptions();
    case 3:
      return validateSchedule();
    case 4:
      return true; // Review step, no validation
    default:
      return false;
  }
}

function validateBasicInfo() {
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

function validateAnswerOptions() {
  const answers = getAnswers();

  if (answers.length < 2) {
    alert(R.string.validation_min_answers);
    return false;
  }

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

  // Check for duplicate answers
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

function validateSchedule() {
  const startTiming = document.querySelector('input[name="start_timing"]:checked').value;

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
    const durationMinutes = parseInt(document.getElementById('duration-minutes').value);
    if (!durationMinutes || durationMinutes < 5) {
      alert(R.string.validation_duration_min);
      return false;
    }
  }

  return true;
}

// ============================================
// FORM DATA MANAGEMENT
// ============================================

function updateFormData() {
  formData.title = document.getElementById('election-title').value.trim();
  formData.question = document.getElementById('election-question').value.trim();
  formData.description = document.getElementById('election-description').value.trim();
  formData.voting_type = document.querySelector('input[name="voting_type"]:checked').value;
  formData.max_selections = formData.voting_type === 'multi-choice' 
    ? parseInt(document.getElementById('max-selections').value) 
    : null;
  formData.answers = getAnswers();
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
}

function getAnswers() {
  const answerInputs = document.querySelectorAll('.answer-item input[type="text"]');
  return Array.from(answerInputs).map(input => input.value.trim()).filter(val => val);
}

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

  const answerItem = document.createElement('div');
  answerItem.className = 'answer-item';
  answerItem.innerHTML = `
    <span class="drag-handle">⋮⋮</span>
    <input 
      type="text" 
      class="form-control" 
      placeholder="${R.format(R.string.placeholder_answer, answerCount + 1)}"
      maxlength="200"
      required
    >
    <button type="button" class="remove-answer-btn">${R.string.btn_remove_answer}</button>
  `;

  // Remove button handler
  answerItem.querySelector('.remove-answer-btn').addEventListener('click', () => {
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
    input.placeholder = `Svarmöguleiki ${index + 1}`;
  });
}

// ============================================
// EVENT HANDLERS
// ============================================

function handleVotingTypeChange(e) {
  const maxSelectionsGroup = document.getElementById('max-selections-group');
  maxSelectionsGroup.style.display = e.target.value === 'multi-choice' ? 'block' : 'none';
}

function handleStartTimingChange(e) {
  const scheduledStartGroup = document.getElementById('scheduled-start-group');
  scheduledStartGroup.style.display = e.target.value === 'scheduled' ? 'block' : 'none';
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
    customDurationGroup.style.display = 'block';
    durationInput.value = '';
  } else {
    customDurationGroup.style.display = 'none';
    durationInput.value = minutes;
  }

  // Uncheck manual end time
  manualEndTimeCheckbox.checked = false;
  document.getElementById('manual-end-time-group').style.display = 'none';
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
    ? formData.description 
    : `<em>${R.string.review_no_description}</em>`;

  // Answer Options
  const votingTypeText = formData.voting_type === 'single-choice' 
    ? R.string.voting_type_single 
    : R.string.voting_type_multi;
  document.getElementById('review-voting-type').textContent = votingTypeText;

  const maxSelectionsText = formData.voting_type === 'multi-choice' 
    ? R.format(R.string.duration_max_selections, formData.max_selections)
    : R.string.duration_one_selection;
  document.getElementById('review-max-selections').textContent = maxSelectionsText;

  const answersHtml = formData.answers.map(answer => `<li>${answer}</li>`).join('');
  document.getElementById('review-answers').innerHTML = answersHtml || `<li><em>${R.string.review_no_answers}</em></li>`;

  // Schedule
  const startTimeText = formData.start_timing === 'immediate' 
    ? R.string.start_immediate 
    : formatDateTime(formData.scheduled_start);
  document.getElementById('review-start-time').textContent = startTimeText;

  let durationText = '';
  let endTimeText = '';

  if (formData.scheduled_end) {
    durationText = R.string.review_duration_custom;
    endTimeText = formatDateTime(formData.scheduled_end);
  } else {
    durationText = formatDuration(formData.duration_minutes);
    // Calculate end time
    const startTime = formData.scheduled_start ? new Date(formData.scheduled_start) : new Date();
    const endTime = new Date(startTime.getTime() + formData.duration_minutes * 60000);
    endTimeText = formatDateTime(endTime.toISOString());
  }

  document.getElementById('review-duration').textContent = durationText;
  document.getElementById('review-end-time').textContent = endTimeText;
}

function formatDateTime(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleString('is-IS', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

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

async function handleSubmit(status) {
  updateFormData();

  // Final validation
  if (!validateCurrentStep()) {
    return;
  }

  // Build request payload
  const payload = {
    title: formData.title,
    question: formData.question,
    description: formData.description || null,
    voting_type: formData.voting_type,
    max_selections: formData.max_selections,
    answers: formData.answers.map((text, index) => ({
      answer_text: text,
      display_order: index
    })),
    status: status // 'draft' or 'open'
  };

  // Add timing
  if (formData.start_timing === 'scheduled') {
    payload.scheduled_start = formData.scheduled_start;
  }

  if (formData.scheduled_end) {
    payload.scheduled_end = formData.scheduled_end;
  } else if (formData.duration_minutes) {
    payload.duration_minutes = formData.duration_minutes;
  }

  // Show loading
  document.getElementById('loading-overlay').style.display = 'flex';

  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Ekki innskráður');
    }

    const token = await user.getIdToken();

    const response = await fetch('https://elections-service-ymzrguoifa-nw.a.run.app/api/admin/elections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || R.string.error_create_election);
    }

    const result = await response.json();

    // Success!
    alert(status === 'draft' ? R.string.success_draft_created : R.string.success_election_created);
    window.location.href = '/admin-elections/';

  } catch (error) {
    console.error('Error creating election:', error);
    alert(R.format(R.string.error_create_election_detail, error.message));
  } finally {
    document.getElementById('loading-overlay').style.display = 'none';
  }
}
