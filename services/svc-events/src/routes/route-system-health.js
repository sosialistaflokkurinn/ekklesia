/**
 * System Health Routes
 *
 * Provides detailed health information for superuser dashboard and Kimi AI.
 * Returns real-time metrics from database, services, and runtime.
 */

const express = require('express');
const axios = require('axios');
const os = require('os');
const { pool, query } = require('../config/config-database');
const logger = require('../utils/util-logger');
const authenticate = require('../middleware/middleware-auth');
const { requireRole } = require('../middleware/middleware-roles');

const router = express.Router();

// Service URLs
const ELECTIONS_SERVICE_URL = process.env.ELECTIONS_SERVICE_URL || 'https://elections-service-521240388393.europe-west1.run.app';
const MEMBERS_API_URL = 'https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net';

/**
 * Get PostgreSQL database statistics
 */
async function getDatabaseStats() {
  try {
    // Test connection and get basic stats
    const connectionTest = await query('SELECT NOW() as server_time, version() as version');

    // Get database size
    const sizeResult = await query(`
      SELECT pg_database_size(current_database()) as db_size,
             pg_size_pretty(pg_database_size(current_database())) as db_size_pretty
    `);

    // Get table counts
    const tableStats = await query(`
      SELECT
        (SELECT COUNT(*) FROM external_events) as events_count,
        (SELECT COUNT(*) FROM external_events_sync_log) as sync_logs_count,
        (SELECT COUNT(*) FROM elections.voting_tokens) as voting_tokens_count
    `);

    // Get connection pool stats
    const poolStats = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    };

    // Get last sync info
    const lastSync = await query(`
      SELECT sync_type, status, events_count, completed_at
      FROM external_events_sync_log
      WHERE status = 'success'
      ORDER BY completed_at DESC
      LIMIT 1
    `);

    return {
      status: 'healthy',
      connection: 'active',
      serverTime: connectionTest.rows[0].server_time,
      version: connectionTest.rows[0].version.split(' ')[0] + ' ' + connectionTest.rows[0].version.split(' ')[1],
      size: {
        bytes: parseInt(sizeResult.rows[0].db_size),
        pretty: sizeResult.rows[0].db_size_pretty
      },
      tables: {
        external_events: parseInt(tableStats.rows[0].events_count),
        sync_logs: parseInt(tableStats.rows[0].sync_logs_count),
        voting_tokens: parseInt(tableStats.rows[0].voting_tokens_count)
      },
      pool: poolStats,
      lastSync: lastSync.rows[0] || null
    };
  } catch (error) {
    logger.error('Database stats error', { error: error.message });
    return {
      status: 'error',
      connection: 'failed',
      error: error.message
    };
  }
}

/**
 * Get runtime statistics for this service
 */
function getRuntimeStats() {
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();

  return {
    service: 'svc-events',
    nodeVersion: process.version,
    platform: process.platform,
    uptime: {
      seconds: Math.floor(uptime),
      formatted: formatUptime(uptime)
    },
    memory: {
      heapUsed: formatBytes(memUsage.heapUsed),
      heapTotal: formatBytes(memUsage.heapTotal),
      external: formatBytes(memUsage.external),
      rss: formatBytes(memUsage.rss),
      percentUsed: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    },
    cpu: {
      cores: os.cpus().length,
      model: os.cpus()[0]?.model || 'Unknown',
      loadAvg: os.loadavg()
    }
  };
}

/**
 * Check external service health
 */
async function checkServiceHealth(name, url, timeout = 5000) {
  try {
    const start = Date.now();
    const response = await axios.get(`${url}/health`, { timeout });
    const latency = Date.now() - start;

    return {
      name,
      status: response.data?.status === 'healthy' ? 'healthy' : 'degraded',
      latency: `${latency}ms`,
      version: response.data?.version || 'unknown',
      url
    };
  } catch (error) {
    return {
      name,
      status: 'unreachable',
      error: error.message,
      url
    };
  }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/**
 * Format uptime to human readable
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * GET /api/system/health
 * Detailed system health for superuser dashboard
 * Requires superuser role
 */
router.get('/health', authenticate, requireRole('superuser'), async (req, res) => {
  try {
    const startTime = Date.now();

    // Gather all health data in parallel
    const [database, electionsService] = await Promise.all([
      getDatabaseStats(),
      checkServiceHealth('svc-elections', ELECTIONS_SERVICE_URL)
    ]);

    const runtime = getRuntimeStats();
    const totalLatency = Date.now() - startTime;

    // Determine overall status
    let overallStatus = 'healthy';
    if (database.status !== 'healthy') overallStatus = 'degraded';
    if (electionsService.status === 'unreachable') overallStatus = 'degraded';

    const healthData = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checkDuration: `${totalLatency}ms`,
      services: {
        'svc-events': {
          name: 'svc-events',
          status: 'healthy',
          ...runtime
        },
        'svc-elections': electionsService,
        database: {
          name: 'Cloud SQL PostgreSQL',
          ...database
        }
      },
      summary: {
        healthy: [runtime, database, electionsService].filter(s => s.status === 'healthy').length,
        degraded: [runtime, database, electionsService].filter(s => s.status === 'degraded').length,
        down: [runtime, database, electionsService].filter(s => s.status === 'unreachable' || s.status === 'error').length
      }
    };

    logger.info('System health check completed', {
      operation: 'system_health_check',
      status: overallStatus,
      duration: totalLatency
    });

    res.json(healthData);

  } catch (error) {
    logger.error('System health check failed', {
      operation: 'system_health_check',
      error: error.message
    });

    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/system/health/summary
 * Quick health summary (text format for Kimi)
 */
router.get('/health/summary', authenticate, requireRole('superuser'), async (req, res) => {
  try {
    const [database, electionsService] = await Promise.all([
      getDatabaseStats(),
      checkServiceHealth('svc-elections', ELECTIONS_SERVICE_URL)
    ]);

    const runtime = getRuntimeStats();

    // Build text summary for Kimi
    const lines = [
      `## Kerfisheilsa - ${new Date().toLocaleString('is-IS')}`,
      '',
      '### Þjónustur',
      `- **svc-events**: ✅ Í gangi (uptime: ${runtime.uptime.formatted}, minni: ${runtime.memory.percentUsed}% notað)`,
      `- **svc-elections**: ${electionsService.status === 'healthy' ? '✅' : '⚠️'} ${electionsService.status} (latency: ${electionsService.latency || 'N/A'})`,
      '',
      '### Gagnagrunnur (Cloud SQL)',
      `- Staða: ${database.status === 'healthy' ? '✅ Tengdur' : '❌ Villa'}`,
      `- Stærð: ${database.size?.pretty || 'N/A'}`,
      `- Viðburðir: ${database.tables?.external_events || 0}`,
      `- Atkvæðagreiðslur (tokens): ${database.tables?.voting_tokens || 0}`,
      `- Connection pool: ${database.pool?.idleCount || 0} idle, ${database.pool?.waitingCount || 0} waiting`,
      '',
      '### Síðasta sync',
      database.lastSync
        ? `- ${database.lastSync.sync_type}: ${database.lastSync.events_count} items (${new Date(database.lastSync.completed_at).toLocaleString('is-IS')})`
        : '- Engin sync skráð',
      '',
      '### Runtime (svc-events)',
      `- Node.js: ${runtime.nodeVersion}`,
      `- Minni: ${runtime.memory.heapUsed} / ${runtime.memory.heapTotal} (${runtime.memory.percentUsed}%)`,
      `- CPU kjarnar: ${runtime.cpu.cores}`,
      `- Load avg: ${runtime.cpu.loadAvg.map(l => l.toFixed(2)).join(', ')}`
    ];

    res.type('text/plain').send(lines.join('\n'));

  } catch (error) {
    res.status(500).type('text/plain').send(`Villa við að sækja heilsugögn: ${error.message}`);
  }
});

module.exports = router;
