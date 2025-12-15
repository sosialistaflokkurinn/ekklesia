const express = require('express');
const router = express.Router();
const logger = require('../utils/util-logger');
const authenticate = require('../middleware/middleware-auth');
const { requireAnyRoles } = require('../middleware/middleware-roles');
const {
  getEventsFromDatabase,
  getSyncStatus,
  syncFacebookEvents,
  geocodeEvents,
  getFeaturedEvent,
  setFeaturedEvent,
  unfeatureEvent,
  getEventsForAdmin
} = require('../services/service-facebook-sync');

/**
 * Facebook Events API Integration
 * Page: Sósíalistaflokkur Íslands (ID: 1284030001655471)
 * Token: System User token (permanent, never expires)
 * Docs: tmp/FACEBOOK_API_IMPLEMENTATION_PLAN.md
 *
 * Architecture:
 * - Primary: Cloud SQL database (fast, resilient)
 * - Secondary: In-memory cache (faster, short-lived)
 * - Sync: Background sync from Facebook every 6 hours
 */

// In-memory cache with configurable duration
let eventsCache = {
  data: null,
  timestamp: 0,
  lastSync: null
};
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const STALE_THRESHOLD = 6 * 60 * 60 * 1000; // 6 hours - trigger background sync

/**
 * GET /api/external-events
 * Returns Facebook events with optional filtering
 * Query params:
 *   - upcoming: boolean - filter to only upcoming events
 *   - limit: number - max events to return
 *   - source: string - 'db' to force database, 'fresh' to force Facebook sync
 */
router.get('/', async (req, res) => {
  try {
    const { upcoming, limit, source } = req.query;
    const now = Date.now();
    const upcomingBool = upcoming === 'true';
    const limitNum = limit ? parseInt(limit, 10) : undefined;

    // Force fresh sync if requested
    if (source === 'fresh') {
      logger.info('Forcing fresh sync from Facebook');
      await syncFacebookEvents();
      eventsCache = { data: null, timestamp: 0, lastSync: null }; // Invalidate cache
    }

    // Check in-memory cache first (fastest)
    if (source !== 'db' && eventsCache.data && (now - eventsCache.timestamp < CACHE_DURATION)) {
      logger.info('Serving events from memory cache', { count: eventsCache.data.length });
      let events = eventsCache.data;

      if (upcomingBool) {
        events = events.filter(e => e.isUpcoming);
      }
      if (limitNum) {
        events = events.slice(0, limitNum);
      }

      return res.json(events);
    }

    // Get from database (primary source)
    let events = await getEventsFromDatabase({ upcoming: upcomingBool, limit: limitNum });

    // If database has events, update memory cache and return
    if (events.length > 0) {
      // Update memory cache with full dataset (without filters)
      const allEvents = await getEventsFromDatabase();
      eventsCache = {
        data: allEvents,
        timestamp: now,
        lastSync: new Date().toISOString()
      };

      logger.info('Serving events from database', { count: events.length });

      // Check if data is stale and trigger background sync
      const status = await getSyncStatus();
      if (status.lastSync) {
        const lastSyncTime = new Date(status.lastSync).getTime();
        if (now - lastSyncTime > STALE_THRESHOLD) {
          logger.info('Database data is stale, triggering background sync');
          // Non-blocking sync
          syncFacebookEvents().catch(err => {
            logger.error('Background sync failed', { error: err.message });
          });
        }
      }

      return res.json(events);
    }

    // Database empty - do initial sync from Facebook
    logger.info('Database empty, performing initial sync from Facebook');
    await syncFacebookEvents();

    // Retry from database after sync
    events = await getEventsFromDatabase({ upcoming: upcomingBool, limit: limitNum });

    // Update memory cache
    const allEvents = await getEventsFromDatabase();
    eventsCache = {
      data: allEvents,
      timestamp: now,
      lastSync: new Date().toISOString()
    };

    res.json(events);
  } catch (error) {
    logger.error('Error fetching events', {
      error: error.message,
      stack: error.stack
    });

    // Serve from memory cache as last resort
    if (eventsCache.data) {
      logger.warn('Serving expired cache due to error');
      let events = eventsCache.data;
      const { upcoming, limit } = req.query;

      if (upcoming === 'true') {
        events = events.filter(e => e.isUpcoming);
      }
      if (limit) {
        events = events.slice(0, parseInt(limit, 10));
      }

      return res.json(events);
    }

    res.status(502).json({ error: 'Failed to fetch events' });
  }
});

/**
 * GET /api/external-events/status
 * Returns sync status and metadata
 */
router.get('/status', async (req, res) => {
  try {
    const now = Date.now();
    const dbStatus = await getSyncStatus();

    const cacheAge = eventsCache.timestamp ? Math.round((now - eventsCache.timestamp) / 1000) : null;
    const cacheValid = eventsCache.data && (now - eventsCache.timestamp < CACHE_DURATION);

    const lastSyncTime = dbStatus.lastSync ? new Date(dbStatus.lastSync).getTime() : 0;
    const dataStale = lastSyncTime ? (now - lastSyncTime > STALE_THRESHOLD) : true;

    res.json({
      // Database status
      database: {
        eventsCount: dbStatus.eventsCount,
        upcomingCount: dbStatus.upcomingCount,
        ongoingCount: dbStatus.ongoingCount,
        lastSync: dbStatus.lastSync,
        stale: dataStale
      },
      // Memory cache status
      memoryCache: {
        cached: !!eventsCache.data,
        valid: cacheValid,
        ageSeconds: cacheAge,
        maxAgeSeconds: CACHE_DURATION / 1000
      },
      // Config
      staleThresholdHours: STALE_THRESHOLD / (60 * 60 * 1000)
    });
  } catch (error) {
    logger.error('Error getting status', { error: error.message });
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * POST /api/external-events/sync
 * Manually trigger Facebook sync (admin only in production)
 */
router.post('/sync', async (req, res) => {
  try {
    logger.info('Manual sync triggered');
    const result = await syncFacebookEvents();

    // Invalidate memory cache
    eventsCache = { data: null, timestamp: 0, lastSync: null };

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Manual sync failed', { error: error.message });
    res.status(500).json({ error: 'Sync failed', message: error.message });
  }
});

/**
 * POST /api/external-events/geocode
 * Geocode event locations using Staðfangaskrá
 * Enriches location data with GPS coordinates and map URLs
 */
router.post('/geocode', async (req, res) => {
  try {
    logger.info('Geocoding triggered');
    const result = await geocodeEvents();

    // Invalidate memory cache
    eventsCache = { data: null, timestamp: 0, lastSync: null };

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Geocoding failed', { error: error.message });
    res.status(500).json({ error: 'Geocoding failed', message: error.message });
  }
});

/**
 * GET /api/external-events/featured
 * Get the admin-selected featured event
 * Public endpoint - no authentication required
 */
router.get('/featured', async (req, res) => {
  try {
    const event = await getFeaturedEvent();

    if (!event) {
      return res.json({ featured: null });
    }

    res.json({ featured: event });
  } catch (error) {
    logger.error('Failed to get featured event', { error: error.message });
    res.status(500).json({ error: 'Failed to get featured event' });
  }
});

// ============================================================================
// Admin Endpoints (require authentication)
// ============================================================================

/**
 * GET /api/external-events/admin
 * Get all events for admin management
 * Includes featured status and database IDs
 */
router.get('/admin', authenticate, requireAnyRoles(['superuser', 'admin']), async (req, res) => {
  try {
    const events = await getEventsForAdmin();
    const status = await getSyncStatus();

    res.json({
      events,
      status: {
        total: status.eventsCount,
        upcoming: status.upcomingCount,
        lastSync: status.lastSync
      }
    });
  } catch (error) {
    logger.error('Failed to get admin events', { error: error.message });
    res.status(500).json({ error: 'Failed to get events' });
  }
});

/**
 * POST /api/external-events/:id/feature
 * Mark event as featured (only one at a time)
 */
router.post('/:id/feature', authenticate, requireAnyRoles(['superuser', 'admin']), async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);

    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    const result = await setFeaturedEvent(eventId);

    // Invalidate memory cache
    eventsCache = { data: null, timestamp: 0, lastSync: null };

    res.json({
      success: true,
      event: result
    });
  } catch (error) {
    logger.error('Failed to feature event', {
      event_id: req.params.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to feature event', message: error.message });
  }
});

/**
 * DELETE /api/external-events/:id/feature
 * Remove featured status from event
 */
router.delete('/:id/feature', authenticate, requireAnyRoles(['superuser', 'admin']), async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);

    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    const result = await unfeatureEvent(eventId);

    // Invalidate memory cache
    eventsCache = { data: null, timestamp: 0, lastSync: null };

    res.json({
      success: true,
      event: result
    });
  } catch (error) {
    logger.error('Failed to unfeature event', {
      event_id: req.params.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to unfeature event', message: error.message });
  }
});

module.exports = router;
