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

import { getFirebaseFirestore, httpsCallable } from '../../firebase/app.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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

  if ('foreign_phone' in updates) {
    // Store foreign phone as-is (already validated)
    firestoreUpdates['profile.foreign_phone'] = updates.foreign_phone;
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
    if ('foreign_phone' in originalData.profile) rollbackUpdates['profile.foreign_phone'] = originalData.profile.foreign_phone;
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

/**
 * Update member foreign address in Firestore
 *
 * @param {string} kennitala - Member's kennitala (normalized, no hyphen)
 * @param {Object} foreignAddress - Foreign address data { country, address, postal_code, municipality, current }
 * @returns {Promise<void>}
 * @private
 */
async function updateFirestoreForeignAddress(kennitala, foreignAddress) {
  const db = getFirebaseFirestore();
  const memberRef = doc(db, 'members', kennitala);

  // Build Firestore update object for foreign address
  const firestoreUpdates = {
    'profile.foreign_address': foreignAddress,
    'metadata.last_modified': new Date()
  };

  await updateDoc(memberRef, firestoreUpdates);

  console.log('✅ Firestore foreign address updated:', {
    kennitala,
    country: foreignAddress.country
  });
}

/**
 * Update member foreign address in Django backend via Cloud Function proxy
 *
 * Issue #161: Implemented! Uses Cloud Function to securely call Django API.
 *
 * @param {string} kennitala - Member's kennitala (normalized, no hyphen)
 * @param {Object} foreignAddress - Foreign address data { country, address, postal_code, municipality, current }
 * @param {string} region - Firebase Functions region (default: 'europe-west2')
 * @returns {Promise<Object>} Django update result
 * @private
 * @throws {Error} If Django API call fails
 */
async function updateDjangoForeignAddress(kennitala, foreignAddress, region = 'europe-west2') {
  // Call Cloud Function that proxies to Django API
  // This keeps the Django API token secure server-side
  const updateForeignAddress = httpsCallable('updatememberforeignaddress', region);

  try {
    const result = await updateForeignAddress({
      kennitala: kennitala,
      foreign_address: foreignAddress
    });

    console.log('✅ Django foreign address updated:', {
      success: result.data.success,
      django_id: result.data.django_id,
      method: result.data.method  // 'POST' or 'PATCH'
    });

    return result.data;
  } catch (error) {
    console.error('❌ Django foreign address update failed:', error);
    throw new Error(`Villa við uppfærslu Django erlends heimilisfangs: ${error.message}`);
  }
}

/**
 * Rollback Firestore foreign address changes after Django update failure
 *
 * @param {string} kennitala - Member's kennitala
 * @param {Object} originalForeignAddress - Original foreign address data before update (or null)
 * @private
 */
async function rollbackFirestoreForeignAddress(kennitala, originalForeignAddress) {
  const db = getFirebaseFirestore();
  const memberRef = doc(db, 'members', kennitala);

  // Restore original foreign address (or remove if didn't exist before)
  const rollbackUpdates = {};

  if (originalForeignAddress) {
    rollbackUpdates['profile.foreign_address'] = originalForeignAddress;
  } else {
    // Foreign address didn't exist before, remove it
    rollbackUpdates['profile.foreign_address'] = null;
  }

  await updateDoc(memberRef, rollbackUpdates);

  console.log('🔄 Firestore foreign address rolled back:', {
    kennitala
  });
}

/**
 * Update member foreign address with optimistic update pattern
 *
 * This function:
 * 1. Updates Firestore immediately (instant UI feedback)
 * 2. Updates Django backend (source of truth) - BLOCKED ON ISSUE #161
 * 3. Rolls back Firestore if Django update fails
 *
 * @param {string} kennitala - Member's kennitala (with or without hyphen)
 * @param {Object} foreignAddress - Foreign address data { country, address, postal_code, municipality, current }
 * @param {Object} originalForeignAddress - Original foreign address data (for rollback, or null if new)
 * @param {string} region - Firebase Functions region (default: 'europe-west2')
 * @returns {Promise<void>}
 * @throws {Error} If Django update fails (Firestore will be rolled back)
 *
 * @example
 * try {
 *   await updateMemberForeignAddress(kennitala, {
 *     country: 'US',
 *     address: '123 Main St',
 *     postal_code: '98101',
 *     municipality: 'Seattle',
 *     current: true
 *   }, originalForeignAddress);
 *
 *   // Show success message
 * } catch (error) {
 *   // Show error message (Firestore already rolled back)
 * }
 */
export async function updateMemberForeignAddress(kennitala, foreignAddress, originalForeignAddress, region = 'europe-west2') {
  // Normalize kennitala
  const kennitalaNoHyphen = kennitala.replace(/-/g, '');

  // Step 1: Optimistic update - Update Firestore first (instant feedback)
  await updateFirestoreForeignAddress(kennitalaNoHyphen, foreignAddress);

  try {
    // Step 2: Update Django (source of truth)
    // NOTE: This will throw error until Issue #161 is implemented
    await updateDjangoForeignAddress(kennitalaNoHyphen, foreignAddress, region);

    // Success! Both Firestore and Django updated
  } catch (error) {
    // Step 3: Django failed - Roll back Firestore changes
    console.warn('⚠️ Rolling back Firestore foreign address due to Django failure');

    try {
      await rollbackFirestoreForeignAddress(kennitalaNoHyphen, originalForeignAddress);
    } catch (rollbackError) {
      console.error('❌ Foreign address rollback failed:', rollbackError);
      // Even if rollback fails, we still throw the original error
    }

    // Re-throw error so caller knows update failed
    throw error;
  }
}
