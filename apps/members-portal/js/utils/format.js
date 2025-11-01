/**
 * Shared Formatting and Validation Utilities (Members Portal)
 * Epic #116 - Member Admin UI
 *
 * Centralizes phone number and kennitala formatting/validation
 * across members portal (dashboard, profile, etc.)
 *
 * Note: This is a copy of /admin/js/utils/format.js for members-area.
 * We keep them separate to avoid cross-dependencies between admin and member portals.
 */

/**
 * Format Icelandic phone number for display
 * @param {string} phone - Phone number in any format
 * @returns {string} Formatted as XXX-XXXX
 *
 * Handles various input formats:
 * - +3545551234 -> 555-1234
 * - 003545551234 -> 555-1234
 * - 5551234 -> 555-1234
 * - 555 1234 -> 555-1234
 * - 555-1234 -> 555-1234 (already formatted)
 */
export function formatPhone(phone) {
  if (!phone) return '';

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // Remove Iceland country code if present (+354 or 00354)
  const localDigits = digits.startsWith('354') && digits.length === 10
    ? digits.substring(3)
    : digits;

  // Format as XXX-XXXX (3 digits - hyphen - 4 digits)
  if (localDigits.length === 7) {
    return `${localDigits.substring(0, 3)}-${localDigits.substring(3)}`;
  }

  // Return original if invalid format
  return phone;
}

/**
 * Normalize phone for comparison
 * @param {string} phone - Phone number in any format
 * @returns {string} Just digits without country code (7 digits)
 *
 * This is used for comparing phone numbers from different sources
 * (Kenni.is might have +354, Firestore might not)
 */
export function normalizePhoneForComparison(phone) {
  if (!phone) return '';

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // Remove Iceland country code if present (+354 or 00354)
  if (digits.startsWith('354') && digits.length === 10) {
    return digits.substring(3); // Return just the 7 local digits
  }

  return digits;
}

/**
 * Format kennitala for display
 * @param {string} kennitala - Kennitala in any format
 * @returns {string} Formatted as DDMMYY-XXXX
 *
 * Handles formats:
 * - 0103003390 -> 010300-3390
 * - 010300-3390 -> 010300-3390 (already formatted)
 */
export function formatKennitala(kennitala) {
  if (!kennitala) return '';

  // Remove hyphen for processing
  const cleaned = kennitala.replace(/-/g, '');

  // Must be 10 digits
  if (cleaned.length !== 10 || !/^\d+$/.test(cleaned)) {
    return kennitala; // Return original if invalid
  }

  // Format as DDMMYY-XXXX
  return `${cleaned.substring(0, 6)}-${cleaned.substring(6)}`;
}

/**
 * Mask kennitala for privacy (display only)
 * @param {string} kennitala - Kennitala in any format
 * @returns {string} Masked as DDMMYY-****
 *
 * Shows birthdate (first 6 digits) but masks personal identifier (last 4 digits)
 *
 * Examples:
 * - 010300-3390 -> 010300-****
 * - 0103003390 -> 010300-****
 */
export function maskKennitala(kennitala) {
  if (!kennitala) return '-';

  // Remove hyphen for processing
  const cleaned = kennitala.replace(/-/g, '');

  // Must be 10 digits
  if (cleaned.length !== 10 || !/^\d+$/.test(cleaned)) {
    return kennitala; // Return original if invalid
  }

  // Show first 6 digits (birthdate), add hyphen, mask last 4
  return `${cleaned.substring(0, 6)}-****`;
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid Icelandic phone number
 *
 * Accepts:
 * - 555-1234 (local format with hyphen)
 * - 5551234 (local format without hyphen)
 * - +3545551234 (international format with +)
 * - 003545551234 (international format with 00)
 * - 555 1234 (with spaces)
 */
export function validatePhone(phone) {
  if (!phone) return false;

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // Check for international format with country code
  if (digits.startsWith('354') && digits.length === 10) {
    return true; // +354XXXXXXX format (10 digits total)
  }

  // Check for local format (7 digits)
  return digits.length === 7;
}

/**
 * Validate kennitala format
 * @param {string} kennitala - Kennitala to validate
 * @returns {boolean} True if valid format (does NOT verify checksum)
 *
 * Accepts:
 * - 010300-3390 (with hyphen)
 * - 0103003390 (without hyphen)
 *
 * Note: This only validates format (10 digits), not the mathematical checksum.
 * Kenni.is OAuth has already validated the kennitala, so we trust it.
 */
export function validateKennitala(kennitala) {
  if (!kennitala) return false;

  // Remove hyphen for validation
  const cleaned = kennitala.replace(/-/g, '');

  // Must be exactly 10 digits
  return cleaned.length === 10 && /^\d+$/.test(cleaned);
}
