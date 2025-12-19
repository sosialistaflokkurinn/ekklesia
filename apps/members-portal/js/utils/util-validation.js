/**
 * Input Validation Utilities
 *
 * Client-side validation for API calls to prevent
 * malformed data and provide better user feedback.
 *
 * @module utils/validation
 */

/**
 * Validation error with field-level details
 */
export class ValidationError extends Error {
  constructor(message, field = null, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.errors = errors;
  }
}

/**
 * Validate Icelandic kennitala (10 digits)
 * @param {string} kennitala - The kennitala to validate
 * @returns {boolean} True if valid format
 */
export function isValidKennitala(kennitala) {
  if (!kennitala || typeof kennitala !== 'string') return false;
  // Must be exactly 10 digits
  return /^\d{10}$/.test(kennitala.trim());
}

/**
 * Validate email address
 * @param {string} email - The email to validate
 * @returns {boolean} True if valid format
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  // Basic email pattern - not overly strict
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validate Icelandic phone number
 * Accepts: 1234567, 123-4567, 123 4567, +354 123 4567, +3541234567
 * @param {string} phone - The phone to validate
 * @returns {boolean} True if valid format
 */
export function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  // Remove spaces and dashes for validation
  const cleaned = phone.replace(/[\s-]/g, '');
  // 7 digits, or +354 followed by 7 digits
  return /^(\+354)?\d{7}$/.test(cleaned);
}

/**
 * Validate Icelandic postal code (3 digits, 100-999)
 * @param {string|number} postalCode - The postal code to validate
 * @returns {boolean} True if valid format
 */
export function isValidPostalCode(postalCode) {
  if (postalCode === null || postalCode === undefined) return false;
  const code = String(postalCode).trim();
  // Must be 3 digits, 100-999
  return /^[1-9]\d{2}$/.test(code);
}

/**
 * Validate name (Icelandic characters allowed)
 * @param {string} name - The name to validate
 * @param {number} maxLength - Maximum allowed length (default: 100)
 * @returns {boolean} True if valid
 */
export function isValidName(name, maxLength = 100) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return false;
  // Allow letters (including Icelandic), spaces, hyphens, apostrophes
  return /^[a-zA-ZáéíóúýþæðöÁÉÍÓÚÝÞÆÐÖ\s\-']+$/.test(trimmed);
}

/**
 * Validate street address
 * @param {string} address - The address to validate
 * @param {number} maxLength - Maximum allowed length (default: 200)
 * @returns {boolean} True if valid
 */
export function isValidAddress(address, maxLength = 200) {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return false;
  // Allow letters, numbers, spaces, common punctuation
  return /^[a-zA-ZáéíóúýþæðöÁÉÍÓÚÝÞÆÐÖ0-9\s\-.,/]+$/.test(trimmed);
}

/**
 * Sanitize string input (remove potential XSS)
 * @param {string} input - The input to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeString(input) {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

/**
 * Validate member profile update data
 * @param {Object} data - Profile update data
 * @throws {ValidationError} If validation fails
 * @returns {Object} Validated and sanitized data
 */
export function validateMemberProfileUpdate(data) {
  const errors = [];
  const validated = {};

  if (data.name !== undefined) {
    if (!isValidName(data.name)) {
      errors.push({ field: 'name', message: 'Ógilt nafn' });
    } else {
      validated.name = sanitizeString(data.name);
    }
  }

  if (data.email !== undefined) {
    if (!isValidEmail(data.email)) {
      errors.push({ field: 'email', message: 'Ógilt netfang' });
    } else {
      validated.email = data.email.trim().toLowerCase();
    }
  }

  if (data.phone !== undefined) {
    if (!isValidPhone(data.phone)) {
      errors.push({ field: 'phone', message: 'Ógilt símanúmer' });
    } else {
      // Normalize phone format
      validated.phone = data.phone.replace(/[\s-]/g, '').replace(/^\+354/, '');
    }
  }

  if (data.address !== undefined) {
    if (!isValidAddress(data.address)) {
      errors.push({ field: 'address', message: 'Ógilt heimilisfang' });
    } else {
      validated.address = sanitizeString(data.address);
    }
  }

  if (data.postal_code !== undefined) {
    if (!isValidPostalCode(data.postal_code)) {
      errors.push({ field: 'postal_code', message: 'Ógilt póstnúmer' });
    } else {
      validated.postal_code = String(data.postal_code).trim();
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(
      `Validation failed: ${errors.map(e => e.message).join(', ')}`,
      errors[0].field,
      errors
    );
  }

  return validated;
}

/**
 * Validate election ID format
 * @param {string} electionId - The election ID to validate
 * @returns {boolean} True if valid format
 */
export function isValidElectionId(electionId) {
  if (!electionId || typeof electionId !== 'string') return false;
  // UUID or numeric ID
  return /^[a-zA-Z0-9-]+$/.test(electionId) && electionId.length <= 100;
}

/**
 * Validate candidate field update
 * @param {string} field - Field name
 * @param {string} value - Field value
 * @throws {ValidationError} If validation fails
 */
export function validateCandidateField(field, value) {
  const allowedFields = ['name', 'bio', 'position', 'image_url'];

  if (!allowedFields.includes(field)) {
    throw new ValidationError(`Invalid field: ${field}`, field);
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`Value must be a string`, field);
  }

  const maxLengths = {
    name: 100,
    bio: 2000,
    position: 200,
    image_url: 500
  };

  if (value.length > maxLengths[field]) {
    throw new ValidationError(
      `${field} exceeds maximum length of ${maxLengths[field]}`,
      field
    );
  }

  // Basic XSS check
  if (/<script/i.test(value) || /javascript:/i.test(value)) {
    throw new ValidationError('Invalid content detected', field);
  }
}
