/**
 * Members API Client - Epic #116, Issue #120
 *
 * Cloud Functions client for members CRUD operations.
 * Reads from Cloud SQL (source of truth) via Cloud Functions.
 * Handles pagination, search, and filtering.
 */

import { httpsCallable } from '../../../firebase/app.js';
import { debug } from '../../../js/utils/util-debug.js';

const REGION = 'europe-west2';

const MembersAPI = {
  /**
   * Fetch members with pagination and filtering
   * @param {Object} options - Query options
   * @param {number} options.limit - Number of members per page (default: 50)
   * @param {string} options.status - Filter by status: 'all', 'active', 'deleted'
   * @param {string} options.search - Search by name, kennitala, or email
   * @param {number} options.offset - Offset for pagination (default: 0)
   * @param {string} options.municipality - Filter by municipality name
   * @returns {Promise<{members: Array, hasMore: boolean, total: number}>}
   */
  async fetchMembers({ limit: limitCount = 50, status = 'active', search = '', offset = 0, municipality = '' } = {}) {
    try {
      const listMembers = httpsCallable('listMembers', REGION);
      const result = await listMembers({
        limit: limitCount,
        offset,
        status,
        search,
        municipality
      });

      debug.log('[MembersAPI] fetchMembers:', result.data);

      // Map response to expected format
      const members = (result.data.members || []).map(m => ({
        id: m.id,
        kennitala: m.kennitala,
        name: m.name,
        email: m.email,
        phone: m.phone,
        status: m.status,
        birthday: m.birthday,
        date_joined: m.date_joined,
        municipality: m.municipality,
        metadata: m.metadata || {},
        // For backwards compatibility
        membership: {
          status: m.status,
          date_joined: m.date_joined
        },
        profile: {
          name: m.name,
          email: m.email,
          phone: m.phone,
          birthday: m.birthday,
          kennitala: m.kennitala
        }
      }));

      return {
        members,
        hasMore: result.data.hasMore,
        total: result.data.total
      };

    } catch (error) {
      debug.error('[MembersAPI] fetchMembers error:', error);
      throw new Error(`Failed to fetch members: ${error.message}`);
    }
  },

  /**
   * Get total count of members
   * @param {string} status - Filter by status
   * @returns {Promise<number>}
   */
  async getMembersCount(status = 'active') {
    try {
      const getMemberStats = httpsCallable('getMemberStats', REGION);
      const result = await getMemberStats();

      debug.log('[MembersAPI] getMembersCount:', result.data);

      if (status === 'active') {
        return result.data.total;
      } else if (status === 'deleted') {
        return result.data.deleted;
      } else {
        return result.data.total + result.data.deleted;
      }

    } catch (error) {
      debug.error('[MembersAPI] getMembersCount error:', error);
      throw new Error(`Failed to get members count: ${error.message}`);
    }
  },

  /**
   * Get member statistics
   * @returns {Promise<Object>} Stats object with total, deleted, with_email, municipalities
   */
  async getMemberStats() {
    try {
      const getMemberStatsFn = httpsCallable('getMemberStats', REGION);
      const result = await getMemberStatsFn();
      debug.log('[MembersAPI] getMemberStats:', result.data);
      return result.data;
    } catch (error) {
      debug.error('[MembersAPI] getMemberStats error:', error);
      throw new Error(`Failed to get member stats: ${error.message}`);
    }
  },

  /**
   * Get single member by kennitala or django_id
   * @param {string} kennitala - Member's kennitala (with or without hyphen)
   * @param {number} django_id - Member's Django ID (alternative to kennitala)
   * @returns {Promise<Object>}
   */
  async getMember(kennitala, django_id = null) {
    try {
      const getMemberFn = httpsCallable('getMember', REGION);

      const payload = {};
      if (kennitala) {
        // Normalize kennitala (remove hyphen)
        payload.kennitala = kennitala.replace(/-/g, '');
      } else if (django_id) {
        payload.django_id = django_id;
      } else {
        throw new Error('Either kennitala or django_id is required');
      }

      const result = await getMemberFn(payload);
      debug.log('[MembersAPI] getMember:', result.data);

      const member = result.data.member;

      // Return with backwards-compatible structure
      return {
        id: member.id,
        kennitala: member.kennitala,
        name: member.name,
        email: member.email,
        phone: member.phone,
        status: member.status,
        birthday: member.birthday,
        address: member.address || {},
        membership: member.membership || {},
        metadata: member.metadata || {},
        profile: member.profile || {},
        reachable: member.reachable,
        groupable: member.groupable,
        titles: member.titles || [],
        unions: member.unions || []
      };

    } catch (error) {
      debug.error('[MembersAPI] getMember error:', error);
      throw new Error(`Failed to fetch member: ${error.message}`);
    }
  }
};

// Export for use in other modules
export default MembersAPI;
