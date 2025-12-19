/**
 * Application Configuration
 *
 * Centralized configuration for API endpoints, regions, and service URLs.
 * This avoids hardcoding values across multiple files.
 *
 * @module config
 */

/**
 * GCP region for Firebase Functions and Cloud Run services
 */
export const REGION = 'europe-west2';

/**
 * GCP Project ID
 */
export const PROJECT_ID = 'ekklesia-prod-10-2025';

/**
 * Cloud Run service URLs
 */
export const SERVICES = {
  /**
   * Elections service - handles elections, voting, and policy sessions
   */
  ELECTIONS: 'https://elections-service-521240388393.europe-west2.run.app',

  /**
   * Events service - handles external events and Kimi chat
   */
  EVENTS: 'https://events-service-521240388393.europe-west2.run.app'
};

/**
 * API endpoint URLs (derived from service URLs)
 */
export const API_ENDPOINTS = {
  /**
   * Nomination committee API
   */
  NOMINATION: `${SERVICES.ELECTIONS}/api/nomination`,

  /**
   * Elections API
   */
  ELECTIONS: `${SERVICES.ELECTIONS}/api/elections`,

  /**
   * Policy sessions API
   */
  POLICY_SESSIONS: `${SERVICES.ELECTIONS}/api/policy-sessions`
};
