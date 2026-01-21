/**
 * Facebook Events Sync Service
 *
 * Syncs events from multiple Facebook pages to local database.
 * Pages:
 * - 1284030001655471 (Sósíalistaflokkur Íslands)
 * - 816733241527878 (Sósíalistafélag Reykjavíkur)
 *
 * Architecture:
 * - Database is primary storage (resilient, queryable)
 * - Memory cache in route layer (fast, short-lived)
 * - Background sync every 6 hours
 */

const axios = require('axios');
const logger = require('../utils/util-logger');
const { query } = require('../config/config-database');
const { improveEventDescription, isKimiConfigured } = require('../utils/util-kimi');
const { cacheEventImage } = require('../utils/util-image-cache');

// Security: Timeouts for external API calls
const FACEBOOK_API_TIMEOUT = 30000; // 30 seconds
const GEOCODE_API_TIMEOUT = 10000;  // 10 seconds

// Security: Input validation limits
const MAX_TITLE_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 10000;

// Facebook API Configuration
const FB_API_VERSION = 'v19.0';
const FB_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

// Support multiple page IDs (comma-separated)
const FB_PAGE_IDS = process.env.FB_PAGE_ID
  ? process.env.FB_PAGE_ID.split(',').map(id => id.trim())
  : [];

// Check credentials on startup
if (FB_PAGE_IDS.length === 0 || !FB_ACCESS_TOKEN) {
  logger.warn('Facebook credentials not configured', {
    pageCount: FB_PAGE_IDS.length,
    hasToken: !!FB_ACCESS_TOKEN
  });
}

/**
 * Get events from database
 * @param {Object} options - Query options
 * @param {boolean} options.upcoming - Filter to upcoming events only
 * @param {number} options.limit - Max events to return
 * @returns {Promise<Array>} Events array
 */
async function getEventsFromDatabase(options = {}) {
  const { upcoming, limit } = options;
  const now = new Date().toISOString();

  let sql = `
    SELECT
      id, facebook_id, title, description,
      start_time, end_time,
      location_name, location_street, location_city, location_country,
      is_online, latitude, longitude,
      facebook_url, image_url, is_featured,
      synced_at, created_at, updated_at
    FROM external_events
  `;

  const params = [];
  if (upcoming) {
    sql += ` WHERE start_time > $1 OR (end_time IS NOT NULL AND end_time > $1)`;
    params.push(now);
  }

  sql += ` ORDER BY start_time ASC`;

  if (limit) {
    sql += ` LIMIT $${params.length + 1}`;
    params.push(limit);
  }

  const result = await query(sql, params);

  return result.rows.map(formatEventForApi);
}

/**
 * Calculate next occurrence for recurring weekly events.
 * Returns ISO string for the next occurrence, or null if not applicable.
 *
 * @param {Date} startTime - Event start time
 * @param {Date|null} endTime - Event end time
 * @param {boolean} isOngoing - Whether event is currently ongoing
 * @returns {string|null} ISO string of next occurrence, or null
 */
function calculateNextOccurrence(startTime, endTime, isOngoing) {
  const now = new Date();

  // Only for ongoing events that span multiple weeks (recurring weekly pattern)
  const isRecurringWeekly = isOngoing && endTime &&
    (endTime - startTime) > 7 * 24 * 60 * 60 * 1000; // More than 1 week

  if (!isRecurringWeekly) return null;

  // Calculate next occurrence (same day of week as start)
  const dayOfWeek = startTime.getDay();
  const nextOccurrence = new Date(now);
  const daysUntilNext = (dayOfWeek - now.getDay() + 7) % 7;
  nextOccurrence.setDate(now.getDate() + daysUntilNext);
  nextOccurrence.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);

  // If today's occurrence has passed, show next week
  if (nextOccurrence <= now) {
    nextOccurrence.setDate(nextOccurrence.getDate() + 7);
  }

  // Make sure next occurrence is before end date
  if (nextOccurrence <= endTime) {
    return nextOccurrence.toISOString();
  }

  return null; // Past the end date
}

/**
 * Format database row for API response
 */
function formatEventForApi(row) {
  const now = new Date();
  const startTime = new Date(row.start_time);
  const endTime = row.end_time ? new Date(row.end_time) : null;

  // Build location object
  const location = {
    name: row.location_name,
    display: buildLocationDisplay(row)
  };

  // Add map URLs - use coordinates if available, otherwise use search-based URLs
  if (row.latitude && row.longitude) {
    // Precise location from coordinates
    location.mapUrls = {
      googleMaps: `https://www.google.com/maps?q=${row.latitude},${row.longitude}`,
      openStreetMap: `https://www.openstreetmap.org/?mlat=${row.latitude}&mlon=${row.longitude}#map=17/${row.latitude}/${row.longitude}`
    };
  } else if (row.location_name || row.location_street || row.location_city) {
    // Search-based URLs from address
    const searchQuery = encodeURIComponent(buildLocationDisplay(row));
    location.mapUrls = {
      googleMaps: `https://www.google.com/maps/search/?api=1&query=${searchQuery}`,
      openStreetMap: `https://www.openstreetmap.org/search?query=${searchQuery}`
    };
  }

  // Determine event status
  // - upcoming: hasn't started yet (start_time > now)
  // - ongoing: started but not ended (start_time <= now < end_time)
  // - past: already ended (end_time < now)
  let isUpcoming = false;
  let isOngoing = false;

  if (endTime) {
    if (startTime > now) {
      isUpcoming = true;
    } else if (endTime > now) {
      isOngoing = true;
    }
    // else: past (both false)
  } else {
    // No end time - use 12 hour window from start
    const twelveHoursAfterStart = new Date(startTime.getTime() + 12 * 60 * 60 * 1000);
    if (startTime > now) {
      isUpcoming = true;
    } else if (twelveHoursAfterStart > now) {
      isOngoing = true;
    }
  }

  // Calculate next occurrence for recurring events
  const nextOccurrence = calculateNextOccurrence(startTime, endTime, isOngoing);

  return {
    id: row.id,
    facebookId: row.facebook_id,
    title: row.title,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    location: location,
    isOnline: row.is_online,
    facebookUrl: row.facebook_url,
    imageUrl: row.image_url,
    isFeatured: row.is_featured,
    isUpcoming: isUpcoming,
    isOngoing: isOngoing,
    nextOccurrence: nextOccurrence,
    syncedAt: row.synced_at
  };
}

/**
 * Build display string for location
 */
function buildLocationDisplay(row) {
  const parts = [];

  if (row.location_name) parts.push(row.location_name);
  if (row.location_street) parts.push(row.location_street);
  if (row.location_city) parts.push(row.location_city);
  if (row.location_country) parts.push(row.location_country);

  if (parts.length === 0 && row.is_online) {
    return 'Netviðburður';
  }

  let display = parts.join(', ') || 'Staðsetning óþekkt';

  // Replace English country name with Icelandic
  display = display.replace(/,?\s*Iceland$/i, ', Ísland');
  display = display.replace(/^Iceland,?\s*/i, 'Ísland, ');

  return display;
}

/**
 * Get sync status from database
 */
async function getSyncStatus() {
  // Get event counts with proper status breakdown
  // - upcoming: start_time > now
  // - ongoing: started but not ended (with 12-hour window for events without end_time)
  const countResult = await query(`
    SELECT
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE start_time > NOW()) as upcoming_count,
      COUNT(*) FILTER (WHERE
        start_time <= NOW() AND (
          (end_time IS NOT NULL AND end_time > NOW()) OR
          (end_time IS NULL AND start_time > NOW() - INTERVAL '12 hours')
        )
      ) as ongoing_count
    FROM external_events
  `);

  // Get last successful sync
  const syncResult = await query(`
    SELECT started_at, completed_at, events_count
    FROM external_events_sync_log
    WHERE sync_type = 'facebook_sync' AND status = 'success'
    ORDER BY started_at DESC
    LIMIT 1
  `);

  return {
    eventsCount: parseInt(countResult.rows[0].total_count),
    upcomingCount: parseInt(countResult.rows[0].upcoming_count),
    ongoingCount: parseInt(countResult.rows[0].ongoing_count),
    lastSync: syncResult.rows[0]?.completed_at || null
  };
}

/**
 * Sync events from Facebook API to database
 * Syncs from all configured page IDs
 */
async function syncFacebookEvents() {
  if (FB_PAGE_IDS.length === 0 || !FB_ACCESS_TOKEN) {
    throw new Error('Missing Facebook credentials. Set FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN.');
  }

  const startedAt = new Date();

  // Log sync start
  const logResult = await query(`
    INSERT INTO external_events_sync_log (sync_type, status, started_at)
    VALUES ('facebook_sync', 'in_progress', $1)
    RETURNING id
  `, [startedAt]);
  const logId = logResult.rows[0].id;

  try {
    let totalSynced = 0;

    // Sync from each page
    for (const pageId of FB_PAGE_IDS) {
      logger.info('Syncing events from page', { pageId });

      // Fetch upcoming events from this page
      const url = `https://graph.facebook.com/${FB_API_VERSION}/${pageId}/events`;
      const response = await axios.get(url, {
        params: {
          access_token: FB_ACCESS_TOKEN,
          fields: 'id,name,description,start_time,end_time,place,cover,is_online',
          time_filter: 'upcoming',
          limit: 50
        },
        timeout: FACEBOOK_API_TIMEOUT
      });

      const events = response.data.data || [];
      logger.info('Fetched upcoming events from page', { pageId, count: events.length });

      // Also fetch recent past events from this page
      const pastResponse = await axios.get(url, {
        params: {
          access_token: FB_ACCESS_TOKEN,
          fields: 'id,name,description,start_time,end_time,place,cover,is_online',
          time_filter: 'past',
          limit: 20
        },
        timeout: FACEBOOK_API_TIMEOUT
      });

      const pastEvents = pastResponse.data.data || [];
      const allEvents = [...events, ...pastEvents];

      // Upsert events to database
      for (const event of allEvents) {
        await upsertFacebookEvent(event);
        totalSynced++;
      }
    }

    // Update sync log
    await query(`
      UPDATE external_events_sync_log
      SET status = 'success', events_count = $1, completed_at = NOW()
      WHERE id = $2
    `, [totalSynced, logId]);

    logger.info('Facebook sync completed', { synced: totalSynced, pages: FB_PAGE_IDS.length });

    return { synced: totalSynced, source: 'facebook', pages: FB_PAGE_IDS.length };

  } catch (error) {
    // Log failure
    await query(`
      UPDATE external_events_sync_log
      SET status = 'error', error_message = $1, completed_at = NOW()
      WHERE id = $2
    `, [error.message, logId]);

    logger.error('Facebook sync failed', {
      error: error.message,
      response: error.response?.data
    });

    throw error;
  }
}

/**
 * Validate and sanitize Facebook event data
 * Security: Prevent malformed data from corrupting database
 */
function validateEventData(event) {
  const safeString = (val, maxLen) => {
    if (val === null || val === undefined) return null;
    return String(val).substring(0, maxLen);
  };

  return {
    id: safeString(event.id, 50),
    name: safeString(event.name, MAX_TITLE_LENGTH),
    description: safeString(event.description, MAX_DESCRIPTION_LENGTH),
    start_time: event.start_time || null,
    end_time: event.end_time || null,
    is_online: Boolean(event.is_online),
    cover: event.cover?.source ? safeString(event.cover.source, 1000) : null,
    place: event.place || {}
  };
}

/**
 * Upsert a single Facebook event to database
 * Uses Kimi AI to improve description text if configured
 * Caches event images in Cloud Storage to prevent Facebook CDN expiration
 */
async function upsertFacebookEvent(event) {
  // Security: Validate and sanitize input
  const validated = validateEventData(event);

  const place = validated.place || {};
  const location = place.location || {};

  // Use Kimi to improve description if available
  let description = validated.description;
  if (isKimiConfigured() && description) {
    description = await improveEventDescription(description, validated.name);
  }

  // Cache image in Cloud Storage (Facebook CDN URLs expire)
  let imageUrl = null;
  if (validated.cover) {
    imageUrl = await cacheEventImage(validated.cover, validated.id);
    // Fallback to original URL if caching fails
    if (!imageUrl) {
      imageUrl = validated.cover;
    }
  }

  await query(`
    INSERT INTO external_events (
      facebook_id, title, description,
      start_time, end_time,
      location_name, location_street, location_city, location_country,
      is_online, facebook_url, image_url, synced_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
    ON CONFLICT (facebook_id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      start_time = EXCLUDED.start_time,
      end_time = EXCLUDED.end_time,
      location_name = EXCLUDED.location_name,
      location_street = EXCLUDED.location_street,
      location_city = EXCLUDED.location_city,
      location_country = EXCLUDED.location_country,
      is_online = EXCLUDED.is_online,
      image_url = EXCLUDED.image_url,
      synced_at = NOW()
  `, [
    validated.id,
    validated.name,
    description,  // Use Kimi-improved description
    validated.start_time,
    validated.end_time,
    place.name ? String(place.name).substring(0, 200) : null,
    location.street ? String(location.street).substring(0, 200) : null,
    location.city ? String(location.city).substring(0, 100) : null,
    location.country ? String(location.country).substring(0, 100) : null,
    validated.is_online,
    `https://www.facebook.com/events/${validated.id}`,
    imageUrl
  ]);
}

/**
 * Geocode events using Staðfangaskrá (Icelandic address registry)
 */
async function geocodeEvents() {
  // Get events without coordinates that have location info
  const result = await query(`
    SELECT id, location_name, location_street, location_city
    FROM external_events
    WHERE latitude IS NULL
      AND (location_name IS NOT NULL OR location_street IS NOT NULL)
  `);

  let geocoded = 0;
  let failed = 0;

  for (const event of result.rows) {
    try {
      const searchQuery = event.location_street || event.location_name;
      if (!searchQuery) continue;

      // Use Staðfangaskrá API
      const response = await axios.get('https://skra.is/api/stadfangaskra/', {
        params: {
          heiti: searchQuery,
          limit: 1
        },
        timeout: GEOCODE_API_TIMEOUT
      });

      if (response.data?.results?.length > 0) {
        const loc = response.data.results[0];

        await query(`
          UPDATE external_events
          SET latitude = $1, longitude = $2
          WHERE id = $3
        `, [loc.hnit_n, loc.hnit_e, event.id]);

        geocoded++;
      }
    } catch (error) {
      logger.warn('Failed to geocode event', {
        eventId: event.id,
        error: error.message
      });
      failed++;
    }
  }

  // Log geocoding result
  await query(`
    INSERT INTO external_events_sync_log (sync_type, status, events_count, started_at, completed_at)
    VALUES ('geocode', $1, $2, NOW(), NOW())
  `, [failed > 0 ? 'partial' : 'success', geocoded]);

  logger.info('Geocoding completed', { geocoded, failed });

  return { geocoded, failed };
}

/**
 * Get the current featured event
 */
async function getFeaturedEvent() {
  const result = await query(`
    SELECT * FROM external_events
    WHERE is_featured = TRUE
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    return null;
  }

  return formatEventForApi(result.rows[0]);
}

/**
 * Set an event as featured (only one at a time)
 */
async function setFeaturedEvent(eventId) {
  // Clear any existing featured event
  await query(`UPDATE external_events SET is_featured = FALSE WHERE is_featured = TRUE`);

  // Set new featured event
  const result = await query(`
    UPDATE external_events
    SET is_featured = TRUE
    WHERE id = $1
    RETURNING *
  `, [eventId]);

  if (result.rows.length === 0) {
    throw new Error(`Event not found: ${eventId}`);
  }

  logger.info('Featured event set', { eventId });

  return formatEventForApi(result.rows[0]);
}

/**
 * Remove featured status from an event
 */
async function unfeatureEvent(eventId) {
  const result = await query(`
    UPDATE external_events
    SET is_featured = FALSE
    WHERE id = $1
    RETURNING *
  `, [eventId]);

  if (result.rows.length === 0) {
    throw new Error(`Event not found: ${eventId}`);
  }

  logger.info('Featured status removed', { eventId });

  return formatEventForApi(result.rows[0]);
}

/**
 * Get all events for admin management
 */
async function getEventsForAdmin() {
  const result = await query(`
    SELECT *
    FROM external_events
    ORDER BY start_time DESC
  `);

  return result.rows.map(row => ({
    ...formatEventForApi(row),
    // Include additional admin fields
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

module.exports = {
  getEventsFromDatabase,
  getSyncStatus,
  syncFacebookEvents,
  geocodeEvents,
  getFeaturedEvent,
  setFeaturedEvent,
  unfeatureEvent,
  getEventsForAdmin
};
