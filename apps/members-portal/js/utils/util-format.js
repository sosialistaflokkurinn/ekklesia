import { el } from './util-dom.js';

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
 * - 0103009999 -> 010300-9999 (example: DDMMYYXXXX -> DDMMYY-XXXX)
 * - 010300-9999 -> 010300-9999 (already formatted; DDMMYY-XXXX)
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
 * - 120174-3399 -> 120174-****
 * - 1201743399 -> 120174-****
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
 * - 120174-3399 (with hyphen, DDMMYY-XXXX)
 * - 1201743399 (without hyphen, DDMMYYXXXX)
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
 * - +354 999-9999 (Iceland)
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

  // Remove all non-digits
  const digitsOnly = phone.replace(/\D/g, '');

  // Very permissive: just need at least 5 digits total
  // This allows almost any international format
  return digitsOnly.length >= 5;
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
 * - +354-999-9999 -> +354 999-9999 (Iceland)
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
  const div = el('div', '', {}, text);
  return div.innerHTML;
}

/**
 * Format membership duration in Icelandic
 * @param {Date} joinDate - Date when member joined
 * @returns {string} Formatted duration in Icelandic (e.g., "8 ár og 7 mánuði")
 *
 * Examples:
 * - 8 years, 7 months: "8 ár og 7 mánuði"
 * - 1 year, 0 months: "1 ár"
 * - 0 years, 3 months: "3 mánuði"
 * - 0 years, 1 month: "1 mánuð"
 * - 0 years, 0 months: "nýskráður"
 */
export function formatMembershipDuration(joinDate) {
  if (!joinDate || !(joinDate instanceof Date)) {
    return '';
  }

  const MONTHS_PER_YEAR = 12;
  const now = new Date();
  const diffYears = now.getFullYear() - joinDate.getFullYear();
  const diffMonths = now.getMonth() - joinDate.getMonth();
  const totalMonths = diffYears * MONTHS_PER_YEAR + diffMonths;
  const years = Math.floor(totalMonths / MONTHS_PER_YEAR);
  const months = totalMonths % MONTHS_PER_YEAR;

  let durationText = '';
  if (years > 0) {
    durationText = years === 1 ? '1 ár' : `${years} ár`;
    if (months > 0) {
      durationText += ` og ${months} ${months === 1 ? 'mánuð' : 'mánuði'}`;
    }
  } else if (months > 0) {
    durationText = months === 1 ? '1 mánuð' : `${months} mánuði`;
  } else {
    durationText = 'nýskráður';
  }

  return durationText;
}

/**
 * Icelandic month names (nominative case)
 */
const ICELANDIC_MONTHS = [
  'janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní',
  'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'
];

/**
 * Icelandic month names - short form (3 letters)
 */
const ICELANDIC_MONTHS_SHORT = [
  'jan', 'feb', 'mar', 'apr', 'maí', 'jún',
  'júl', 'ágú', 'sep', 'okt', 'nóv', 'des'
];

/**
 * Icelandic day names (accusative case - "á sunnudaginn")
 */
const ICELANDIC_DAYS = [
  'sunnudaginn', 'mánudaginn', 'þriðjudaginn', 'miðvikudaginn',
  'fimmtudaginn', 'föstudaginn', 'laugardaginn'
];

/**
 * Format date and time in Icelandic format
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted as "6. nóvember 2025 kl. 13:30"
 *
 * This is the standard Icelandic format for displaying dates with times.
 * - Day number with period (6.)
 * - Icelandic month name in lowercase (nóvember)
 * - Year (2025)
 * - "kl." (abbreviation for klukkustund = hour)
 * - 24-hour time (13:30)
 *
 * Examples:
 * - "2025-11-06T13:30:00" -> "6. nóvember 2025 kl. 13:30"
 * - "2025-01-15T09:05:00" -> "15. janúar 2025 kl. 09:05"
 * - new Date(2025, 11, 31, 23, 59) -> "31. desember 2025 kl. 23:59"
 */
export function formatDateIcelandic(dateInput) {
  if (!dateInput) return '';

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  // Validate date
  if (isNaN(date.getTime())) {
    return '';
  }

  // Get date components
  const day = date.getDate();
  const monthIndex = date.getMonth();
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  // Format: "6. nóvember 2025 kl. 13:30"
  return `${day}. ${ICELANDIC_MONTHS[monthIndex]} ${year} kl. ${hours}:${minutes}`;
}

/**
 * Format date only (without time) in Icelandic format
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted as "6. nóvember 2025"
 *
 * Same as formatDateIcelandic but without the time component.
 * Useful for displaying just the date part.
 *
 * Examples:
 * - "2025-11-06" -> "6. nóvember 2025"
 * - "2025-01-15" -> "15. janúar 2025"
 */
export function formatDateOnlyIcelandic(dateInput) {
  if (!dateInput) return '';

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  // Validate date
  if (isNaN(date.getTime())) {
    return '';
  }

  // Get date components
  const day = date.getDate();
  const monthIndex = date.getMonth();
  const year = date.getFullYear();

  // Format: "6. nóvember 2025"
  return `${day}. ${ICELANDIC_MONTHS[monthIndex]} ${year}`;
}

/**
 * Format date with day name and time in Icelandic format
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted as "sunnudaginn 6. október, kl. 10:00"
 *
 * Includes the Icelandic day name (accusative case) for event displays.
 *
 * Examples:
 * - "2025-10-12T10:00:00" -> "sunnudaginn 12. október, kl. 10:00"
 * - "2025-01-15T14:30:00" -> "miðvikudaginn 15. janúar, kl. 14:30"
 */
export function formatDateWithDayIcelandic(dateInput) {
  if (!dateInput) return '';

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  // Validate date
  if (isNaN(date.getTime())) {
    return '';
  }

  // Get date components
  const dayName = ICELANDIC_DAYS[date.getDay()];
  const day = date.getDate();
  const monthIndex = date.getMonth();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  // Format: "sunnudaginn 12. október, kl. 10:00"
  return `${dayName} ${day}. ${ICELANDIC_MONTHS[monthIndex]}, kl. ${hours}:${minutes}`;
}

/**
 * Format date with short month and time in Icelandic format
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted as "12. des, kl. 14:30"
 *
 * Compact format for lists and history displays.
 *
 * Examples:
 * - "2025-12-12T14:30:00" -> "12. des, kl. 14:30"
 * - "2025-01-15T09:05:00" -> "15. jan, kl. 09:05"
 */
export function formatDateShortIcelandic(dateInput) {
  if (!dateInput) return '';

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  // Validate date
  if (isNaN(date.getTime())) {
    return '';
  }

  // Get date components
  const day = date.getDate();
  const monthIndex = date.getMonth();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  // Format: "12. des, kl. 14:30"
  return `${day}. ${ICELANDIC_MONTHS_SHORT[monthIndex]}, kl. ${hours}:${minutes}`;
}

/**
 * Format time only in Icelandic format (24-hour)
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted as "14:30:45" or "14:30"
 *
 * Examples:
 * - "2025-12-12T14:30:45" -> "14:30:45"
 * - new Date() -> "09:05:23"
 */
export function formatTimeIcelandic(dateInput) {
  if (!dateInput) return '';

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  // Validate date
  if (isNaN(date.getTime())) {
    return '';
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Calculate the next occurrence for recurring weekly events
 *
 * For events that span multiple weeks (e.g., weekly meetings), this function
 * calculates when the next occurrence will be based on the original start day/time.
 *
 * @param {Object} event - Event object with startTime, endTime, and isOngoing flags
 * @param {string|Date} event.startTime - Original start time of the recurring event
 * @param {string|Date|null} event.endTime - End time (when the series ends)
 * @param {boolean} event.isOngoing - Whether the event is currently ongoing
 * @returns {Date|null} Next occurrence date, or null if not a recurring event or past end date
 *
 * Examples:
 * - Weekly Sunday meeting (Oct 12 - Dec 28): returns next Sunday's date
 * - Past event: returns null
 * - Non-recurring event (less than 1 week duration): returns null
 */
export function getNextRecurringOccurrence(event) {
  if (!event?.startTime) return null;

  const startDate = new Date(event.startTime);
  const endDate = event.endTime ? new Date(event.endTime) : null;
  const now = new Date();

  // Validate dates
  if (isNaN(startDate.getTime())) return null;
  if (endDate && isNaN(endDate.getTime())) return null;

  // Check if this is a recurring weekly event (ongoing, spans multiple weeks)
  const isRecurringWeekly = event.isOngoing && endDate &&
    (endDate - startDate) > 7 * 24 * 60 * 60 * 1000; // More than 1 week

  if (!isRecurringWeekly) return null;

  // Calculate next occurrence (same day of week as start)
  const dayOfWeek = startDate.getDay();
  const nextOccurrence = new Date(now);
  const daysUntilNext = (dayOfWeek - now.getDay() + 7) % 7;
  nextOccurrence.setDate(now.getDate() + (daysUntilNext === 0 ? 0 : daysUntilNext));
  nextOccurrence.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0);

  // If today's occurrence has passed, show next week
  if (nextOccurrence <= now) {
    nextOccurrence.setDate(nextOccurrence.getDate() + 7);
  }

  // Make sure next occurrence is before end date
  if (nextOccurrence <= endDate) {
    return nextOccurrence;
  }

  return null; // Past the end date
}

/**
 * Dynamically compute election status based on current time and schedule.
 * This overrides backend's 'published' status if election has ended/not started.
 *
 * @param {string} rawStatus - Raw status from backend (e.g., 'published', 'draft', 'closed')
 * @param {string} scheduledStart - ISO string for scheduled start time
 * @param {string|null} scheduledEnd - ISO string for scheduled end time (or null if not set)
 * @returns {string} Computed status: 'upcoming', 'active', 'closed', 'draft', 'paused', 'archived'
 */
export function computeElectionStatus(rawStatus, scheduledStart, scheduledEnd) {
  const now = new Date();
  const start = new Date(scheduledStart);
  const end = scheduledEnd ? new Date(scheduledEnd) : null;

  // Handle non-dynamic statuses first (draft, paused, archived, closed by backend)
  if (rawStatus === 'draft') return 'draft';
  if (rawStatus === 'paused') return 'paused';
  if (rawStatus === 'closed') return 'closed'; // Explicitly closed by backend
  if (rawStatus === 'archived') return 'closed'; // Archived is functionally closed

  // For 'published' status, dynamically compute based on dates
  if (rawStatus === 'published') {
    if (now < start) {
      return 'upcoming';
    }
    if (end && now > end) {
      return 'closed';
    }
    return 'active'; // Between start and end, or no end date
  }

  // Fallback for any other unexpected status
  return rawStatus;
}

/**
 * Map backend election status to frontend status
 * This is now mostly a passthrough or fallback, as computeElectionStatus is primary.
 * @param {string} backendStatus - Status from backend API
 * @returns {string} Frontend-compatible status
 */
export function mapElectionStatus(backendStatus) {
  // This function is kept for backward compatibility and to map explicit backend statuses
  // For 'published' elections, computeElectionStatus should be used to consider dates.
  const ELECTION_STATUS_MAP = {
    'draft': 'draft',
    'paused': 'paused',
    'closed': 'closed',
    'archived': 'closed',
    // 'published' is handled dynamically by computeElectionStatus
    // Any other status will pass through (e.g., 'active' if backend ever sends it)
  };
  return ELECTION_STATUS_MAP[backendStatus] || backendStatus;
}

/**
 * Normalize election object status from backend to frontend format
 * This function now uses computeElectionStatus for dynamic status evaluation.
 * @param {Object} election - Election object from API
 * @returns {Object} Election with normalized status
 */
export function normalizeElectionStatus(election) {
  if (!election) return election;

  const computedStatus = computeElectionStatus(
    election.status,
    election.scheduled_start,
    election.scheduled_end
  );

  // Normalize answers: API uses answer_text, frontend expects text
  let normalizedAnswers = election.answers;
  if (Array.isArray(election.answers)) {
    normalizedAnswers = election.answers.map((answer, index) => ({
      ...answer,
      // Ensure both text and id are available
      text: answer.text || answer.answer_text || '',
      id: answer.id || answer.answer_id || answer.answer_text || `answer-${index}`
    }));
  }

  return {
    ...election,
    status: computedStatus,
    answers: normalizedAnswers
  };
}

/**
 * Normalize array of elections
 * @param {Array} elections - Array of election objects
 * @returns {Array} Elections with normalized status
 */
export function normalizeElectionsStatus(elections) {
  if (!Array.isArray(elections)) return elections;
  return elections.map(normalizeElectionStatus);
}

// =============================================================================
// Rich Text Formatting Utilities
// =============================================================================

/**
 * Video conference URL patterns
 * Matches common platforms: Zoom, Google Meet, Teams, etc.
 */
const VIDEO_URL_PATTERN = /https?:\/\/(?:[\w-]+\.)?(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com|whereby\.com|webex\.com|gotomeeting\.com|bluejeans\.com)\/[^\s)>\\\]]+/gi;

/**
 * Extract video conference links from text
 * @param {string} text - Text containing URLs
 * @returns {{ links: string[], cleanedText: string }} Extracted links and cleaned text
 *
 * Extracts URLs from:
 * - zoom.us
 * - meet.google.com
 * - teams.microsoft.com
 * - whereby.com
 * - webex.com
 * - gotomeeting.com
 * - bluejeans.com
 *
 * Example:
 * Input: "Join us at https://us06web.zoom.us/j/123 for the meeting"
 * Output: { links: ["https://us06web.zoom.us/j/123"], cleanedText: "Join us at for the meeting" }
 */
export function extractVideoLinks(text) {
  if (!text) return { links: [], cleanedText: '' };

  const links = [];
  let cleanedText = text;

  // Find all video links
  const matches = text.match(VIDEO_URL_PATTERN);
  if (matches) {
    matches.forEach(url => {
      if (!links.includes(url)) {
        links.push(url);
      }
      // Remove the URL from text (and any surrounding whitespace/newlines)
      cleanedText = cleanedText.replace(new RegExp(url.replace(/[.*+?^${}()|[\\]/g, '\\$&') + '\s*', 'g'), '');
    });
  }

  // Clean up extra blank lines
  cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n').trim();

  return { links, cleanedText };
}

/**
 * Format rich text with proper HTML formatting
 * @param {string} text - Plain text to format
 * @returns {string} HTML-formatted text
 *
 * Formatting applied:
 * 1. Markdown bold (**text**) → <strong>text</strong>
 * 2. Markdown horizontal rule (---) → <hr>
 * 3. Emails → clickable mailto links
 * 4. Bank accounts (Banki: XXXX-XX-XXXXXX) → monospace highlighted
 * 5. Kennitala (Kt: XXXXXX-XXXX) → monospace highlighted
 * 6. Dates with time (13. desember kl. 17:30) → bold
 * 7. Time schedules (16:30: ...) → formatted schedule box
 * 8. Numbered lists (1. item) → HTML ordered list
 * 9. Headers ending with colon → bold
 *
 * Example:
 * Input: "**Dagskrá:**\n16:30: Opnun\n17:00: Fundur\nHafið samband: test@test.is"
 * Output: "<strong>Dagskrá:</strong>\n<div class='schedule'>...</div>\nHafið samband: <a href='mailto:test@test.is'>test@test.is</a>"
 */
export function formatRichText(text) {
  if (!text) return '';

  let formatted = text;

  // Markdown: Bold (**text**) → <strong>text</strong>
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Markdown: Horizontal rule (--- on its own line)
  formatted = formatted.replace(/^---$/gm, '<hr style="border: none; border-top: 1px solid var(--color-border, #ddd); margin: 1rem 0;">');

  // Make emails clickable
  formatted = formatted.replace(
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    '<a href="mailto:$1" class="u-text-link">$1</a>'
  );

  // Format bank account numbers (Banki: XXXX-XX-XXXXXX)
  formatted = formatted.replace(
    /(Banki:?\s*)(\d{4}[-–]\d{2}[-–]\d{6})/gi,
    '$1<span style="font-family: monospace; background: var(--color-surface-secondary, #f0f0f0); padding: 0.125rem 0.375rem; border-radius: 0.25rem;">$2</span>'
  );

  // Format kennitala (Kt: XXXXXX-XXXX or Kennitala: XXXXXX-XXXX)
  formatted = formatted.replace(
    /(Kt\.?:?\s*|Kennitala:?\s*)(\d{6}[-–]\d{4})/gi,
    '$1<span style="font-family: monospace; background: var(--color-surface-secondary, #f0f0f0); padding: 0.125rem 0.375rem; border-radius: 0.25rem;">$2</span>'
  );

  // Format inline dates with time (13. desember kl. 17:30)
  formatted = formatted.replace(
    /(\d{1,2})\.\s*(janúar|febrúar|mars|apríl|maí|júní|júlí|ágúst|september|október|nóvember|desember)\s+(kl\.?\s*\d{1,2}[.:]\d{2})/gi,
    '<strong>$1. $2 $3</strong>'
  );

  // Split into lines for processing schedules and lists
  const lines = formatted.split('\n');
  const result = [];
  let inSchedule = false;
  let inNumberedList = false;
  let scheduleItems = [];
  let listItems = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for time schedule pattern (HH:MM: or HH:MM -)
    const timeMatch = line.match(/^(\d{1,2}[:.]\d{2})\s*[-:]?\s*(.+)$/);
    if (timeMatch) {
      if (!inSchedule) {
        // Close any open numbered list
        if (inNumberedList && listItems.length > 0) {
          result.push('<ol style="margin: 0.5rem 0; padding-left: 1.5rem;">' + listItems.join('') + '</ol>');
          listItems = [];
          inNumberedList = false;
        }
        inSchedule = true;
      }
      const time = timeMatch[1].replace('.', ':');
      scheduleItems.push(`<div style="display: flex; gap: 0.75rem; margin-bottom: 0.25rem;"><strong style="min-width: 3rem;">${time}</strong><span>${timeMatch[2]}</span></div>`);
      continue;
    }

    // Check for numbered list pattern (1. or 1 followed by text)
    const numberedMatch = line.match(/^(\d+)[.)\s]+(.+)$/);
    if (numberedMatch && parseInt(numberedMatch[1]) <= 20) {
      if (!inNumberedList) {
        // Close any open schedule
        if (inSchedule && scheduleItems.length > 0) {
          result.push('<div style="background: var(--color-surface-secondary, #f5f5f5); padding: 0.75rem; border-radius: 0.5rem; margin: 0.5rem 0;">' + scheduleItems.join('') + '</div>');
          scheduleItems = [];
          inSchedule = false;
        }
        inNumberedList = true;
      }
      listItems.push(`<li>${numberedMatch[2]}</li>`);
      continue;
    }

    // Regular line - close any open structures
    if (inSchedule && scheduleItems.length > 0) {
      result.push('<div style="background: var(--color-surface-secondary, #f5f5f5); padding: 0.75rem; border-radius: 0.5rem; margin: 0.5rem 0;">' + scheduleItems.join('') + '</div>');
      scheduleItems = [];
      inSchedule = false;
    }
    if (inNumberedList && listItems.length > 0) {
      result.push('<ol style="margin: 0.5rem 0; padding-left: 1.5rem;">' + listItems.join('') + '</ol>');
      listItems = [];
      inNumberedList = false;
    }

    // Check for header-like lines (ending with :)
    if (line.endsWith(':') && line.length < 50 && !line.includes(' ')) {
      result.push(`<strong>${line}</strong>`);
    } else {
      result.push(line);
    }
  }

  // Close any remaining open structures
  if (scheduleItems.length > 0) {
    result.push('<div style="background: var(--color-surface-secondary, #f5f5f5); padding: 0.75rem; border-radius: 0.5rem; margin: 0.5rem 0;">' + scheduleItems.join('') + '</div>');
  }
  if (listItems.length > 0) {
    result.push('<ol style="margin: 0.5rem 0; padding-left: 1.5rem;">' + listItems.join('') + '</ol>');
  }

  return result.join('\n');
}