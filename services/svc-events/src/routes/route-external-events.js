const express = require('express');
const axios = require('axios');
const router = express.Router();
const logger = require('../utils/util-logger');

// TODO: Get access to real Sósíalistaflokkurinn page (ID: 1284030001655471)
// Currently using test page (Guðröður). Need to:
// 1. Create System User in "Sósíalistaflokkurinn" Business Portfolio
// 2. Give System User access to the Page and App
// 3. Generate token with pages_read_engagement
// See: tmp/FACEBOOK_INTEGRATION_STATUS.md

// Simple in-memory cache
let eventsCache = {
  data: null,
  timestamp: 0
};
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

router.get('/', async (req, res) => {
  try {
    // Check cache
    const now = Date.now();
    if (eventsCache.data && (now - eventsCache.timestamp < CACHE_DURATION)) {
      logger.info('Serving events from cache');
      return res.json(eventsCache.data);
    }

    const pageId = process.env.FB_PAGE_ID;
    const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;

    if (!pageId || !accessToken) {
      logger.error('Missing Facebook credentials');
      return res.status(500).json({ error: 'Service configuration error' });
    }

    const fields = 'id,name,description,start_time,end_time,cover,place,event_times';
    const url = `https://graph.facebook.com/v19.0/${pageId}/events?fields=${fields}&access_token=${accessToken}`;

    logger.info('Fetching events from Facebook Graph API');
    const response = await axios.get(url);
    
    const events = response.data.data.map(event => ({
      id: event.id,
      title: event.name,
      description: event.description,
      startTime: event.start_time,
      endTime: event.end_time,
      location: event.place ? event.place.name : 'Online',
      imageUrl: event.cover ? event.cover.source : null,
      facebookUrl: `https://www.facebook.com/events/${event.id}`
    }));

    // Update cache
    eventsCache = {
      data: events,
      timestamp: now
    };

    res.json(events);
  } catch (error) {
    logger.error('Error fetching Facebook events', { error: error.message, response: error.response?.data });
    
    // If cache exists (even if expired), serve it as fallback
    if (eventsCache.data) {
      logger.warn('Serving expired cache due to API error');
      return res.json(eventsCache.data);
    }

    res.status(502).json({ error: 'Failed to fetch events from provider' });
  }
});

module.exports = router;
