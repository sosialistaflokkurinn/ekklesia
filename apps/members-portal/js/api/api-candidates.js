/**
 * Candidate Metadata API Client
 *
 * Client for accessing and updating nomination candidate metadata in Firestore.
 * Tracks edit history to show who wrote/modified each field.
 *
 * Firestore collection: nomination-candidates
 */

import { getFirebaseAuth, getFirebaseFirestore, collection, doc, getDoc, getDocs, updateDoc, query, orderBy } from '../../firebase/app.js';
import { debug } from '../utils/util-debug.js';

/**
 * Get all candidate metadata
 * @returns {Promise<Array>} Array of candidate objects
 */
export async function getAllCandidates() {
  const db = getFirebaseFirestore();
  const candidatesRef = collection(db, 'nomination-candidates');
  const q = query(candidatesRef, orderBy('name'));

  try {
    debug.log('[Candidates API] Fetching all candidates');
    const snapshot = await getDocs(q);

    const candidates = [];
    snapshot.forEach(doc => {
      candidates.push({ id: doc.id, ...doc.data() });
    });

    debug.log('[Candidates API] Fetched', candidates.length, 'candidates');
    return candidates;
  } catch (error) {
    debug.error('[Candidates API] Error fetching candidates:', error);
    throw error;
  }
}

/**
 * Get single candidate by ID
 * @param {string} candidateId - Candidate document ID
 * @returns {Promise<Object|null>} Candidate object or null if not found
 */
export async function getCandidate(candidateId) {
  const db = getFirebaseFirestore();
  const docRef = doc(db, 'nomination-candidates', candidateId);

  try {
    debug.log('[Candidates API] Fetching candidate:', candidateId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }

    debug.warn('[Candidates API] Candidate not found:', candidateId);
    return null;
  } catch (error) {
    debug.error('[Candidates API] Error fetching candidate:', error);
    throw error;
  }
}

/**
 * Update candidate metadata field
 * Tracks edit history with user info and timestamp
 *
 * @param {string} candidateId - Candidate document ID
 * @param {string} field - Field name to update
 * @param {*} value - New value for the field
 * @returns {Promise<Object>} Updated candidate data
 */
export async function updateCandidateField(candidateId, field, value) {
  const db = getFirebaseFirestore();
  const auth = getFirebaseAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Notandi er ekki innskráður');
  }

  const docRef = doc(db, 'nomination-candidates', candidateId);

  try {
    debug.log('[Candidates API] Updating candidate field:', { candidateId, field });

    // Get current document to update edit history
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error('Frambjóðandi fannst ekki');
    }

    const currentData = docSnap.data();
    const editHistory = currentData.edit_history || [];

    // Add edit entry
    const editEntry = {
      field,
      user_id: user.uid,
      user_name: user.displayName || user.email,
      timestamp: new Date().toISOString(),
      previous_value: currentData[field] || null
    };

    editHistory.push(editEntry);

    // Update document
    await updateDoc(docRef, {
      [field]: value,
      edit_history: editHistory,
      updated_at: new Date().toISOString(),
      last_edited_by: {
        user_id: user.uid,
        user_name: user.displayName || user.email,
        timestamp: new Date().toISOString()
      }
    });

    debug.log('[Candidates API] Updated candidate:', candidateId);

    // Return updated data
    return await getCandidate(candidateId);
  } catch (error) {
    debug.error('[Candidates API] Error updating candidate:', error);
    throw error;
  }
}

/**
 * Update multiple candidate fields at once
 *
 * @param {string} candidateId - Candidate document ID
 * @param {Object} updates - Object with field: value pairs
 * @returns {Promise<Object>} Updated candidate data
 */
export async function updateCandidate(candidateId, updates) {
  const db = getFirebaseFirestore();
  const auth = getFirebaseAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Notandi er ekki innskráður');
  }

  const docRef = doc(db, 'nomination-candidates', candidateId);

  try {
    debug.log('[Candidates API] Updating candidate:', { candidateId, fields: Object.keys(updates) });

    // Get current document to update edit history
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error('Frambjóðandi fannst ekki');
    }

    const currentData = docSnap.data();
    const editHistory = currentData.edit_history || [];
    const timestamp = new Date().toISOString();

    // Add edit entries for each changed field
    for (const [field, value] of Object.entries(updates)) {
      if (currentData[field] !== value) {
        editHistory.push({
          field,
          user_id: user.uid,
          user_name: user.displayName || user.email,
          timestamp,
          previous_value: currentData[field] || null
        });
      }
    }

    // Update document
    await updateDoc(docRef, {
      ...updates,
      edit_history: editHistory,
      updated_at: timestamp,
      last_edited_by: {
        user_id: user.uid,
        user_name: user.displayName || user.email,
        timestamp
      }
    });

    debug.log('[Candidates API] Updated candidate:', candidateId);

    // Return updated data
    return await getCandidate(candidateId);
  } catch (error) {
    debug.error('[Candidates API] Error updating candidate:', error);
    throw error;
  }
}

/**
 * Get edit history for a candidate
 * @param {string} candidateId - Candidate document ID
 * @returns {Promise<Array>} Edit history array
 */
export async function getCandidateEditHistory(candidateId) {
  const candidate = await getCandidate(candidateId);
  return candidate?.edit_history || [];
}

export default {
  getAllCandidates,
  getCandidate,
  updateCandidateField,
  updateCandidate,
  getCandidateEditHistory
};
