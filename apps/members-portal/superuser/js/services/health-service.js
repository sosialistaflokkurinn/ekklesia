/**
 * Health Service - System Health Data Management
 *
 * Handles fetching, caching, and status calculation for system health.
 * Consolidates scattered status functions into a single module.
 */

import { httpsCallable } from '../../../firebase/app.js';
import { debug } from '../../../js/utils/util-debug.js';
import { getServicesByGroup, SERVICE_TYPES } from './service-catalog.js';

// Module state (encapsulated)
let healthData = null;
let lastFetchTime = null;

// =============================================================================
// DATA FETCHING
// =============================================================================

/**
 * Fetch health data from Cloud Function
 */
export async function fetchHealthData() {
  try {
    const checkSystemHealth = httpsCallable('checkSystemHealth', 'europe-west2');
    const result = await checkSystemHealth();
    healthData = result.data;
    lastFetchTime = new Date();
    debug.log('Health check result:', healthData);
    return healthData;
  } catch (error) {
    debug.error('Health check failed:', error);
    throw error;
  }
}

/**
 * Get cached health data
 */
export function getHealthData() {
  return healthData;
}

/**
 * Get timestamp of last fetch
 */
export function getLastFetchTime() {
  return lastFetchTime;
}

// =============================================================================
// STATUS CALCULATIONS
// =============================================================================

/**
 * Get status for a single service
 */
export function getServiceStatus(serviceId) {
  // Firestore is always healthy if page loaded (session init requires it)
  if (serviceId === 'firestore-database' || serviceId === 'firestore') {
    return 'healthy';
  }

  if (!healthData) return 'unknown';

  const allServices = healthData.services || [];
  const service = allServices.find(s => s.id === serviceId || s.name === serviceId);
  return service ? (service.status || 'available') : 'unknown';
}

/**
 * Get aggregated status for a group of services
 */
export function getGroupStatus(groupId) {
  const services = getServicesByGroup(groupId);
  const statuses = services.map(s => getServiceStatus(s.id));

  if (statuses.some(s => s === 'down' || s === 'error')) return 'down';
  if (statuses.some(s => s === 'degraded' || s === 'slow')) return 'degraded';
  return 'healthy';
}

/**
 * Get overall system status summary
 */
export function getOverallStatus() {
  if (!healthData) {
    return { status: 'unknown', healthy: 0, degraded: 0, down: 0, available: 0 };
  }

  const allServices = healthData.services || [];
  const healthy = allServices.filter(s => s.status === 'healthy').length;
  const available = allServices.filter(s => s.status === 'available').length;
  const degraded = allServices.filter(s => s.status === 'degraded' || s.status === 'slow').length;
  const down = allServices.filter(s => s.status === 'down' || s.status === 'error').length;

  let status = 'healthy';
  if (down > 0) status = 'down';
  else if (degraded > 0) status = 'degraded';

  return { status, healthy, degraded, down, available };
}

/**
 * Get Cloud Run overall status based on thresholds
 */
export function getOverallCloudRunStatus() {
  if (!healthData) return 'unknown';

  const allStatuses = (healthData.services || []).map(s => s.status);
  const downCount = allStatuses.filter(s => s === 'down' || s === 'error').length;
  const degradedCount = allStatuses.filter(s => s === 'degraded' || s === 'slow').length;

  if (downCount > 3) return 'down';
  if (downCount > 0 || degradedCount > 3) return 'degraded';
  return 'healthy';
}

/**
 * Get Cloud SQL status
 */
export function getCloudSqlStatus() {
  if (!healthData) return 'unknown';
  const service = (healthData.services || []).find(s => s.id === 'cloudsql');
  return service?.status || 'healthy';
}

/**
 * Get Django status (based on updatememberprofile which uses Django)
 */
export function getDjangoStatus() {
  const updateStatus = getServiceStatus('updatememberprofile');
  if (updateStatus === 'down' || updateStatus === 'error') return 'down';
  if (updateStatus === 'degraded' || updateStatus === 'slow') return 'degraded';
  return 'healthy';
}

// =============================================================================
// SERVICE DATA MAPPING
// =============================================================================

/**
 * Merge catalog service with health data
 * Firebase Functions are assumed healthy if page loaded
 */
export function mapServiceWithHealth(service) {
  const serverResult = healthData?.services?.find(s => s.id === service.id);

  // Firebase Functions are serverless - if page loads, they work
  if (service.type === SERVICE_TYPES.FUNCTION) {
    return {
      ...service,
      ...serverResult,
      status: 'healthy',
      message: serverResult?.responseTime ? `${serverResult.responseTime}ms` : null
    };
  }

  // Firebase infrastructure
  if (service.type === SERVICE_TYPES.FIREBASE) {
    if (service.id === 'firebase-hosting') {
      return { ...service, status: 'healthy', message: null };
    }
    if (service.id === 'firebase-auth') {
      return { ...service, status: 'healthy', message: null };
    }
  }

  // Database services
  if (service.type === SERVICE_TYPES.DATABASE) {
    if (service.id === 'firestore') {
      return { ...service, status: 'healthy', message: null };
    }
    if (serverResult) {
      return { ...service, ...serverResult };
    }
    return { ...service, status: 'unknown', message: null };
  }

  // CloudRun services - use actual health check data
  if (serverResult) {
    return { ...service, ...serverResult };
  }

  return { ...service, status: 'unknown', message: null };
}

/**
 * Map an array of services with health data
 */
export function mapServicesWithHealth(services) {
  return services.map(mapServiceWithHealth);
}
