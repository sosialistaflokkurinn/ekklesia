/**
 * Image Cache Utility
 *
 * Downloads images from external sources (e.g., Facebook CDN) and
 * stores them in Cloud Storage to prevent 403 errors from expired URLs.
 */

const admin = require('firebase-admin');
const axios = require('axios');
const logger = require('./util-logger');

// Cloud Storage bucket name (Firebase Storage)
const BUCKET_NAME = process.env.STORAGE_BUCKET || 'ekklesia-prod-10-2025.firebasestorage.app';
const IMAGE_FOLDER = 'event-images';

// Timeout for image download
const DOWNLOAD_TIMEOUT = 30000; // 30 seconds

/**
 * Get storage bucket instance
 * @returns {Object} Cloud Storage bucket
 */
function getBucket() {
  return admin.storage().bucket(BUCKET_NAME);
}

/**
 * Download image from URL and upload to Cloud Storage
 * @param {string} sourceUrl - URL to download image from
 * @param {string} eventId - Event ID to use in filename
 * @returns {Promise<string|null>} Cloud Storage public URL or null on failure
 */
async function cacheEventImage(sourceUrl, eventId) {
  if (!sourceUrl || !eventId) {
    return null;
  }

  try {
    // Generate filename based on event ID
    const filename = `${IMAGE_FOLDER}/${eventId}.jpg`;
    const bucket = getBucket();
    const file = bucket.file(filename);

    // Check if image already exists in cache
    const [exists] = await file.exists();
    if (exists) {
      logger.debug('Image already cached', { eventId, filename });
      return getPublicUrl(filename);
    }

    // Download image from source URL
    logger.info('Downloading image for caching', { eventId, sourceUrl: sourceUrl.substring(0, 100) });

    const response = await axios.get(sourceUrl, {
      responseType: 'arraybuffer',
      timeout: DOWNLOAD_TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Ekklesia/1.0)'
      }
    });

    // Determine content type from response
    const contentType = response.headers['content-type'] || 'image/jpeg';

    // Upload to Cloud Storage
    // Note: Bucket has uniform bucket-level access with allUsers:objectViewer for public read
    await file.save(Buffer.from(response.data), {
      metadata: {
        contentType: contentType,
        metadata: {
          sourceUrl: sourceUrl.substring(0, 500), // Store original URL for reference
          cachedAt: new Date().toISOString(),
          eventId: eventId
        }
      }
    });

    const publicUrl = getPublicUrl(filename);
    logger.info('Image cached successfully', { eventId, publicUrl });

    return publicUrl;

  } catch (error) {
    logger.warn('Failed to cache image', {
      eventId,
      sourceUrl: sourceUrl?.substring(0, 100),
      error: error.message
    });
    // Return null - the sync will continue without cached image
    return null;
  }
}

/**
 * Get public URL for a cached file
 * @param {string} filename - Filename in bucket
 * @returns {string} Public URL
 */
function getPublicUrl(filename) {
  return `https://storage.googleapis.com/${BUCKET_NAME}/${filename}`;
}

/**
 * Delete cached image for an event
 * @param {string} eventId - Event ID
 * @returns {Promise<boolean>} True if deleted, false otherwise
 */
async function deleteCachedImage(eventId) {
  try {
    const filename = `${IMAGE_FOLDER}/${eventId}.jpg`;
    const bucket = getBucket();
    const file = bucket.file(filename);

    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      logger.info('Cached image deleted', { eventId });
      return true;
    }
    return false;
  } catch (error) {
    logger.warn('Failed to delete cached image', { eventId, error: error.message });
    return false;
  }
}

module.exports = {
  cacheEventImage,
  deleteCachedImage,
  getPublicUrl
};
