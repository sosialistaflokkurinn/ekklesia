/**
 * Members API Client - Epic #116, Issue #120
 *
 * Firestore client for members collection CRUD operations.
 * Handles pagination, search, and filtering.
 */

// Import Firestore from member portal
import { getFirebaseFirestore } from '../../../firebase/app.js';
import { debug } from '../../../js/utils/debug.js';
// Import Firestore v9 modular functions
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  doc,
  getCountFromServer
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Get Firestore instance
const db = getFirebaseFirestore();

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
  async fetchMembers({ limit: limitCount = 50, status = 'active', search = '', startAfter: startAfterDoc = null } = {}) {
    try {
      // Build query using v9 modular syntax
      const membersCol = collection(db, 'members');
      let constraints = [];

      // Filter by status (nested in membership.status from Django sync)
      if (status !== 'all') {
        constraints.push(where('membership.status', '==', status));
      }

      // Order by Django ID descending (newest members first)
      // metadata.django_id is synced from Django backend
      constraints.push(orderBy('metadata.django_id', 'desc'));

      // Pagination
      if (startAfterDoc) {
        constraints.push(startAfter(startAfterDoc));
      }

      // Limit (fetch one extra to check if there are more)
      constraints.push(limit(limitCount + 1));

      const q = query(membersCol, ...constraints);
      const snapshot = await getDocs(q);
      const members = [];
      const docs = snapshot.docs;

      // Process results and flatten Django sync structure
      for (let i = 0; i < Math.min(docs.length, limitCount); i++) {
        const docSnap = docs[i];
        const data = docSnap.data();
        const kennitala = data.profile?.kennitala || docSnap.id;

        // Skip test accounts with kennitala starting with 9999
        if (kennitala.startsWith('9999')) {
          continue;
        }

        // Flatten nested structure from Django sync
        members.push({
          id: docSnap.id,
          kennitala: kennitala,
          name: data.profile?.name || 'Unknown',
          email: data.profile?.email || '',
          phone: data.profile?.phone || '',
          status: data.membership?.status || 'unknown',
          birthday: data.profile?.birthday || '',
          address: data.address || {},
          membership: data.membership || {},
          metadata: data.metadata || {},
          _doc: docSnap // Keep reference for pagination
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
        hasMore: docs.length > limitCount,
        lastDoc: docs.length > 0 ? docs[Math.min(docs.length - 1, limitCount - 1)] : null,
        total: snapshot.size
      };

    } catch (error) {
      debug.error('Error fetching members:', error);
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
      const membersCol = collection(db, 'members');
      let constraints = [];

      if (status !== 'all') {
        constraints.push(where('membership.status', '==', status));
      }

      const q = query(membersCol, ...constraints);
      const snapshot = await getDocs(q);

      // Count members, excluding test accounts with 9999 prefix
      let count = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        const kennitala = data.profile?.kennitala || doc.id;
        if (!kennitala.startsWith('9999')) {
          count++;
        }
      });

      return count;

    } catch (error) {
      debug.error('Error getting members count:', error);
      throw new Error(`Failed to get members count: ${error.message}`);
    }
  },

  /**
   * Get single member by kennitala
   * @param {string} kennitala - Member's kennitala (with or without hyphen)
   * @returns {Promise<Object>}
   */
  async getMember(kennitala) {
    try {
      // CRITICAL FIX (Issue #166): Normalize kennitala (remove hyphen) before using as document ID
      const kennitalaNoHyphen = kennitala.replace(/-/g, '');
      const docRef = doc(db, 'members', kennitalaNoHyphen);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error('Member not found');
      }

      const data = docSnap.data();
      const memberKennitala = data.profile?.kennitala || docSnap.id;

      // Skip test accounts with kennitala starting with 9999
      if (memberKennitala.startsWith('9999')) {
        throw new Error('Test account not accessible');
      }

      // Flatten nested structure from Django sync
      return {
        id: docSnap.id,
        kennitala: data.profile?.kennitala || docSnap.id,
        name: data.profile?.name || 'Unknown',
        email: data.profile?.email || '',
        phone: data.profile?.phone || '',
        status: data.membership?.status || 'unknown',
        birthday: data.profile?.birthday || '',
        address: data.address || {},
        membership: data.membership || {},
        metadata: data.metadata || {},
        profile: data.profile || {},
        titles: data.titles || [],
        unions: data.unions || []
      };

    } catch (error) {
      debug.error('Error fetching member:', error);
      throw new Error(`Failed to fetch member: ${error.message}`);
    }
  }
};

// Export for use in other modules
export default MembersAPI;
