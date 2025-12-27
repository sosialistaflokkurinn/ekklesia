/**
 * Analytics Tracking Route
 *
 * Tracks user activity for understanding how members use the portal.
 * Excludes admin/superuser accounts from tracking.
 *
 * @module routes/route-analytics
 */

const express = require('express');
const logger = require('../utils/util-logger');
const authenticate = require('../middleware/middleware-auth');
const { pool } = require('../config/config-database');

const router = express.Router();

// Users excluded from tracking (developers, superusers)
const EXCLUDED_UIDS = [
  'NE5e8GpzzBcjxuTHWGuJtTfevPD2', // Guðröður
];

const EXCLUDED_EMAILS = [
  'gudrodur@sosialistaflokkurinn.is',
  'gudrodur@gmail.com',
];

/**
 * Detect device type from user agent
 */
function getDeviceType(userAgent) {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) {
    return 'mobile';
  }
  if (/ipad|tablet|playbook|silk/i.test(ua)) {
    return 'tablet';
  }
  return 'desktop';
}

/**
 * POST /api/analytics/track
 * Track a user event
 */
router.post('/track', authenticate, async (req, res) => {
  try {
    const { uid, email } = req.user;

    // Check if user should be excluded
    if (EXCLUDED_UIDS.includes(uid) || EXCLUDED_EMAILS.includes(email)) {
      return res.json({ tracked: false, reason: 'excluded' });
    }

    const {
      eventType,
      eventName,
      eventData,
      pagePath,
      referrer,
      sessionId,
    } = req.body;

    // Validate required fields
    if (!eventType || !eventName) {
      return res.status(400).json({ error: 'eventType and eventName required' });
    }

    const userAgent = req.headers['user-agent'];
    const deviceType = getDeviceType(userAgent);

    // Get user name from database
    let userName = null;
    try {
      const userResult = await pool.query(
        'SELECT name FROM membership_comrade WHERE firebase_uid = $1',
        [uid]
      );
      if (userResult.rows.length > 0) {
        userName = userResult.rows[0].name;
      }
    } catch (e) {
      // Ignore - name is optional
    }

    // Insert event
    await pool.query(
      `INSERT INTO user_analytics
       (user_id, user_name, event_type, event_name, event_data, page_path, referrer, user_agent, device_type, session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        uid,
        userName,
        eventType,
        eventName,
        eventData ? JSON.stringify(eventData) : null,
        pagePath,
        referrer,
        userAgent,
        deviceType,
        sessionId,
      ]
    );

    res.json({ tracked: true });
  } catch (error) {
    logger.error('Analytics tracking error:', error);
    res.status(500).json({ error: 'Tracking failed' });
  }
});

/**
 * GET /api/analytics/summary
 * Get analytics summary (admin only)
 */
router.get('/summary', authenticate, async (req, res) => {
  try {
    const { uid } = req.user;

    // Only allow excluded users (admins) to view analytics
    if (!EXCLUDED_UIDS.includes(uid)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const days = parseInt(req.query.days) || 7;

    // Get summary stats
    const [
      totalEvents,
      uniqueUsers,
      pageViews,
      topPages,
      recentUsers,
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as count FROM user_analytics
         WHERE created_at >= NOW() - INTERVAL '${days} days'`
      ),
      pool.query(
        `SELECT COUNT(DISTINCT user_id) as count FROM user_analytics
         WHERE created_at >= NOW() - INTERVAL '${days} days'`
      ),
      pool.query(
        `SELECT COUNT(*) as count FROM user_analytics
         WHERE event_type = 'page_view' AND created_at >= NOW() - INTERVAL '${days} days'`
      ),
      pool.query(
        `SELECT event_name, COUNT(*) as views
         FROM user_analytics
         WHERE event_type = 'page_view' AND created_at >= NOW() - INTERVAL '${days} days'
         GROUP BY event_name ORDER BY views DESC LIMIT 10`
      ),
      pool.query(
        `SELECT DISTINCT ON (user_id) user_id, user_name, event_name, page_path, device_type, created_at
         FROM user_analytics
         WHERE created_at >= NOW() - INTERVAL '${days} days'
         ORDER BY user_id, created_at DESC`
      ),
    ]);

    res.json({
      period: `${days} days`,
      totalEvents: parseInt(totalEvents.rows[0].count),
      uniqueUsers: parseInt(uniqueUsers.rows[0].count),
      pageViews: parseInt(pageViews.rows[0].count),
      topPages: topPages.rows,
      recentUsers: recentUsers.rows,
    });
  } catch (error) {
    logger.error('Analytics summary error:', error);
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

/**
 * GET /api/analytics/user/:userId
 * Get activity for a specific user (admin only)
 */
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    const { uid } = req.user;

    if (!EXCLUDED_UIDS.includes(uid)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const result = await pool.query(
      `SELECT event_type, event_name, event_data, page_path, device_type, created_at
       FROM user_analytics
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json({
      userId,
      events: result.rows,
    });
  } catch (error) {
    logger.error('User analytics error:', error);
    res.status(500).json({ error: 'Failed to get user analytics' });
  }
});

module.exports = router;
