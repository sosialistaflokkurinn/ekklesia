/**
 * Application Configuration
 *
 * Centralized configuration for API endpoints, regions, and service URLs.
 * This avoids hardcoding values across multiple files.
 *
 * @module config
 */

/**
 * Local development detection
 * When running via Firebase Emulators (localhost), services point to local ports.
 */
export const IS_LOCAL = window.location.hostname === 'localhost'
  || window.location.hostname === '127.0.0.1';

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
 * Local: elections on :8082, events on :8080
 * Production: Cloud Run URLs
 */
export const SERVICES = {
  /**
   * Elections service - handles elections, voting, and policy sessions
   */
  ELECTIONS: IS_LOCAL
    ? 'http://localhost:8082'
    : 'https://elections-service-521240388393.europe-west1.run.app',

  /**
   * Events service - handles external events and AI chat
   * Note: Deployed to europe-west1 for proximity to database (ekklesia-db-eu1)
   */
  EVENTS: IS_LOCAL
    ? 'http://localhost:8080'
    : 'https://events-service-521240388393.europe-west1.run.app'
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
  POLICY_SESSIONS: `${SERVICES.ELECTIONS}/api/policy-sessions`,

  /**
   * Candidate metadata API
   */
  CANDIDATES: `${SERVICES.ELECTIONS}/api/candidates`
};
