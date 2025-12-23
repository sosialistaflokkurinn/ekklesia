/**
 * Service Catalog - Unified Service Definitions
 *
 * Single source of truth for all services. Replaces 9 separate arrays
 * and 2 mapping objects from the old implementation.
 *
 * Each service defines:
 * - id: Unique identifier (matches health check)
 * - nameKey: i18n key for display name
 * - group: Architecture diagram group
 * - category: Services tab section
 * - type: 'cloudrun' | 'function' | 'database' | 'firebase' | 'external'
 * - registrationUsage?: Optional usage description for registration site
 */

// Service types
export const SERVICE_TYPES = {
  CLOUDRUN: 'cloudrun',
  FUNCTION: 'function',
  DATABASE: 'database',
  FIREBASE: 'firebase',
  EXTERNAL: 'external'
};

// Service categories (for Services tab sections)
export const CATEGORIES = {
  CORE: 'core',
  MEMBER: 'member',
  ADDRESS: 'address',
  LOOKUP: 'lookup',
  REGISTRATION: 'registration',
  SUPERUSER: 'superuser',
  EMAIL: 'email',
  HEATMAP: 'heatmap',
  DATABASE: 'database',
  FIREBASE: 'firebase'
};

// Architecture diagram groups
export const GROUPS = {
  AUTH: 'auth',
  FIRESTORE: 'firestore',
  CLOUDRUN: 'cloudrun',
  MEMBER: 'member',
  ADDRESS: 'address',
  AUDIT: 'audit',
  SUPERUSER: 'superuser',
  LOOKUP: 'lookup',
  REGISTRATION: 'registration',
  EMAIL: 'email',
  HEATMAP: 'heatmap'
};

// i18n keys for group names
export const GROUP_NAME_KEYS = {
  [GROUPS.AUTH]: 'architecture_group_auth',
  [GROUPS.FIRESTORE]: 'architecture_group_firestore',
  [GROUPS.CLOUDRUN]: 'architecture_group_cloudrun',
  [GROUPS.MEMBER]: 'architecture_group_member',
  [GROUPS.ADDRESS]: 'architecture_group_address',
  [GROUPS.AUDIT]: 'architecture_group_audit',
  [GROUPS.SUPERUSER]: 'architecture_group_superuser',
  [GROUPS.LOOKUP]: 'architecture_group_lookup',
  [GROUPS.REGISTRATION]: 'architecture_group_registration',
  [GROUPS.EMAIL]: 'architecture_group_email',
  [GROUPS.HEATMAP]: 'architecture_group_heatmap'
};

// Unified service catalog
export const SERVICES = [
  // ==========================================================================
  // CLOUD RUN SERVICES (Core GCP)
  // ==========================================================================
  { id: 'elections-service', nameKey: 'service_name_elections', group: GROUPS.CLOUDRUN, category: CATEGORIES.CORE, type: SERVICE_TYPES.CLOUDRUN },
  { id: 'events-service', nameKey: 'service_name_events', group: GROUPS.CLOUDRUN, category: CATEGORIES.CORE, type: SERVICE_TYPES.CLOUDRUN },
  { id: 'healthz', nameKey: 'service_name_healthz', group: GROUPS.AUDIT, category: CATEGORIES.CORE, type: SERVICE_TYPES.CLOUDRUN },
  { id: 'django-socialism', nameKey: 'service_name_django_socialism', group: GROUPS.CLOUDRUN, category: CATEGORIES.CORE, type: SERVICE_TYPES.CLOUDRUN, registrationUsage: 'Django API sync' },

  // ==========================================================================
  // FIREBASE FUNCTIONS - Member Operations
  // ==========================================================================
  { id: 'handlekenniauth', nameKey: 'service_name_handlekenniauth', group: GROUPS.AUTH, category: CATEGORIES.MEMBER, type: SERVICE_TYPES.FUNCTION },
  { id: 'verifymembership', nameKey: 'service_name_verifymembership', group: GROUPS.AUTH, category: CATEGORIES.MEMBER, type: SERVICE_TYPES.FUNCTION },
  { id: 'updatememberprofile', nameKey: 'service_name_updatememberprofile', group: GROUPS.MEMBER, category: CATEGORIES.MEMBER, type: SERVICE_TYPES.FUNCTION },
  { id: 'softdeleteself', nameKey: 'service_name_softdeleteself', group: GROUPS.MEMBER, category: CATEGORIES.MEMBER, type: SERVICE_TYPES.FUNCTION },
  { id: 'reactivateself', nameKey: 'service_name_reactivateself', group: GROUPS.MEMBER, category: CATEGORIES.MEMBER, type: SERVICE_TYPES.FUNCTION },

  // ==========================================================================
  // FIREBASE FUNCTIONS - Address Validation
  // ==========================================================================
  { id: 'search-addresses', nameKey: 'service_name_search_addresses', group: GROUPS.ADDRESS, category: CATEGORIES.ADDRESS, type: SERVICE_TYPES.FUNCTION, registrationUsage: 'Heimilisfangaleit' },
  { id: 'validate-address', nameKey: 'service_name_validate_address', group: GROUPS.ADDRESS, category: CATEGORIES.ADDRESS, type: SERVICE_TYPES.FUNCTION, registrationUsage: 'Stadfesting heimilisfangs' },
  { id: 'validate-postal-code', nameKey: 'service_name_validate_postal_code', group: GROUPS.ADDRESS, category: CATEGORIES.ADDRESS, type: SERVICE_TYPES.FUNCTION, registrationUsage: 'Stadfesting postnumers' },

  // ==========================================================================
  // FIREBASE FUNCTIONS - Lookup Data
  // ==========================================================================
  { id: 'list-unions', nameKey: 'service_name_list_unions', group: GROUPS.LOOKUP, category: CATEGORIES.LOOKUP, type: SERVICE_TYPES.FUNCTION, registrationUsage: 'Stettarfelagaval' },
  { id: 'list-job-titles', nameKey: 'service_name_list_job_titles', group: GROUPS.LOOKUP, category: CATEGORIES.LOOKUP, type: SERVICE_TYPES.FUNCTION, registrationUsage: 'Starfsheitaval' },
  { id: 'list-countries', nameKey: 'service_name_list_countries', group: GROUPS.LOOKUP, category: CATEGORIES.LOOKUP, type: SERVICE_TYPES.FUNCTION, registrationUsage: 'Landaval' },
  { id: 'list-postal-codes', nameKey: 'service_name_list_postal_codes', group: GROUPS.LOOKUP, category: CATEGORIES.LOOKUP, type: SERVICE_TYPES.FUNCTION, registrationUsage: 'Postnumeraval' },
  { id: 'get-cells-by-postal-code', nameKey: 'service_name_get_cells_by_postal_code', group: GROUPS.LOOKUP, category: CATEGORIES.LOOKUP, type: SERVICE_TYPES.FUNCTION, registrationUsage: 'Selluuthlutun' },

  // ==========================================================================
  // FIREBASE FUNCTIONS - Registration
  // ==========================================================================
  { id: 'register-member', nameKey: 'service_name_register_member', group: GROUPS.REGISTRATION, category: CATEGORIES.REGISTRATION, type: SERVICE_TYPES.FUNCTION, registrationUsage: 'Skraning felaga' },

  // ==========================================================================
  // FIREBASE FUNCTIONS - Superuser Operations
  // ==========================================================================
  { id: 'checksystemhealth', nameKey: 'service_name_checksystemhealth', group: GROUPS.SUPERUSER, category: CATEGORIES.SUPERUSER, type: SERVICE_TYPES.FUNCTION },
  { id: 'setuserrole', nameKey: 'service_name_setuserrole', group: GROUPS.SUPERUSER, category: CATEGORIES.SUPERUSER, type: SERVICE_TYPES.FUNCTION },
  { id: 'getuserrole', nameKey: 'service_name_getuserrole', group: GROUPS.SUPERUSER, category: CATEGORIES.SUPERUSER, type: SERVICE_TYPES.FUNCTION },
  { id: 'getauditlogs', nameKey: 'service_name_getauditlogs', group: GROUPS.SUPERUSER, category: CATEGORIES.SUPERUSER, type: SERVICE_TYPES.FUNCTION },
  { id: 'getloginaudit', nameKey: 'service_name_getloginaudit', group: GROUPS.SUPERUSER, category: CATEGORIES.SUPERUSER, type: SERVICE_TYPES.FUNCTION },
  { id: 'harddeletemember', nameKey: 'service_name_harddeletemember', group: GROUPS.SUPERUSER, category: CATEGORIES.SUPERUSER, type: SERVICE_TYPES.FUNCTION },
  { id: 'anonymizemember', nameKey: 'service_name_anonymizemember', group: GROUPS.SUPERUSER, category: CATEGORIES.SUPERUSER, type: SERVICE_TYPES.FUNCTION },
  { id: 'listelevatedusers', nameKey: 'service_name_listelevatedusers', group: GROUPS.SUPERUSER, category: CATEGORIES.SUPERUSER, type: SERVICE_TYPES.FUNCTION },
  { id: 'purgedeleted', nameKey: 'service_name_purgedeleted', group: GROUPS.SUPERUSER, category: CATEGORIES.SUPERUSER, type: SERVICE_TYPES.FUNCTION },
  { id: 'getdeletedcounts', nameKey: 'service_name_getdeletedcounts', group: GROUPS.SUPERUSER, category: CATEGORIES.SUPERUSER, type: SERVICE_TYPES.FUNCTION },

  // ==========================================================================
  // FIREBASE FUNCTIONS - Email (Issue #323)
  // ==========================================================================
  { id: 'listemailtemplates', nameKey: 'service_name_listemailtemplates', group: GROUPS.EMAIL, category: CATEGORIES.EMAIL, type: SERVICE_TYPES.FUNCTION },
  { id: 'getemailtemplate', nameKey: 'service_name_getemailtemplate', group: GROUPS.EMAIL, category: CATEGORIES.EMAIL, type: SERVICE_TYPES.FUNCTION },
  { id: 'saveemailtemplate', nameKey: 'service_name_saveemailtemplate', group: GROUPS.EMAIL, category: CATEGORIES.EMAIL, type: SERVICE_TYPES.FUNCTION },
  { id: 'deleteemailtemplate', nameKey: 'service_name_deleteemailtemplate', group: GROUPS.EMAIL, category: CATEGORIES.EMAIL, type: SERVICE_TYPES.FUNCTION },
  { id: 'sendemail', nameKey: 'service_name_sendemail', group: GROUPS.EMAIL, category: CATEGORIES.EMAIL, type: SERVICE_TYPES.FUNCTION },
  { id: 'listemailcampaigns', nameKey: 'service_name_listemailcampaigns', group: GROUPS.EMAIL, category: CATEGORIES.EMAIL, type: SERVICE_TYPES.FUNCTION },
  { id: 'createemailcampaign', nameKey: 'service_name_createemailcampaign', group: GROUPS.EMAIL, category: CATEGORIES.EMAIL, type: SERVICE_TYPES.FUNCTION },
  { id: 'sendcampaign', nameKey: 'service_name_sendcampaign', group: GROUPS.EMAIL, category: CATEGORIES.EMAIL, type: SERVICE_TYPES.FUNCTION },
  { id: 'getemailstats', nameKey: 'service_name_getemailstats', group: GROUPS.EMAIL, category: CATEGORIES.EMAIL, type: SERVICE_TYPES.FUNCTION },
  { id: 'listemaillogs', nameKey: 'service_name_listemaillogs', group: GROUPS.EMAIL, category: CATEGORIES.EMAIL, type: SERVICE_TYPES.FUNCTION },
    { id: 'getemailpreferences', nameKey: 'service_name_getemailpreferences', group: GROUPS.EMAIL, category: CATEGORIES.EMAIL, type: SERVICE_TYPES.FUNCTION },
  { id: 'updateemailpreferences', nameKey: 'service_name_updateemailpreferences', group: GROUPS.EMAIL, category: CATEGORIES.EMAIL, type: SERVICE_TYPES.FUNCTION },
  { id: 'unsubscribe', nameKey: 'service_name_unsubscribe', group: GROUPS.EMAIL, category: CATEGORIES.EMAIL, type: SERVICE_TYPES.FUNCTION },

  // ==========================================================================
  // FIREBASE FUNCTIONS - Heatmap/Analytics
  // ==========================================================================
  { id: 'compute-member-heatmap-stats', nameKey: 'service_name_compute_heatmap_stats', group: GROUPS.HEATMAP, category: CATEGORIES.HEATMAP, type: SERVICE_TYPES.FUNCTION },
  { id: 'get-member-heatmap-data', nameKey: 'service_name_get_heatmap_data', group: GROUPS.HEATMAP, category: CATEGORIES.HEATMAP, type: SERVICE_TYPES.FUNCTION },

  // ==========================================================================
  // DATABASE SERVICES
  // ==========================================================================
  { id: 'firestore', nameKey: null, name: 'Firestore', group: GROUPS.FIRESTORE, category: CATEGORIES.DATABASE, type: SERVICE_TYPES.DATABASE },
  { id: 'cloudsql', nameKey: null, name: 'Cloud SQL (PostgreSQL)', group: null, category: CATEGORIES.DATABASE, type: SERVICE_TYPES.DATABASE },

  // ==========================================================================
  // FIREBASE INFRASTRUCTURE
  // ==========================================================================
  { id: 'firebase-auth', nameKey: null, name: 'Firebase Auth', group: null, category: CATEGORIES.FIREBASE, type: SERVICE_TYPES.FIREBASE },
  { id: 'firebase-hosting', nameKey: null, name: 'Firebase Hosting', group: null, category: CATEGORIES.FIREBASE, type: SERVICE_TYPES.FIREBASE }
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all services in a category
 */
export function getServicesByCategory(category) {
  return SERVICES.filter(s => s.category === category);
}

/**
 * Get all services in an architecture group
 */
export function getServicesByGroup(group) {
  return SERVICES.filter(s => s.group === group);
}

/**
 * Get a single service by ID
 */
export function getServiceById(id) {
  return SERVICES.find(s => s.id === id);
}

/**
 * Get services used by the registration site (have registrationUsage field)
 */
export function getRegistrationSiteServices() {
  return SERVICES.filter(s => s.registrationUsage);
}

/**
 * Get i18n key for a group name
 */
export function getGroupNameKey(group) {
  return GROUP_NAME_KEYS[group] || null;
}

/**
 * Get all unique groups
 */
export function getAllGroups() {
  return Object.values(GROUPS);
}

/**
 * Get service counts by category
 */
export function getServiceCounts() {
  return {
    core: getServicesByCategory(CATEGORIES.CORE).length,
    functions: [
      CATEGORIES.MEMBER,
      CATEGORIES.ADDRESS,
      CATEGORIES.LOOKUP,
      CATEGORIES.REGISTRATION,
      CATEGORIES.SUPERUSER,
      CATEGORIES.EMAIL,
      CATEGORIES.HEATMAP
    ].reduce((sum, cat) => sum + getServicesByCategory(cat).length, 0),
    database: getServicesByCategory(CATEGORIES.DATABASE).length,
    firebase: getServicesByCategory(CATEGORIES.FIREBASE).length
  };
}
