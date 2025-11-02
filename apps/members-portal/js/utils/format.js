/**
 * Shared Formatting and Validation Utilities (Members Portal)
 * Epic #116 - Member Admin UI
 *
 * Centralizes phone number and kennitala formatting/validation
 * across members portal (dashboard, profile, etc.)
 *
 * Note: This is synchronized with /admin/js/utils/format.js (admin portal).
 * Keep both files in sync when making changes.
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

/**
 * Validate international phone number (E.164 format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid international format
 *
 * Accepts E.164 format: +[country code][number]
 * Examples:
 * - +354 775-8492 (Iceland)
 * - +45 12345678 (Denmark)
 * - +1 (555) 123-4567 (USA)
 * - +44 20 7946 0958 (UK)
 *
 * Format: +[1-3 digits country code][6-20 digits number]
 * Allows spaces, hyphens, parentheses for readability
 */
export function validateInternationalPhone(phone) {
  if (!phone) return false;

  // Must start with +
  if (!phone.startsWith('+')) return false;

  // Remove all non-digits except the leading +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // Must have format: +[country code 1-3 digits][number 6-20 digits]
  // Total length: 8-24 characters (+ and digits)
  if (cleaned.length < 8 || cleaned.length > 24) return false;

  // Check format: + followed by digits only
  return /^\+[0-9]{7,23}$/.test(cleaned);
}

/**
 * Format international phone number for display
 * @param {string} phone - International phone number
 * @returns {string} Formatted phone or original if invalid
 *
 * Attempts to format international phones for better readability:
 * - Keeps country code with +
 * - Preserves existing formatting (spaces, hyphens)
 * - If no formatting, adds space after country code
 *
 * Examples:
 * - +3547758492 -> +354 775-8492 (Iceland)
 * - +4512345678 -> +45 12345678 (Denmark)
 */
export function formatInternationalPhone(phone) {
  if (!phone) return '';
  if (!phone.startsWith('+')) return phone;

  // If already has spaces or hyphens, keep as-is
  if (phone.includes(' ') || phone.includes('-')) {
    return phone;
  }

  // Extract country code and number
  const digits = phone.substring(1); // Remove +

  // Common country codes (1-3 digits)
  const countryCodes = {
    '1': 1,     // USA, Canada
    '7': 1,     // Russia
    '20': 2,    // Egypt
    '27': 2,    // South Africa
    '30': 2,    // Greece
    '31': 2,    // Netherlands
    '32': 2,    // Belgium
    '33': 2,    // France
    '34': 2,    // Spain
    '39': 2,    // Italy
    '40': 2,    // Romania
    '41': 2,    // Switzerland
    '43': 2,    // Austria
    '44': 2,    // UK
    '45': 2,    // Denmark
    '46': 2,    // Sweden
    '47': 2,    // Norway
    '48': 2,    // Poland
    '49': 2,    // Germany
    '354': 3,   // Iceland
    '358': 3,   // Finland
  };

  // Find matching country code
  for (const [code, length] of Object.entries(countryCodes)) {
    if (digits.startsWith(code)) {
      const number = digits.substring(length);

      // Special formatting for Iceland
      if (code === '354' && number.length === 7) {
        return `+${code} ${number.substring(0, 3)}-${number.substring(3)}`;
      }

      // Default: add space after country code
      return `+${code} ${number}`;
    }
  }

  // Unknown country code, just add space after first 1-3 digits
  if (digits.length > 3) {
    return `+${digits.substring(0, 2)} ${digits.substring(2)}`;
  }

  return phone;
}

/**
 * Validate international postal code
 * @param {string} code - Postal code to validate
 * @param {string} country - Optional ISO country code for specific validation
 * @returns {boolean} True if valid format
 *
 * Accepts various international formats:
 * - 3-16 alphanumeric characters
 * - May include spaces, hyphens
 *
 * Country-specific formats (if country provided):
 * - IS: 3 digits (e.g., "101")
 * - DK: 4 digits (e.g., "2100")
 * - NO: 4 digits (e.g., "0150")
 * - SE: 5 digits with space (e.g., "123 45")
 * - US: 5 digits or ZIP+4 (e.g., "12345" or "12345-6789")
 * - GB: 6-8 chars (e.g., "SW1A 1AA")
 * - CA: 6 chars with space (e.g., "K1A 0B1")
 */
export function validateInternationalPostalCode(code, country = null) {
  if (!code) return false;

  const cleaned = code.trim();
  if (cleaned.length < 3 || cleaned.length > 16) return false;

  // If country specified, use country-specific validation
  if (country) {
    const upperCountry = country.toUpperCase();

    switch (upperCountry) {
      case 'IS': // Iceland: 3 digits
        return /^[0-9]{3}$/.test(cleaned);

      case 'DK': // Denmark: 4 digits
      case 'NO': // Norway: 4 digits
        return /^[0-9]{4}$/.test(cleaned);

      case 'SE': // Sweden: 5 digits, optional space (123 45 or 12345)
        return /^[0-9]{3}\s?[0-9]{2}$/.test(cleaned);

      case 'FI': // Finland: 5 digits
        return /^[0-9]{5}$/.test(cleaned);

      case 'US': // USA: 5 digits or ZIP+4
        return /^[0-9]{5}(-[0-9]{4})?$/.test(cleaned);

      case 'GB': // UK: Complex format, 6-8 chars
        return /^[A-Z]{1,2}[0-9]{1,2}[A-Z]?\s?[0-9][A-Z]{2}$/i.test(cleaned);

      case 'CA': // Canada: A1A 1A1 format
        return /^[A-Z][0-9][A-Z]\s?[0-9][A-Z][0-9]$/i.test(cleaned);

      case 'DE': // Germany: 5 digits
        return /^[0-9]{5}$/.test(cleaned);

      case 'FR': // France: 5 digits
        return /^[0-9]{5}$/.test(cleaned);

      case 'NL': // Netherlands: 4 digits + 2 letters (1234 AB)
        return /^[0-9]{4}\s?[A-Z]{2}$/i.test(cleaned);
    }
  }

  // Generic validation: 3-16 alphanumeric, may include space/hyphen
  return /^[A-Z0-9\s-]{3,16}$/i.test(cleaned);
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} HTML-safe string
 *
 * Converts special characters to HTML entities:
 * - < becomes &lt;
 * - > becomes &gt;
 * - & becomes &amp;
 * - " becomes &quot;
 * - ' becomes &#039;
 *
 * Use when inserting user-provided text into HTML via innerHTML
 * (though using textContent is preferred when possible)
 */
export function escapeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
