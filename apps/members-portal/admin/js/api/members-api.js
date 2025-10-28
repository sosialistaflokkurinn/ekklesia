/**
 * Members API Client - Epic #116, Issue #120
 *
 * Firestore client for members collection CRUD operations.
 * Handles pagination, search, and filtering.
 */

const MembersAPI = {
  /**
   * Fetch members with pagination and filtering
   * @param {Object} options - Query options
   * @param {number} options.limit - Number of members per page (default: 50)
   * @param {string} options.status - Filter by status: 'all', 'active', 'inactive'
   * @param {string} options.search - Search by name or kennitala
   * @param {Object} options.startAfter - Firestore document for pagination
   * @returns {Promise<{members: Array, hasMore: boolean, lastDoc: Object}>}
   */
  async fetchMembers({ limit = 50, status = 'active', search = '', startAfter = null } = {}) {
    try {
      const db = firebase.firestore();
      let query = db.collection('members');

      // Filter by status
      if (status !== 'all') {
        query = query.where('status', '==', status);
      }

      // Order by name for consistent pagination
      query = query.orderBy('name');

      // Search filter (client-side for now, server-side would require indexes)
      // TODO: Implement server-side search with Algolia or similar

      // Pagination
      if (startAfter) {
        query = query.startAfter(startAfter);
      }

      query = query.limit(limit + 1); // Fetch one extra to check if there are more

      const snapshot = await query.get();
      const members = [];
      const docs = snapshot.docs;

      // Process results
      for (let i = 0; i < Math.min(docs.length, limit); i++) {
        const doc = docs[i];
        members.push({
          id: doc.id,
          ...doc.data(),
          _doc: doc // Keep reference for pagination
        });
      }

      // Client-side search filter
      let filteredMembers = members;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredMembers = members.filter(m =>
          m.name?.toLowerCase().includes(searchLower) ||
          m.kennitala?.includes(search) ||
          m.email?.toLowerCase().includes(searchLower)
        );
      }

      return {
        members: filteredMembers,
        hasMore: docs.length > limit,
        lastDoc: docs.length > 0 ? docs[Math.min(docs.length - 1, limit - 1)] : null,
        total: snapshot.size
      };

    } catch (error) {
      console.error('Error fetching members:', error);
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
      const db = firebase.firestore();
      let query = db.collection('members');

      if (status !== 'all') {
        query = query.where('status', '==', status);
      }

      const snapshot = await query.count().get();
      return snapshot.data().count;

    } catch (error) {
      console.error('Error getting members count:', error);
      // Fallback: fetch all and count (not efficient, but works)
      try {
        const snapshot = await db.collection('members').get();
        return snapshot.size;
      } catch (fallbackError) {
        throw new Error(`Failed to get members count: ${error.message}`);
      }
    }
  },

  /**
   * Get single member by kennitala
   * @param {string} kennitala - Member's kennitala (document ID)
   * @returns {Promise<Object>}
   */
  async getMember(kennitala) {
    try {
      const db = firebase.firestore();
      const doc = await db.collection('members').doc(kennitala).get();

      if (!doc.exists) {
        throw new Error('Member not found');
      }

      return {
        id: doc.id,
        ...doc.data()
      };

    } catch (error) {
      console.error('Error fetching member:', error);
      throw new Error(`Failed to fetch member: ${error.message}`);
    }
  }
};

// Export for use in other modules
window.MembersAPI = MembersAPI;
