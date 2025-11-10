/**
 * Structured Logging Utility for Elections Service
 *
 * Provides Winston-based logging with:
 * - Google Cloud Logging integration
 * - Automatic PII sanitization
 * - Structured JSON format
 * - Correlation ID support
 * - Error context enrichment
 *
 * Usage:
 *   const logger = require('./utils/logger');
 *   logger.info('User voted', { answer: 'yes', correlationId: '123' });
 *   logger.error('Vote failed', { error: err, correlationId: '123' });
 */

const winston = require('winston');
const { LoggingWinston } = require('@google-cloud/logging-winston');

// PII patterns to sanitize (Issue #240)
const PII_PATTERNS = {
  // Kennitala (Icelandic SSN) - DDMMYY-NNNN
  kennitala: /\b\d{6}-?\d{4}\b/g,

  // Email addresses (except @example.com)
  email: /\b[A-Za-z0-9._%+-]+@(?!example\.com)[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,

  // Icelandic phone numbers
  phone: /\b\d{3}[\s-]?\d{4}\b/g,

  // Token hashes (SHA-256 = 64 hex chars) - for voter anonymity
  tokenHash: /\b[a-f0-9]{64}\b/gi,

  // IP addresses (partial anonymization - keep first 2 octets)
  ipAddress: /\b(\d{1,3}\.\d{1,3}\.)\d{1,3}\.\d{1,3}\b/g,
};

/**
 * Sanitize object to remove PII
 * Deep traversal of objects and arrays
 *
 * @param {any} obj - Object to sanitize
 * @returns {any} Sanitized copy
 */
function sanitizePII(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle strings - apply PII patterns
  if (typeof obj === 'string') {
    let sanitized = obj;

    // Replace kennitalas with redacted version
    sanitized = sanitized.replace(PII_PATTERNS.kennitala, '[KENNITALA-REDACTED]');

    // Replace emails with redacted version
    sanitized = sanitized.replace(PII_PATTERNS.email, '[EMAIL-REDACTED]');

    // Replace phone numbers
    sanitized = sanitized.replace(PII_PATTERNS.phone, '[PHONE-REDACTED]');

    // Replace token hashes (voter anonymity - Issue #128)
    sanitized = sanitized.replace(PII_PATTERNS.tokenHash, '[TOKEN-REDACTED]');

    // Anonymize IP addresses (keep first 2 octets for geo analysis)
    sanitized = sanitized.replace(PII_PATTERNS.ipAddress, '$1***.**');

    return sanitized;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizePII(item));
  }

  // Handle objects
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Explicitly drop sensitive fields (Issue #128 - voter anonymity)
      if (key === 'token_hash' || key === 'tokenHash' || key === 'token') {
        sanitized[key] = '[TOKEN-REDACTED]';
        continue;
      }

      // Recursively sanitize nested objects
      sanitized[key] = sanitizePII(value);
    }
    return sanitized;
  }

  // Return primitives as-is (numbers, booleans, etc.)
  return obj;
}

/**
 * Create Winston logger instance
 */
function createLogger() {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  // Base Winston format
  const baseFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.metadata(),
    winston.format.json()
  );

  // Console format for development
  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      const sanitizedMeta = sanitizePII(meta);
      const metaStr = Object.keys(sanitizedMeta).length > 0
        ? '\n' + JSON.stringify(sanitizedMeta, null, 2)
        : '';
      return `${timestamp} [${level}]: ${message}${metaStr}`;
    })
  );

  const transports = [];

  if (isDevelopment) {
    // Development: Colorized console output
    transports.push(
      new winston.transports.Console({
        format: consoleFormat,
      })
    );
  } else {
    // Production: Google Cloud Logging
    transports.push(
      new LoggingWinston({
        projectId: process.env.GCP_PROJECT_ID || 'ekklesia-prod-10-2025',
        serviceContext: {
          service: 'elections-service',
          version: process.env.SERVICE_VERSION || '1.0.0',
        },
        // Automatically adds trace context
        labels: {
          environment: process.env.NODE_ENV || 'production',
        },
      })
    );

    // Also log to console for Cloud Run logs
    transports.push(
      new winston.transports.Console({
        format: baseFormat,
      })
    );
  }

  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: baseFormat,
    transports,
    // Sanitize all log data
    rewriters: [
      (info) => {
        return sanitizePII(info);
      }
    ],
  });

  return logger;
}

// Export singleton logger instance
const logger = createLogger();

/**
 * Create child logger with additional context
 * Useful for request-scoped logging with correlation ID
 *
 * @param {object} defaultMeta - Metadata to add to all logs
 * @returns {winston.Logger} Child logger
 */
logger.createChild = function(defaultMeta) {
  return logger.child(defaultMeta);
};

module.exports = logger;
