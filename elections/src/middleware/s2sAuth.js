// Server-to-Server Authentication Middleware
// Validates API key for S2S endpoints (Events service only)

const crypto = require('crypto');

function authenticateS2S(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.S2S_API_KEY;

  // Generic error for all auth failures (prevents information leakage)
  const authError = {
    error: 'Unauthorized',
    message: 'Authentication required'
  };

  // Check if both keys exist
  if (!apiKey || !expectedKey) {
    console.warn('[S2S Auth] Missing API key', {
      hasApiKey: !!apiKey,
      hasExpectedKey: !!expectedKey,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    return res.status(401).json(authError);
  }

  // Convert to buffers for constant-time comparison
  const apiKeyBuffer = Buffer.from(apiKey);
  const expectedBuffer = Buffer.from(expectedKey);

  // Length check (fast path - still constant time for same lengths)
  if (apiKeyBuffer.length !== expectedBuffer.length) {
    console.warn('[S2S Auth] Invalid API key attempt (length mismatch)', {
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    return res.status(401).json(authError);
  }

  // Timing-safe comparison (prevents timing attacks)
  if (!crypto.timingSafeEqual(apiKeyBuffer, expectedBuffer)) {
    console.warn('[S2S Auth] Invalid API key attempt', {
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    return res.status(401).json(authError);
  }

  // API key valid, proceed
  next();
}

module.exports = authenticateS2S;
