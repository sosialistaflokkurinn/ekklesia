/**
 * Members API Client
 *
 * Shared client for member profile updates with optimistic update pattern.
 * Updates Firestore first (instant UI feedback), then syncs to Django backend.
 * Includes automatic rollback if Django update fails.
 *
 * Usage:
 *   import { updateMemberProfile } from './api/members-client.js';
 *
 *   await updateMemberProfile(kennitala, {
 *     name: 'New Name',
 *     email: 'new@email.com',
 *     phone: '7751234'
 *   });
 */

import { getFirebaseFirestore } from '../firebase/app.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';

/**
 * Update member profile in Firestore
 *
 * @param {string} kennitala - Member's kennitala (with or without hyphen)
 * @param {Object} updates - Fields to update (name, email, phone)
 * @returns {Promise<void>}
 * @private
 */
async function updateFirestoreMember(kennitala, updates) {
  const db = getFirebaseFirestore();

  // Normalize kennitala (remove hyphen for document ID)
  const kennitalaNoHyphen = kennitala.replace(/-/g, '');
  const memberRef = doc(db, 'members', kennitalaNoHyphen);

  // Build Firestore update object (nested under profile)
  const firestoreUpdates = {};

  if (updates.name) {
    firestoreUpdates['profile.name'] = updates.name;
  }

  if (updates.email) {
    firestoreUpdates['profile.email'] = updates.email;
  }

  if (updates.phone) {
    // Normalize phone to XXX-XXXX format
    const phoneDigits = updates.phone.replace(/[^0-9]/g, '');
    if (phoneDigits.length === 7) {
      firestoreUpdates['profile.phone'] = `${phoneDigits.slice(0, 3)}-${phoneDigits.slice(3)}`;
    } else {
      firestoreUpdates['profile.phone'] = updates.phone;
    }
  }

  // Always update last modified timestamp
  firestoreUpdates['metadata.last_modified'] = new Date();

  await updateDoc(memberRef, firestoreUpdates);

  console.log('✅ Firestore updated:', {
    kennitala: kennitalaNoHyphen,
    fields: Object.keys(firestoreUpdates)
  });
}

/**
 * Update member profile in Django backend via Cloud Function
 *
 * @param {string} kennitala - Member's kennitala (normalized, no hyphen)
 * @param {Object} updates - Fields to update (name, email, phone)
 * @param {string} region - Firebase Functions region (default: 'europe-west2')
 * @returns {Promise<Object>} Django update result
 * @private
 */
async function updateDjangoMember(kennitala, updates, region = 'europe-west2') {
  // Call Cloud Function using Firebase callable function API
  const updateMemberProfile = httpsCallable('updatememberprofile', region);

  try {
    const result = await updateMemberProfile({
      kennitala: kennitala,
      updates: updates
    });

    // Log success without exposing full member data (PII protection)
    console.log('✅ Django updated:', {
      success: result.data.success,
      django_id: result.data.django_id,
      updated_fields: result.data.updated_fields
    });

    return result.data;
  } catch (error) {
    console.error('❌ Django update failed:', error);
    throw new Error(`Villa við uppfærslu Django gagnagrunns: ${error.message}`);
  }
}

/**
 * Rollback Firestore changes after Django update failure
 *
 * @param {string} kennitala - Member's kennitala
 * @param {Object} originalData - Original member data before update
 * @private
 */
async function rollbackFirestore(kennitala, originalData) {
  const db = getFirebaseFirestore();
  const kennitalaNoHyphen = kennitala.replace(/-/g, '');
  const memberRef = doc(db, 'members', kennitalaNoHyphen);

  // Restore original profile data
  const rollbackUpdates = {};
  if (originalData.profile) {
    if (originalData.profile.name) rollbackUpdates['profile.name'] = originalData.profile.name;
    if (originalData.profile.email) rollbackUpdates['profile.email'] = originalData.profile.email;
    if (originalData.profile.phone) rollbackUpdates['profile.phone'] = originalData.profile.phone;
  }

  await updateDoc(memberRef, rollbackUpdates);

  console.log('🔄 Firestore rolled back:', {
    kennitala: kennitalaNoHyphen,
    fields: Object.keys(rollbackUpdates)
  });
}

/**
 * Update member profile with optimistic update pattern
 *
 * This function:
 * 1. Updates Firestore immediately (instant UI feedback)
 * 2. Updates Django backend (source of truth)
 * 3. Rolls back Firestore if Django update fails
 *
 * @param {string} kennitala - Member's kennitala (with or without hyphen)
 * @param {Object} updates - Fields to update { name, email, phone }
 * @param {Object} originalData - Original member data (for rollback)
 * @param {string} region - Firebase Functions region (default: 'europe-west2')
 * @returns {Promise<void>}
 * @throws {Error} If Django update fails (Firestore will be rolled back)
 *
 * @example
 * try {
 *   await updateMemberProfile(kennitala, {
 *     name: 'Nýtt Nafn',
 *     email: 'nytt@netfang.is',
 *     phone: '7751234'
 *   }, originalMemberData);
 *
 *   // Show success message
 * } catch (error) {
 *   // Show error message (Firestore already rolled back)
 * }
 */
export async function updateMemberProfile(kennitala, updates, originalData, region = 'europe-west2') {
  // Normalize kennitala for Django API
  const kennitalaNoHyphen = kennitala.replace(/-/g, '');

  // Step 1: Optimistic update - Update Firestore first (instant feedback)
  await updateFirestoreMember(kennitalaNoHyphen, updates);

  try {
    // Step 2: Update Django (source of truth)
    await updateDjangoMember(kennitalaNoHyphen, updates, region);

    // Success! Both Firestore and Django updated
  } catch (error) {
    // Step 3: Django failed - Roll back Firestore changes
    console.warn('⚠️ Rolling back Firestore due to Django failure');

    try {
      await rollbackFirestore(kennitalaNoHyphen, originalData);
    } catch (rollbackError) {
      console.error('❌ Rollback failed:', rollbackError);
      // Even if rollback fails, we still throw the original error
    }

    // Re-throw error so caller knows update failed
    throw error;
  }
}
