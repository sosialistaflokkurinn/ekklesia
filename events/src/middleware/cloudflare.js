// Cloudflare Origin Protection Middleware
// Blocks direct access to Cloud Run URLs, only allows traffic from Cloudflare

// Cloudflare IP ranges (IPv4)
// Source: https://www.cloudflare.com/ips-v4
// Last updated: 2025-10-12
const CLOUDFLARE_IPS_V4 = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22'
];

// Cloudflare IP ranges (IPv6)
// Source: https://www.cloudflare.com/ips-v6
const CLOUDFLARE_IPS_V6 = [
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32'
];

/**
 * Check if IP is in CIDR range (IPv4 only)
 * @param {string} ip - IP address to check
 * @param {string} cidr - CIDR notation (e.g., 104.16.0.0/13)
 * @returns {boolean}
 */
function ipInRange(ip, cidr) {
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  return (ipToInt(ip) & mask) === (ipToInt(range) & mask);
}

/**
 * Convert IPv4 address to integer
 * @param {string} ip - IP address (e.g., 192.168.1.1)
 * @returns {number}
 */
function ipToInt(ip) {
  return ip.split('.').reduce((int, oct) => (int << 8) + parseInt(oct, 10), 0) >>> 0;
}

/**
 * Check if IP belongs to Cloudflare
 * @param {string} ip - IP address to check
 * @returns {boolean}
 */
function isCloudflareIP(ip) {
  // IPv6
  if (ip.includes(':')) {
    // Simplified check for IPv6 (exact match of prefix)
    return CLOUDFLARE_IPS_V6.some(range => {
      const prefix = range.split('::')[0];
      return ip.startsWith(prefix);
    });
  }

  // IPv4
  return CLOUDFLARE_IPS_V4.some(range => ipInRange(ip, range));
}

/**
 * Express middleware to enforce Cloudflare-only access
 * Blocks direct access to Cloud Run URLs
 *
 * Usage:
 *   const { cloudflareOnly } = require('./middleware/cloudflare');
 *   app.use(cloudflareOnly);
 *
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
function cloudflareOnly(req, res, next) {
  // Get real IP from Cloudflare headers
  // CF-Connecting-IP is the most reliable (set by Cloudflare)
  const clientIP = req.headers['cf-connecting-ip'] ||
                   req.headers['x-forwarded-for']?.split(',')[0].trim() ||
                   req.connection.remoteAddress ||
                   req.socket.remoteAddress;

  // Allow localhost for local development
  if (process.env.NODE_ENV === 'development' &&
      (clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === 'localhost')) {
    console.log(`INFO: Allowing localhost access for development: ${clientIP}`);
    return next();
  }

  // TEMPORARY: Allow direct access from Firebase Hosting until Cloudflare DNS is fixed
  // TODO: Remove this once Cloudflare DNS records are updated
  const origin = req.headers['origin'] || '';
  if (origin.includes('firebase') || origin.includes('web.app') || origin.includes('firebaseapp.com')) {
    console.log(`INFO: Allowing Firebase Hosting access (temporary): ${origin}`);
    return next();
  }

  // Check if request came through Cloudflare (most reliable check)
  // CF-Ray header is unique to Cloudflare and cannot be spoofed easily
  const cfRay = req.headers['cf-ray'];

  if (!cfRay) {
    console.warn(`SECURITY: Blocked direct access from ${clientIP} (missing CF-Ray header)`);
    console.warn(`  URL: ${req.method} ${req.originalUrl}`);
    console.warn(`  User-Agent: ${req.headers['user-agent']}`);

    return res.status(403).json({
      error: 'Direct access not allowed',
      message: 'This service must be accessed through the official domain.',
      documentation: 'https://github.com/sosialistaflokkurinn/ekklesia'
    });
  }

  // Optional: Additional validation - check if IP is from Cloudflare range
  // This provides defense-in-depth (CF-Ray header + IP validation)
  const requestIP = req.connection.remoteAddress || req.socket.remoteAddress;
  if (requestIP && !isCloudflareIP(requestIP)) {
    console.warn(`SECURITY: CF-Ray present but IP ${requestIP} not in Cloudflare ranges`);
    console.warn(`  This may indicate CF-Ray header spoofing attempt`);

    return res.status(403).json({
      error: 'Invalid request origin',
      message: 'Request does not originate from authorized CDN.'
    });
  }

  // Request validated - came through Cloudflare
  console.log(`INFO: Cloudflare request validated from ${clientIP} (CF-Ray: ${cfRay})`);
  next();
}

module.exports = {
  cloudflareOnly,
  isCloudflareIP  // Export for testing
};
