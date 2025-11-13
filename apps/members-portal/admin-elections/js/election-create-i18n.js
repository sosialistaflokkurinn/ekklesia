/**
 * Election Create Page - i18n Initialization
 *
 * Handles all internationalization string initialization for the election creation wizard.
 * Extracted from create.html to follow standardized i18n pattern.
 *
 * @module admin-elections/js/election-create-i18n
 */

import { R } from '../i18n/strings-loader.js';

/**
 * Initialize all i18n strings for the election creation page
 *
 * This function loads the Icelandic locale and sets all text content
 * for navigation, form labels, placeholders, help text, and buttons.
 *
 * @returns {Promise<void>} Resolves when all strings are initialized
 * @throws {Error} If strings fail to load or required elements are missing
 */
export async function initElectionCreateStrings() {
  // Load i18n strings before anything else
  await R.load('is');

  // Set page title and static text
  document.getElementById('page-title').textContent = R.string.create_election_page_title;
  document.getElementById('nav-brand').textContent = R.string.admin_brand;
  document.getElementById('nav-elections-list').textContent = R.string.nav_elections_list;
  document.getElementById('nav-back-to-member').textContent = R.string.admin_nav_back_to_member;
  document.getElementById('nav-logout').textContent = R.string.admin_nav_logout;
  document.getElementById('back-link').textContent = R.string.back_to_list;
  document.getElementById('page-heading').textContent = R.string.create_election_heading;

  // Progress steps
  document.getElementById('wizard-step-1-label').textContent = R.string.wizard_step_1;
  document.getElementById('wizard-step-2-label').textContent = R.string.wizard_step_2;
  document.getElementById('wizard-step-3-label').textContent = R.string.wizard_step_3;
  document.getElementById('wizard-step-4-label').textContent = R.string.wizard_step_4;

  // Step 1
  document.getElementById('step-1-title').textContent = R.string.step_1_title;
  document.getElementById('step-1-description').textContent = R.string.step_1_description;
  document.getElementById('label-election-title').textContent = R.string.label_election_title;
  document.getElementById('election-title').placeholder = R.string.placeholder_election_title;
  document.getElementById('help-election-title').textContent = R.string.help_election_title;
  document.getElementById('label-election-question').textContent = R.string.label_election_question;
  document.getElementById('election-question').placeholder = R.string.placeholder_election_question;
  document.getElementById('help-election-question').textContent = R.string.help_election_question;
  document.getElementById('label-election-description').textContent = R.string.label_election_description;
  document.getElementById('election-description').placeholder = R.string.placeholder_election_description;
  document.getElementById('help-election-description').textContent = R.string.help_election_description;

  // Step 2
  document.getElementById('step-2-title').textContent = R.string.step_2_title;
  document.getElementById('step-2-description').textContent = R.string.step_2_description;
  document.getElementById('label-voting-type').textContent = R.string.label_voting_type;
  document.getElementById('voting-type-single').textContent = R.string.voting_type_single;
  document.getElementById('voting-type-single-desc').textContent = R.string.voting_type_single_desc;
  document.getElementById('voting-type-multi').textContent = R.string.voting_type_multi;
  document.getElementById('voting-type-multi-desc').textContent = R.string.voting_type_multi_desc;
  document.getElementById('label-max-selections').textContent = R.string.label_max_selections;
  document.getElementById('help-max-selections').textContent = R.string.help_max_selections;
  document.getElementById('label-answer-options').textContent = R.string.label_answer_options;
  document.getElementById('add-answer-btn').textContent = R.string.btn_add_answer;
  document.getElementById('help-answer-options').textContent = R.string.help_answer_options;

  // Step 3
  document.getElementById('step-3-title').textContent = R.string.step_3_title;
  document.getElementById('step-3-description').textContent = R.string.step_3_description;
  document.getElementById('label-start-timing').textContent = R.string.label_start_timing;
  document.getElementById('start-immediate').textContent = R.string.start_immediate;
  document.getElementById('start-immediate-desc').textContent = R.string.start_immediate_desc;
  document.getElementById('start-scheduled').textContent = R.string.start_scheduled;
  document.getElementById('start-scheduled-desc').textContent = R.string.start_scheduled_desc;
  document.getElementById('label-scheduled-start').textContent = R.string.label_scheduled_start;
  document.getElementById('label-duration').textContent = R.string.label_duration;
  document.getElementById('duration-15min').textContent = R.string.duration_15min;
  document.getElementById('duration-30min').textContent = R.string.duration_30min;
  document.getElementById('duration-1hr').textContent = R.string.duration_1hr;
  document.getElementById('duration-1-5hr').textContent = R.string.duration_1_5hr;
  document.getElementById('duration-2hr').textContent = R.string.duration_2hr;
  document.getElementById('duration-custom').textContent = R.string.duration_custom;
  document.getElementById('label-custom-duration').textContent = R.string.label_custom_duration;
  document.getElementById('custom-duration').placeholder = R.string.placeholder_custom_duration;
  document.getElementById('help-custom-duration').textContent = R.string.help_custom_duration;
  document.getElementById('label-use-manual-end').textContent = R.string.label_use_manual_end;
  document.getElementById('label-scheduled-end').textContent = R.string.label_scheduled_end;

  // Step 4
  document.getElementById('step-4-title').textContent = R.string.step_4_title;
  document.getElementById('step-4-description').textContent = R.string.step_4_description;
  document.getElementById('review-section-basic').textContent = R.string.review_section_basic;
  document.getElementById('review-label-title').textContent = R.string.review_title;
  document.getElementById('review-label-question').textContent = R.string.review_question;
  document.getElementById('review-label-description').textContent = R.string.review_description;
  document.getElementById('review-section-answers').textContent = R.string.review_section_answers;
  document.getElementById('review-label-voting-type').textContent = R.string.review_voting_type;
  document.getElementById('review-label-max-selections').textContent = R.string.review_max_selections;
  document.getElementById('review-label-answers').textContent = R.string.review_answers;
  document.getElementById('review-section-schedule').textContent = R.string.review_section_schedule;
  document.getElementById('review-label-start-time').textContent = R.string.review_start_time;
  document.getElementById('review-label-duration').textContent = R.string.review_duration;
  document.getElementById('review-label-end-time').textContent = R.string.review_end_time;

  // Navigation buttons
  document.getElementById('prev-btn').textContent = R.string.btn_prev;
  document.getElementById('next-btn').textContent = R.string.btn_next;
  document.getElementById('create-draft-btn').textContent = R.string.btn_save_draft;
  document.getElementById('create-open-btn').textContent = R.string.btn_create_open;

  // Loading text
  document.getElementById('loading-text').textContent = R.string.loading_create_election;
}
