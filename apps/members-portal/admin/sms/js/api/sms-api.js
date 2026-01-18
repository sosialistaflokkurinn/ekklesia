/**
 * SMS API Client
 *
 * Cloud Functions client for SMS operations via Twilio.
 * Handles templates, campaigns, sending, and statistics.
 */

import { httpsCallable } from '../../../../firebase/app.js';
import { debug } from '../../../../js/utils/util-debug.js';

const REGION = 'europe-west2';

const SmsAPI = {
  // ============================================================================
  // TEMPLATES
  // ============================================================================

  /**
   * List all SMS templates
   * @param {Object} options - Filter options
   * @param {string} options.type - 'transactional' | 'broadcast'
   * @param {string} options.language - 'is' | 'en'
   * @returns {Promise<{templates: Array, count: number}>}
   */
  async listTemplates({ type = null, language = null } = {}) {
    try {
      const listSmsTemplates = httpsCallable('listSmsTemplates', REGION);
      const result = await listSmsTemplates({ type, language });
      debug.log('[SmsAPI] listTemplates:', result.data);
      return result.data;
    } catch (error) {
      debug.error('[SmsAPI] listTemplates error:', error);
      throw new Error(`Failed to list templates: ${error.message}`);
    }
  },

  /**
   * Get a single template by ID
   * @param {string} templateId - Template document ID
   * @returns {Promise<Object>} Full template data
   */
  async getTemplate(templateId) {
    try {
      const getSmsTemplate = httpsCallable('getSmsTemplate', REGION);
      const result = await getSmsTemplate({ template_id: templateId });
      debug.log('[SmsAPI] getTemplate:', result.data);
      return result.data;
    } catch (error) {
      debug.error('[SmsAPI] getTemplate error:', error);
      throw new Error(`Failed to get template: ${error.message}`);
    }
  },

  /**
   * Create or update a template
   * @param {Object} templateData - Template data
   * @param {string} templateData.name - Template name
   * @param {string} templateData.body - SMS message body
   * @param {string} templateData.type - 'transactional' | 'broadcast'
   * @param {string} templateData.template_id - Optional, for updates
   * @param {string} templateData.language - 'is' | 'en'
   * @returns {Promise<{success: boolean, template_id: string, char_count: number, segment_count: number}>}
   */
  async saveTemplate(templateData) {
    try {
      const saveSmsTemplate = httpsCallable('saveSmsTemplate', REGION);
      const result = await saveSmsTemplate(templateData);
      debug.log('[SmsAPI] saveTemplate:', result.data);
      return result.data;
    } catch (error) {
      debug.error('[SmsAPI] saveTemplate error:', error);
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
      const deleteSmsTemplate = httpsCallable('deleteSmsTemplate', REGION);
      const result = await deleteSmsTemplate({ template_id: templateId });
      debug.log('[SmsAPI] deleteTemplate:', result.data);
      return result.data;
    } catch (error) {
      debug.error('[SmsAPI] deleteTemplate error:', error);
      throw new Error(`Failed to delete template: ${error.message}`);
    }
  },

  // ============================================================================
  // SEND SMS
  // ============================================================================

  /**
   * Send a single SMS to a recipient
   *
   * Supports two modes:
   * 1. Template mode: Pass template_id to use a saved template
   * 2. Quick send mode: Pass body directly
   *
   * @param {Object} options - Send options
   * @param {string} [options.template_id] - Template ID (template mode)
   * @param {string} [options.body] - SMS body (quick send mode)
   * @param {string} options.recipient_phone - Phone number OR
   * @param {string} options.recipient_kennitala - Member kennitala
   * @param {Object} [options.variables] - Template variables
   * @param {string} [options.sms_type] - 'transactional' | 'broadcast'
   * @returns {Promise<{success: boolean, message_sid: string, segment_count: number}>}
   */
  async sendSms({ template_id, body, recipient_phone, recipient_kennitala, variables = {}, sms_type = null }) {
    try {
      const sendSmsFn = httpsCallable('sendSms', REGION);
      const payload = {
        recipient_phone,
        recipient_kennitala,
        variables
      };

      // Include sms_type if specified
      if (sms_type) {
        payload.sms_type = sms_type;
      }

      // Template mode vs Quick send mode
      if (template_id) {
        payload.template_id = template_id;
      } else if (body) {
        payload.body = body;
      } else {
        throw new Error('Either template_id or body is required');
      }

      const result = await sendSmsFn(payload);
      debug.log('[SmsAPI] sendSms:', result.data);
      return result.data;
    } catch (error) {
      debug.error('[SmsAPI] sendSms error:', error);
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  },

  // ============================================================================
  // CAMPAIGNS
  // ============================================================================

  /**
   * List SMS campaigns
   * @param {Object} options - Filter options
   * @param {string} options.status - Campaign status filter
   * @param {number} options.limit - Max results
   * @returns {Promise<{campaigns: Array, count: number}>}
   */
  async listCampaigns({ status = null, limit = 50 } = {}) {
    try {
      const listSmsCampaigns = httpsCallable('listSmsCampaigns', REGION);
      const result = await listSmsCampaigns({ status, limit });
      debug.log('[SmsAPI] listCampaigns:', result.data);
      return result.data;
    } catch (error) {
      debug.error('[SmsAPI] listCampaigns error:', error);
      throw new Error(`Failed to list campaigns: ${error.message}`);
    }
  },

  /**
   * Preview recipient count for a filter (members with phone numbers)
   * @param {Object} options - Filter options
   * @param {Object} options.recipient_filter - { status, districts[], municipalities[] }
   * @returns {Promise<{count: number, filter: Object}>}
   */
  async previewRecipientCount({ recipient_filter }) {
    try {
      const previewSmsRecipientCount = httpsCallable('previewSmsRecipientCount', REGION);
      const result = await previewSmsRecipientCount({ recipient_filter });
      debug.log('[SmsAPI] previewRecipientCount:', result.data);
      return result.data;
    } catch (error) {
      debug.error('[SmsAPI] previewRecipientCount error:', error);
      throw new Error(`Failed to preview recipient count: ${error.message}`);
    }
  },

  /**
   * Create a new SMS campaign
   * @param {Object} campaignData - Campaign data
   * @param {string} campaignData.name - Campaign name
   * @param {string} campaignData.template_id - Template to use
   * @param {Object} campaignData.recipient_filter - Recipient filter
   * @returns {Promise<{success: boolean, campaign_id: string, recipient_count: number, estimated_cost: number}>}
   */
  async createCampaign(campaignData) {
    try {
      const createSmsCampaign = httpsCallable('createSmsCampaign', REGION);
      const result = await createSmsCampaign(campaignData);
      debug.log('[SmsAPI] createCampaign:', result.data);
      return result.data;
    } catch (error) {
      debug.error('[SmsAPI] createCampaign error:', error);
      throw new Error(`Failed to create campaign: ${error.message}`);
    }
  },

  /**
   * Send a campaign to all recipients
   * @param {string} campaignId - Campaign document ID
   * @returns {Promise<{success: boolean, sent_count: number, failed_count: number, total_cost: number}>}
   */
  async sendCampaign(campaignId) {
    try {
      const sendSmsCampaign = httpsCallable('sendSmsCampaign', REGION);
      const result = await sendSmsCampaign({ campaign_id: campaignId });
      debug.log('[SmsAPI] sendCampaign:', result.data);
      return result.data;
    } catch (error) {
      debug.error('[SmsAPI] sendCampaign error:', error);
      throw new Error(`Failed to send campaign: ${error.message}`);
    }
  },

  // ============================================================================
  // STATISTICS & LOGS
  // ============================================================================

  /**
   * Get SMS sending statistics
   * @param {Object} options - Stats options
   * @param {string} options.campaign_id - Optional campaign ID
   * @param {number} options.days - Days to include (default 30)
   * @returns {Promise<{stats: Object}>}
   */
  async getStats({ campaign_id = null, days = 30 } = {}) {
    try {
      const getSmsStats = httpsCallable('getSmsStats', REGION);
      const result = await getSmsStats({ campaign_id, days });
      debug.log('[SmsAPI] getStats:', result.data);
      return result.data;
    } catch (error) {
      debug.error('[SmsAPI] getStats error:', error);
      throw new Error(`Failed to get stats: ${error.message}`);
    }
  },

  /**
   * List SMS send logs
   * @param {Object} options - Filter options
   * @param {string} options.campaign_id - Filter by campaign
   * @param {string} options.status - Filter by status
   * @param {number} options.limit - Max results
   * @returns {Promise<{logs: Array, count: number}>}
   */
  async listLogs({ campaign_id = null, status = null, limit = 100 } = {}) {
    try {
      const listSmsLogs = httpsCallable('listSmsLogs', REGION);
      const result = await listSmsLogs({ campaign_id, status, limit });
      debug.log('[SmsAPI] listLogs:', result.data);
      return result.data;
    } catch (error) {
      debug.error('[SmsAPI] listLogs error:', error);
      throw new Error(`Failed to list logs: ${error.message}`);
    }
  }
};

export default SmsAPI;
