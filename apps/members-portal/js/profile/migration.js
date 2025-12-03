/**
 * Data Migration Utilities
 *
 * Handles lazy migration from old profile data structures to new formats.
 * Migrations happen on first profile page load if new structures don't exist.
 *
 * Old schema → New schema:
 * - phone + foreign_phone → phone_numbers[]
 * - living_status + address fields → addresses[]
 *
 * @module profile/migration
 */

import { debug } from '../utils/util-debug.js';
import { getCountriesSorted, getCountryCallingCode } from '../utils/util-countries.js';

/**
 * Migrate old phone fields to phone_numbers array
 *
 * Old schema:
 * - profile.phone (string) - Icelandic phone
 * - profile.foreign_phone (string) - International E.164 format
 *
 * New schema:
 * - profile.phone_numbers (array) - [{country, number, is_default}]
 *
 * @param {Object} currentUserData - User data with profile
 * @returns {Array} Migrated phone numbers array
 */
export function migrateOldPhoneFields(currentUserData) {
  // If phone_numbers already exists, no migration needed
  if (currentUserData?.profile?.phone_numbers && currentUserData.profile.phone_numbers.length > 0) {
    return [...currentUserData.profile.phone_numbers];
  }

  const oldPhone = currentUserData?.profile?.phone;
  const oldForeignPhone = currentUserData?.profile?.foreign_phone;

  const phoneNumbers = [];

  // Add old Icelandic phone (if exists)
  if (oldPhone && oldPhone.trim()) {
    phoneNumbers.push({
      country: 'IS',
      number: oldPhone.trim(),
      is_default: true  // First phone is default
    });
  }

  // Add old foreign phone (if exists)
  if (oldForeignPhone && oldForeignPhone.trim()) {
    let countryCode = 'IS';  // Default to Iceland if parsing fails
    let number = oldForeignPhone;

    // Try to detect country from calling code (E.164 format: +4512345678)
    if (oldForeignPhone.startsWith('+')) {
      const match = oldForeignPhone.match(/^\+(\d{1,4})/);
      if (match) {
        const callingCode = `+${match[1]}`;
        // Find country by calling code (reverse lookup)
        const countries = getCountriesSorted();
        const foundCountry = countries.find(c => getCountryCallingCode(c.code) === callingCode);
        if (foundCountry) {
          countryCode = foundCountry.code;
          // Remove calling code from number
          number = oldForeignPhone.substring(match[0].length);
        }
      }
    }

    phoneNumbers.push({
      country: countryCode,
      number: number,
      is_default: phoneNumbers.length === 0  // If no Icelandic phone, this is default
    });
  }

  return phoneNumbers;
}

/**
 * Migrate old address fields to addresses array
 *
 * Old schema:
 * - living_status ('iceland', 'abroad', 'both')
 * - address, postal_code, city (Iceland)
 * - address_iceland {street, postal_code, city} (alternative)
 * - foreign_address {country, address/street, postal_code, municipality/city}
 *
 * New schema:
 * - profile.addresses (array) - [{country, street, postal_code, city, is_default}]
 *
 * @param {Object} currentUserData - User data with profile
 * @returns {Array} Migrated addresses array
 */
export function migrateOldAddressFields(currentUserData) {
  debug.log('🏠 Migrating old address fields...');
  debug.log('   Full currentUserData:', currentUserData);
  debug.log('   Profile data:', currentUserData?.profile);

  // If addresses already exists, ensure all fields are present (patch missing fields)
  if (currentUserData?.profile?.addresses && currentUserData.profile.addresses.length > 0) {
    debug.log('   ✅ Found existing addresses array, checking for missing fields...');

    // ONE-TIME migration: Check if old address structure has number/letter we can migrate
    const oldAddress = currentUserData?.address;
    debug.log('   📋 Checking old address structure for number/letter:', oldAddress);

    let needsPatch = false;
    const patchedAddresses = currentUserData.profile.addresses.map((addr, index) => {
      // Check if number or letter field is missing
      let numberValue = addr.number !== undefined ? String(addr.number) : '';
      let letterValue = addr.letter !== undefined ? String(addr.letter) : '';

      // ONE-TIME migration: If number/letter missing in new structure but exists in old, migrate it
      if (addr.country === 'IS' && oldAddress && typeof oldAddress === 'object') {
        // Check if old address has number (can be number type or string)
        const hasOldNumber = oldAddress.number != null && String(oldAddress.number).trim() !== '';
        if ((addr.number === undefined || addr.number === '') && hasOldNumber) {
          numberValue = String(oldAddress.number);
          needsPatch = true;
          debug.log(`   🔄 ONE-TIME migration: number from old address: ${numberValue}`);
        }
        // Check if old address has letter
        const hasOldLetter = oldAddress.letter != null && String(oldAddress.letter).trim() !== '';
        if ((addr.letter === undefined || addr.letter === '') && hasOldLetter) {
          letterValue = String(oldAddress.letter);
          needsPatch = true;
          debug.log(`   🔄 ONE-TIME migration: letter from old address: ${letterValue}`);
        }
      }

      if (addr.number === undefined || addr.letter === undefined) {
        needsPatch = true;
      }

      // Ensure all required fields exist
      const patched = {
        country: addr.country || 'IS',
        street: addr.street || '',
        number: numberValue,
        letter: letterValue,
        postal_code: addr.postal_code || '',
        city: addr.city || '',
        is_default: addr.is_default !== undefined ? addr.is_default : false
      };

      if (needsPatch) {
        debug.log(`   🔧 Patched address:`, patched);
      }
      return patched;
    });

    // Mark that patching was needed so we can auto-save
    patchedAddresses._needsSave = needsPatch;
    return patchedAddresses;
  }

  // No addresses array found - try to migrate from old address structure
  const oldAddress = currentUserData?.address;
  debug.log('   📦 No addresses array found, checking old address structure:', oldAddress);

  // If old address exists, migrate it to new format
  if (oldAddress && typeof oldAddress === 'object') {
    debug.log('   🔄 Migrating from old address structure...');
    const migratedAddress = {
      country: 'IS',
      street: oldAddress.street || '',
      number: oldAddress.number != null ? String(oldAddress.number) : '',
      letter: oldAddress.letter || '',
      postal_code: oldAddress.postal_code || '',
      city: oldAddress.city || '',
      is_default: true
    };
    debug.log('   ✅ Migrated address:', migratedAddress);

    // Mark for auto-save
    const addresses = [migratedAddress];
    addresses._needsSave = true;
    return addresses;
  }

  // No old address either - create empty template
  debug.log('   ℹ️ No old address found, creating empty Iceland address');
  return [{
    country: 'IS',
    street: '',
    number: '',
    letter: '',
    postal_code: '',
    city: '',
    is_default: true
  }];
}

/**
 * Check if old address field should be deleted
 *
 * @param {Object} currentUserData - User data
 * @returns {boolean} True if old address field exists and should be deleted
 */
export function shouldDeleteOldAddressField(currentUserData) {
  // If old address exists at root level and we have migrated to profile.addresses
  const hasOldAddress = currentUserData?.address && typeof currentUserData.address === 'object';
  const hasNewAddresses = currentUserData?.profile?.addresses && currentUserData.profile.addresses.length > 0;

  return hasOldAddress && hasNewAddresses;
}
