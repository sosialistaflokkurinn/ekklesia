const crypto = require('crypto');

/**
 * Hash UID for logging (one-way, deterministic)
 *
 * Converts Firebase UID to irreversible hash for privacy-preserving logging.
 * Same UID always produces same hash (allows correlation), but cannot be reversed.
 *
 * @param {string} uid - Firebase UID to hash
 * @returns {string} - First 16 characters of SHA256 hash (sufficient for uniqueness)
 *
 * @example
 * const hash = hashUidForLogging('NE5e8GpzzBcjxuTHWGuJtTfevPD2');
 * // Returns: "a3f2b9c1e5d8f7a2" (16 hex chars)
 */
function hashUidForLogging(uid) {
  if (!uid) {
    return 'unknown';
  }

  // Use environment variable salt (or default for development)
  const salt = process.env.LOG_SALT || 'default-salt-please-change-in-production';

  // SHA256 hash with salt
  const hash = crypto.createHash('sha256')
    .update(uid + salt)
    .digest('hex');

  // Return first 16 characters (sufficient for uniqueness, saves log space)
  return hash.substring(0, 16);
}

module.exports = {
  hashUidForLogging,
};
