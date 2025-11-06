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

import { debug } from '../utils/debug.js';
import { getCountriesSorted, getCountryCallingCode } from '../utils/countries.js';

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

  // If addresses already exists, no migration needed
  if (currentUserData?.profile?.addresses && currentUserData.profile.addresses.length > 0) {
    debug.log('   ✅ Using existing addresses array:', currentUserData.profile.addresses);
    return [...currentUserData.profile.addresses];
  }

  debug.log('   📦 No addresses array found, checking old fields...');

  if (currentUserData?.profile) {
    debug.log('   Available profile keys:', Object.keys(currentUserData.profile));
  }

  // Check for old fields in multiple possible locations
  const livingStatus = currentUserData?.profile?.living_status || currentUserData?.living_status;

  // Iceland address might be in different formats
  const icelandAddress = currentUserData?.profile?.address || currentUserData?.address;
  const addressIceland = currentUserData?.profile?.address_iceland;

  const postalCode = currentUserData?.profile?.postal_code || currentUserData?.postal_code;
  const city = currentUserData?.profile?.city || currentUserData?.city;
  const country = currentUserData?.profile?.country || currentUserData?.country;

  // Foreign address is an object
  const foreignAddressObj = currentUserData?.profile?.foreign_address || currentUserData?.foreign_address;

  debug.log(`   Living status: ${livingStatus}`);
  debug.log(`   Iceland address (string): ${typeof icelandAddress === 'string' ? icelandAddress : '[object]'}, ${postalCode} ${city}`);
  debug.log(`   Iceland address (object):`, addressIceland);
  debug.log(`   Foreign address (object):`, foreignAddressObj);

  const addresses = [];

  /**
   * Helper: Build Iceland address object from data
   * @param {Object|string} addressData - Address data (object or string)
   * @param {string} [postalCode] - Postal code (for flat format)
   * @param {string} [city] - City (for flat format)
   * @returns {Object} Iceland address object
   */
  const buildIcelandAddress = (addressData, postalCode = '', city = '') => {
    // Object format
    if (addressData && typeof addressData === 'object') {
      return {
        country: 'IS',
        street: addressData.street || addressData.address || '',
        postal_code: addressData.postal_code || '',
        city: addressData.city || addressData.municipality || '',
        is_default: true
      };
    }
    // String/flat format
    return {
      country: 'IS',
      street: (typeof addressData === 'string' ? addressData.trim() : '') || '',
      postal_code: (typeof postalCode === 'string' ? postalCode.trim() : '') || '',
      city: (typeof city === 'string' ? city.trim() : '') || '',
      is_default: true
    };
  };

  // Check for Iceland address (might be in address_iceland object, address object, or flat fields)
  let hasIcelandAddress = false;
  
  // First check: address_iceland object
  if (addressIceland && typeof addressIceland === 'object') {
    const icelandAddr = buildIcelandAddress(addressIceland);
    if (icelandAddr.street || icelandAddr.postal_code) {
      addresses.push(icelandAddr);
      hasIcelandAddress = true;
      debug.log('   ✅ Migrated Iceland address (address_iceland object):', icelandAddr);
    }
  }
  // Second check: address object (from memberData.address)
  else if (icelandAddress && typeof icelandAddress === 'object') {
    const icelandAddr = buildIcelandAddress(icelandAddress);
    if (icelandAddr.street || icelandAddr.postal_code) {
      addresses.push(icelandAddr);
      hasIcelandAddress = true;
      debug.log('   ✅ Migrated Iceland address (address object):', icelandAddr);
    }
  }
  // Third check: flat fields or string format
  else if ((typeof icelandAddress === 'string' && icelandAddress) || postalCode || city) {
    const icelandAddr = buildIcelandAddress(icelandAddress, postalCode, city);
    if (icelandAddr.street || icelandAddr.postal_code) {
      addresses.push(icelandAddr);
      hasIcelandAddress = true;
      debug.log('   ✅ Migrated Iceland address (flat):', icelandAddr);
    }
  }

  // Check for foreign address (object format)
  if (foreignAddressObj && typeof foreignAddressObj === 'object') {
    const foreignAddr = {
      country: foreignAddressObj.country || country || '',
      street: foreignAddressObj.address || foreignAddressObj.street || '',
      postal_code: foreignAddressObj.postal_code || '',
      city: foreignAddressObj.municipality || foreignAddressObj.city || '',
      is_default: !hasIcelandAddress  // Default if no Iceland address
    };
    if (foreignAddr.street || foreignAddr.country) {
      addresses.push(foreignAddr);
      debug.log('   ✅ Migrated foreign address:', foreignAddr);
    }
  }

  // If no addresses migrated, add one empty Iceland address for user to fill
  if (addresses.length === 0) {
    debug.log('   ℹ️ No old address data found, adding empty Iceland address');
    addresses.push({
      country: 'IS',
      street: '',
      postal_code: '',
      city: '',
      is_default: true
    });
  } else {
    debug.log(`   ✅ Migration complete: ${addresses.length} address(es) migrated`);
  }

  return addresses;
}
