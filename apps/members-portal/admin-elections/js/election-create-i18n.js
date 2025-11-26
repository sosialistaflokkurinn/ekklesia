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
  // Navigation elements are handled by navigation-bar.js component
  // document.getElementById('nav-brand').textContent = R.string.admin_brand;
  // document.getElementById('nav-elections-list').textContent = R.string.nav_elections_list;
  // document.getElementById('nav-back-to-member').textContent = R.string.admin_nav_back_to_member;
  // document.getElementById('nav-logout').textContent = R.string.admin_nav_logout;
  document.getElementById('back-link').textContent = R.string.back_to_list;
  document.getElementById('page-heading').textContent = R.string.create_election_heading;

  // Progress steps (3 steps: Basic Info, Answers, Review)
  document.getElementById('wizard-step-1-label').textContent = R.string.wizard_step_1;
  document.getElementById('wizard-step-2-label').textContent = R.string.wizard_step_2;
  document.getElementById('wizard-step-3-label').textContent = R.string.wizard_step_4; // "Yfirlit" (Review)

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

  // Step 3: Review (Schedule moved to "Open" action in elections list)
  document.getElementById('step-3-title').textContent = R.string.step_4_title; // "Yfirlit"
  document.getElementById('step-3-description').textContent = R.string.step_4_description;
  document.getElementById('review-section-basic').textContent = R.string.review_section_basic;
  document.getElementById('review-label-title').textContent = R.string.review_title;
  document.getElementById('review-label-question').textContent = R.string.review_question;
  document.getElementById('review-label-description').textContent = R.string.review_description;
  document.getElementById('review-section-answers').textContent = R.string.review_section_answers;
  document.getElementById('review-label-voting-type').textContent = R.string.review_voting_type;
  document.getElementById('review-label-max-selections').textContent = R.string.review_max_selections;
  document.getElementById('review-label-answers').textContent = R.string.review_answers;

  // Navigation buttons
  document.getElementById('prev-btn').textContent = R.string.btn_prev;
  document.getElementById('next-btn').textContent = R.string.btn_next;
  document.getElementById('create-draft-btn').textContent = R.string.btn_save_draft;

  // Loading text
  document.getElementById('loading-text').textContent = R.string.loading_create_election;
}
