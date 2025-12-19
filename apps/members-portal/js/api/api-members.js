/**
 * Members API Client
 *
 * Shared client for member profile updates with optimistic update pattern.
 * Updates Firestore first (instant UI feedback), then syncs to Django backend.
 * Includes automatic rollback if Django update fails.
 *
 * Usage:
 *   import { updateMemberProfile } from './api/api-members.js';
 *
 *   await updateMemberProfile(kennitala, {
 *     name: 'New Name',
 *     email: 'new@email.com',
 *     phone: '7751234'
 *   });
 */

import { getFirebaseFirestore, httpsCallable, doc, updateDoc } from '../../firebase/app.js';
import { debug } from '../utils/util-debug.js';
import { R } from '../../i18n/strings-loader.js';
import {
  validateMemberProfileUpdate,
  isValidKennitala,
  ValidationError
} from '../utils/util-validation.js';

// Re-export ValidationError for consumers
export { ValidationError };

/**
 * Generic Firestore document updater
 * @param {string} kennitala - Member's kennitala
 * @param {Object} updates - Fields to update (with dot notation keys)
 * @param {boolean} addTimestamp - Whether to add last_modified timestamp
 * @returns {Promise<string[]>} Updated field keys
 * @private
 */
async function updateFirestoreDoc(kennitala, updates, addTimestamp = true) {
  const db = getFirebaseFirestore();
  const kennitalaNoHyphen = kennitala.replace(/-/g, '');
  const memberRef = doc(db, 'members', kennitalaNoHyphen);

  const finalUpdates = { ...updates };
  if (addTimestamp) {
    finalUpdates['metadata.last_modified'] = new Date();
  }

  await updateDoc(memberRef, finalUpdates);
  return Object.keys(finalUpdates);
}

/**
 * Update member profile in Firestore
 *
 * @param {string} kennitala - Member's kennitala (with or without hyphen)
 * @param {Object} updates - Fields to update (name, email, phone)
 * @returns {Promise<void>}
 * @private
 */
async function updateFirestoreMember(kennitala, updates) {
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

  if ('foreign_phone' in updates) {
    // Store foreign phone as-is (already validated)
    firestoreUpdates['profile.foreign_phone'] = updates.foreign_phone;
  }

  // Use shared helper to update Firestore
  const fields = await updateFirestoreDoc(kennitala, firestoreUpdates);

  debug.log('✅ Firestore updated:', {
    kennitala: kennitala.replace(/-/g, ''),
    fields
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
    debug.log('✅ Django updated:', {
      success: result.data.success,
      django_id: result.data.django_id,
      updated_fields: result.data.updated_fields
    });

    return result.data;
  } catch (error) {
    debug.error('❌ Django update failed:', error);
    throw new Error(R.format(R.string.error_django_update, error.message));
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
  // Restore original profile data
  const rollbackUpdates = {};
  if (originalData.profile) {
    if (originalData.profile.name) rollbackUpdates['profile.name'] = originalData.profile.name;
    if (originalData.profile.email) rollbackUpdates['profile.email'] = originalData.profile.email;
    if (originalData.profile.phone) rollbackUpdates['profile.phone'] = originalData.profile.phone;
    if ('foreign_phone' in originalData.profile) rollbackUpdates['profile.foreign_phone'] = originalData.profile.foreign_phone;
  }

  // Use shared helper to update Firestore (don't add new timestamp on rollback)
  const fields = await updateFirestoreDoc(kennitala, rollbackUpdates, false);

  debug.log('🔄 Firestore rolled back:', {
    kennitala: kennitala.replace(/-/g, ''),
    fields
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
  // Validate kennitala
  const kennitalaNoHyphen = kennitala.replace(/-/g, '');
  if (!isValidKennitala(kennitalaNoHyphen)) {
    throw new ValidationError('Ógild kennitala', 'kennitala');
  }

  // Validate and sanitize updates
  let validatedUpdates;
  try {
    validatedUpdates = validateMemberProfileUpdate(updates);
  } catch (error) {
    debug.warn('Validation failed:', error.message);
    throw error;
  }

  // Check if there are any valid updates
  if (Object.keys(validatedUpdates).length === 0) {
    debug.log('No valid updates to apply');
    return;
  }

  // Step 1: Optimistic update - Update Firestore first (instant feedback)
  await updateFirestoreMember(kennitalaNoHyphen, validatedUpdates);

  try {
    // Step 2: Update Django (source of truth)
    await updateDjangoMember(kennitalaNoHyphen, validatedUpdates, region);

    // Success! Both Firestore and Django updated
  } catch (error) {
    // Step 3: Django failed - Roll back Firestore changes
    debug.warn('⚠️ Rolling back Firestore due to Django failure');

    try {
      await rollbackFirestore(kennitalaNoHyphen, originalData);
    } catch (rollbackError) {
      debug.error('❌ Rollback failed:', rollbackError);
      // Even if rollback fails, we still throw the original error
    }

    // Re-throw error so caller knows update failed
    throw error;
  }
}






