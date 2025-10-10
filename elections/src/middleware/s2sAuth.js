// Server-to-Server Authentication Middleware
// Validates API key for S2S endpoints (Events service only)

function authenticateS2S(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing X-API-Key header'
    });
  }

  if (apiKey !== process.env.S2S_API_KEY) {
    console.warn('[S2S Auth] Invalid API key attempt');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
  }

  // API key valid, proceed
  next();
}

module.exports = authenticateS2S;
