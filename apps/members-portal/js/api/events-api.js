/**
 * Events API Client
 *
 * Handles fetching organizational events data.
 * Currently uses static JSON file, designed to switch to Events Service API
 * or Meta Graph API integration in the future.
 *
 * Data Sources:
 * - Static JSON file (current): /data/organizational-events.json
 * - Future: Events Service API or Meta Graph API
 *
 * @module api/events-api
 */

// DATA SOURCE CONFIGURATION
// Switch to true when Events Service API or Meta API is ready
const USE_API = false;

// Future API endpoint (when implemented)
const EVENTS_API_BASE = 'https://events-service-ymzrguoifa-nw.a.run.app';

/**
 * Get all organizational events
 *
 * @param {Object} filters - Optional filters: { status: 'upcoming' | 'past' }
 * @returns {Promise<Array>} List of event objects
 *
 * Event object:
 * {
 *   id: string,
 *   title: string,
 *   subtitle?: string,
 *   date: string (YYYY-MM-DD),
 *   time: string,
 *   endTime?: string,
 *   doorOpen?: string,
 *   location: string,
 *   type: string ('discussion' | 'member-meeting' | 'workshop' | ...),
 *   format: string ('hybrid' | 'remote' | 'in-person'),
 *   description: string,
 *   speaker?: string,
 *   speakerTitle?: string,
 *   moderator?: string,
 *   organizers?: string[],
 *   agenda?: string[],
 *   duration?: string,
 *   refreshments?: boolean,
 *   zoomLink?: string,
 *   facebookEvent?: string,
 *   notes?: string,
 *   elections?: Array<{id, title, description}>,
 *   materials?: {
 *     agenda?: string,
 *     slides?: string,
 *     minutes?: string,
 *     other?: Array<{title, url}>
 *   },
 *   attendance?: {
 *     responded: number,
 *     going: number,
 *     interested: number
 *   },
 *   status: string ('upcoming' | 'past')
 * }
 */
export async function getEvents(filters = {}) {
  if (USE_API) {
    return getEventsFromAPI(filters);
  }

  // Current implementation: Static JSON file
  return getEventsFromJSON(filters);
}

/**
 * Get events from static JSON file
 *
 * @private
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} List of events
 */
async function getEventsFromJSON(filters = {}) {
  try {
    const response = await fetch('/data/organizational-events.json');

    if (!response.ok) {
      throw new Error(`Failed to load events data: ${response.status}`);
    }

    const events = await response.json();

    // Apply filters if specified
    if (filters.status) {
      return filterEventsByStatus(events, filters.status);
    }

    return events;

  } catch (error) {
    console.error('[Events API] Error loading events from JSON:', error);
    throw error;
  }
}

/**
 * Get events from Events Service API (future implementation)
 *
 * @private
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} List of events
 */
async function getEventsFromAPI(filters = {}) {
  try {
    const url = new URL(`${EVENTS_API_BASE}/api/events`);

    if (filters.status) {
      url.searchParams.append('status', filters.status);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.events || [];

  } catch (error) {
    console.error('[Events API] Error fetching events from API:', error);
    throw error;
  }
}

/**
 * Filter events by status (upcoming/past) based on date
 *
 * @private
 * @param {Array} events - All events
 * @param {string} status - 'upcoming' or 'past'
 * @returns {Array} Filtered events
 */
function filterEventsByStatus(events, status) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return events.filter(event => {
    const eventDate = new Date(event.date);
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

    // Check if event has ended
    let eventEnded = eventDay < today;

    // If event has end time and is today, check if it's still ongoing
    if (event.endTime && eventDay.getTime() === today.getTime()) {
      const [endHour, endMinute] = event.endTime.split(':').map(Number);
      const endDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMinute);
      eventEnded = now >= endDateTime;
    }

    if (status === 'upcoming') {
      return !eventEnded; // Event is today or in the future, or still ongoing
    } else if (status === 'past') {
      return eventEnded; // Event has ended
    }

    return true; // No filter
  });
}

/**
 * Get single event by ID
 *
 * @param {string} eventId - Event ID
 * @returns {Promise<Object|null>} Event object or null if not found
 */
export async function getEventById(eventId) {
  try {
    const events = await getEvents();
    return events.find(e => e.id === eventId) || null;
  } catch (error) {
    console.error(`[Events API] Error fetching event ${eventId}:`, error);
    throw error;
  }
}
