/**
 * Email API Client - Issue #323
 *
 * Cloud Functions client for email operations via Postmark.
 * Handles templates, campaigns, sending, and statistics.
 */

import { httpsCallable } from '../../../../firebase/app.js';
import { debug } from '../../../../js/utils/util-debug.js';

const REGION = 'europe-west2';

const EmailAPI = {
  // ============================================================================
  // TEMPLATES
  // ============================================================================

  /**
   * List all email templates
   * @param {Object} options - Filter options
   * @param {string} options.type - 'transactional' | 'broadcast'
   * @param {string} options.language - 'is' | 'en'
   * @returns {Promise<{templates: Array, count: number}>}
   */
  async listTemplates({ type = null, language = null } = {}) {
    try {
      const listEmailTemplates = httpsCallable('listEmailTemplates', REGION);
      const result = await listEmailTemplates({ type, language });
      debug.log('[EmailAPI] listTemplates:', result.data);
      return result.data;
    } catch (error) {
      debug.error('[EmailAPI] listTemplates error:', error);
      throw new Error(`Failed to list templates: ${error.message}`);
    }
  },

  /**
   * Get a single template by ID or alias
   * @param {string} templateId - Template document ID or alias
   * @returns {Promise<Object>} Full template data
   */
  async getTemplate(templateId) {
    try {
      const getEmailTemplate = httpsCallable('getEmailTemplate', REGION);
      const result = await getEmailTemplate({ template_id: templateId });
      debug.log('[EmailAPI] getTemplate:', result.data);
      return result.data;
    } catch (error) {
      debug.error('[EmailAPI] getTemplate error:', error);
      throw new Error(`Failed to get template: ${error.message}`);
    }
  },

  /**
   * Create or update a template
   * @param {Object} templateData - Template data
   * @param {string} templateData.name - Template name
   * @param {string} templateData.subject - Email subject
   * @param {string} templateData.body_html - HTML body
   * @param {string} templateData.type - 'transactional' | 'broadcast'
   * @param {string} templateData.template_id - Optional, for updates
   * @param {string} templateData.language - 'is' | 'en'
   * @returns {Promise<{success: boolean, template_id: string}>}
   */
  async saveTemplate(templateData) {
    try {
      const saveEmailTemplate = httpsCallable('saveEmailTemplate', REGION);
      const result = await saveEmailTemplate(templateData);
      debug.log('[EmailAPI] saveTemplate:', result.data);
      return result.data;
    } catch (error) {
      debug.error('[EmailAPI] saveTemplate error:', error);
      throw new Error(`Failed to save template: ${error.message}`);
    }
  },

  /**
   * Delete a template
   * @param {string} templateId - Template document ID
   * @returns {Promise<{success: boolean}>}
   */
  async deleteTemplate(templateId) {
    try {
      const deleteEmailTemplate = httpsCallable('deleteEmailTemplate', REGION);
      const result = await deleteEmailTemplate({ template_id: templateId });
      debug.log('[EmailAPI] deleteTemplate:', result.data);
      return result.data;
    } catch (error) {
      debug.error('[EmailAPI] deleteTemplate error:', error);
      throw new Error(`Failed to delete template: ${error.message}`);
    }
  },

  // ============================================================================
  // SEND EMAIL
  // ============================================================================

  /**
   * Send a single email to a recipient
   *
   * Supports two modes:
   * 1. Template mode: Pass template_id to use a saved template
   * 2. Quick send mode: Pass subject and body_html directly
   *
   * @param {Object} options - Send options
   * @param {string} [options.template_id] - Template ID or alias (template mode)
   * @param {string} [options.subject] - Email subject (quick send mode)
   * @param {string} [options.body_html] - Email HTML body (quick send mode)
   * @param {string} options.recipient_email - Email address OR
   * @param {string} options.recipient_kennitala - Member kennitala
   * @param {Object} [options.variables] - Template variables
   * @returns {Promise<{success: boolean, message_id: string}>}
   */
  async sendEmail({ template_id, subject, body_html, recipient_email, recipient_kennitala, variables = {} }) {
    try {
      const sendEmailFn = httpsCallable('sendEmail', REGION);
      const payload = {
        recipient_email,
        recipient_kennitala,
        variables
      };

      // Template mode vs Quick send mode
      if (template_id) {
        payload.template_id = template_id;
      } else if (subject && body_html) {
        payload.subject = subject;
        payload.body_html = body_html;
      } else {
        throw new Error('Either template_id or (subject + body_html) is required');
      }

      const result = await sendEmailFn(payload);
      debug.log('[EmailAPI] sendEmail:', result.data);
      return result.data;
    } catch (error) {
      debug.error('[EmailAPI] sendEmail error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  },

  // ============================================================================
  // CAMPAIGNS
  // ============================================================================

  /**
   * List email campaigns
   * @param {Object} options - Filter options
   * @param {string} options.status - Campaign status filter
   * @param {number} options.limit - Max results
   * @returns {Promise<{campaigns: Array, count: number}>}
   */
  async listCampaigns({ status = null, limit = 50 } = {}) {
    try {
      const listEmailCampaigns = httpsCallable('listEmailCampaigns', REGION);
      const result = await listEmailCampaigns({ status, limit });
      debug.log('[EmailAPI] listCampaigns:', result.data);
      return result.data;
    } catch (error) {
      debug.error('[EmailAPI] listCampaigns error:', error);
      throw new Error(`Failed to list campaigns: ${error.message}`);
    }
  },

  /**
   * Create a new campaign
   * @param {Object} campaignData - Campaign data
   * @param {string} campaignData.name - Campaign name
   * @param {string} campaignData.template_id - Template to use
   * @param {Object} campaignData.recipient_filter - Recipient filter
   * @returns {Promise<{success: boolean, campaign_id: string}>}
   */
  async createCampaign(campaignData) {
    try {
      const createEmailCampaign = httpsCallable('createEmailCampaign', REGION);
      const result = await createEmailCampaign(campaignData);
      debug.log('[EmailAPI] createCampaign:', result.data);
      return result.data;
    } catch (error) {
      debug.error('[EmailAPI] createCampaign error:', error);
      throw new Error(`Failed to create campaign: ${error.message}`);
    }
  },

  /**
   * Send a campaign to all recipients
   * @param {string} campaignId - Campaign document ID
   * @returns {Promise<{success: boolean, sent_count: number, failed_count: number}>}
   */
  async sendCampaign(campaignId) {
    try {
      const sendCampaign = httpsCallable('sendCampaign', REGION);
      const result = await sendCampaign({ campaign_id: campaignId });
      debug.log('[EmailAPI] sendCampaign:', result.data);
      return result.data;
    } catch (error) {
      debug.error('[EmailAPI] sendCampaign error:', error);
      throw new Error(`Failed to send campaign: ${error.message}`);
    }
  },

  // ============================================================================
  // STATISTICS & LOGS
  // ============================================================================

  /**
   * Get email sending statistics
   * @param {Object} options - Stats options
   * @param {string} options.campaign_id - Optional campaign ID
   * @param {number} options.days - Days to include (default 30)
   * @returns {Promise<{stats: Object}>}
   */
  async getStats({ campaign_id = null, days = 30 } = {}) {
    try {
      const getEmailStats = httpsCallable('getEmailStats', REGION);
      const result = await getEmailStats({ campaign_id, days });
      debug.log('[EmailAPI] getStats:', result.data);
      return result.data;
    } catch (error) {
      debug.error('[EmailAPI] getStats error:', error);
      throw new Error(`Failed to get stats: ${error.message}`);
    }
  },

  /**
   * List email send logs
   * @param {Object} options - Filter options
   * @param {string} options.campaign_id - Filter by campaign
   * @param {string} options.status - Filter by status
   * @param {number} options.limit - Max results
   * @returns {Promise<{logs: Array, count: number}>}
   */
  async listLogs({ campaign_id = null, status = null, limit = 100 } = {}) {
    try {
      const listEmailLogs = httpsCallable('listEmailLogs', REGION);
      const result = await listEmailLogs({ campaign_id, status, limit });
      debug.log('[EmailAPI] listLogs:', result.data);
      return result.data;
    } catch (error) {
      debug.error('[EmailAPI] listLogs error:', error);
      throw new Error(`Failed to list logs: ${error.message}`);
    }
  }
};

export default EmailAPI;
