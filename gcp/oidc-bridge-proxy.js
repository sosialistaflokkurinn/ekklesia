#!/usr/bin/env node

/**
 * OIDC Bridge Proxy for ZITADEL + Kenni.is Integration (Cloud Run Version)
 * Acts as a complete OIDC provider that re-signs tokens with consistent issuer
 * 
 * Environment Variables Required:
 * - PROXY_ISSUER: Public URL of this proxy (Cloud Run service URL)
 * - KENNI_CLIENT_ID: Kenni.is OAuth client ID
 * - KENNI_CLIENT_SECRET: Kenni.is OAuth client secret
 * - PORT: Server port (automatically set by Cloud Run)
 */

const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');
const { JWK, JWS } = require('node-jose');
const crypto = require('crypto');

const app = express();
app.use(express.json({ charset: 'utf-8' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8' }));

// Configuration from environment variables
const PROXY_ISSUER = process.env.PROXY_ISSUER;
const KENNI_CLIENT_ID = process.env.KENNI_CLIENT_ID;
const KENNI_CLIENT_SECRET = process.env.KENNI_CLIENT_SECRET;
const PORT = process.env.PORT || 8080;

// Kenni.is base URL
const KENNI_BASE = 'https://idp.kenni.is/sosi-kosningakerfi.is';

// Validate required environment variables
if (!PROXY_ISSUER || !KENNI_CLIENT_ID || !KENNI_CLIENT_SECRET) {
  console.error('❌ Missing required environment variables:');
  if (!PROXY_ISSUER) console.error('   - PROXY_ISSUER');
  if (!KENNI_CLIENT_ID) console.error('   - KENNI_CLIENT_ID');
  if (!KENNI_CLIENT_SECRET) console.error('   - KENNI_CLIENT_SECRET');
  process.exit(1);
}

// Signing keys
let signingKey;
let publicJWK;

async function initializeKeys() {
  console.log('🔑 Initializing OIDC signing keys...');
  try {
    const keystore = JWK.createKeyStore();
    signingKey = await keystore.generate('RSA', 2048, {
      alg: 'RS256',
      use: 'sig',
      kid: crypto.randomBytes(8).toString('hex')
    });
    publicJWK = signingKey.toJSON();
    console.log('✅ Signing keys generated successfully');
  } catch (error) {
    console.error('❌ Failed to generate keys:', error);
    process.exit(1);
  }
}

// Kenni.is JWKS client for token validation
const kenniClient = jwksRsa({
  jwksUri: `${KENNI_BASE}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5
});

// Logging middleware
app.use((req, res, next) => {
  console.log(`\n=== [${new Date().toISOString()}] ${req.method} ${req.path} ===`);
  console.log(`  User-Agent: ${req.headers['user-agent']?.substring(0, 50)}...`);
  console.log(`  Query params: ${Object.keys(req.query || {}).join(', ') || 'none'}`);
  res.setHeader('Content-Type', res.getHeader('Content-Type') || 'application/json; charset=utf-8');
  next();
});

// OIDC Discovery Document
app.get('/.well-known/openid-configuration', (req, res) => {
  console.log('📋 Serving OIDC discovery document');

  const config = {
    issuer: PROXY_ISSUER,
    authorization_endpoint: `${PROXY_ISSUER}/authorize`,
    token_endpoint: `${PROXY_ISSUER}/token`,
    userinfo_endpoint: `${PROXY_ISSUER}/userinfo`,
    jwks_uri: `${PROXY_ISSUER}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'profile', 'email', 'national_id', 'phone_number'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    claims_supported: ['sub', 'name', 'email', 'national_id', 'phone_number', 'given_name', 'family_name', 'iss', 'aud', 'exp', 'iat'],
    code_challenge_methods_supported: ['S256', 'plain']
  };

  res.json(config);
});

// JWKS Endpoint
app.get('/.well-known/jwks.json', (req, res) => {
  console.log('🔐 Serving JWKS public keys');

  if (!publicJWK) {
    return res.status(500).json({ error: 'Keys not initialized' });
  }

  res.json({
    keys: [publicJWK]
  });
});

// In-memory state storage (for production, use Redis or encrypted cookies)
const stateStore = new Map();

// Authorization Endpoint - Replace client credentials and forward
app.get('/authorize', (req, res) => {
  console.log('🚀 Authorization request received from ZITADEL');
  console.log(`  ZITADEL Client ID: ${req.query.client_id}`);
  console.log(`  ZITADEL Redirect URI: ${req.query.redirect_uri}`);
  console.log(`  Scope: ${req.query.scope}`);

  // Store ZITADEL's parameters to restore after Kenni.is callback
  const stateId = crypto.randomBytes(16).toString('hex');
  stateStore.set(stateId, {
    client_id: req.query.client_id, // Store for audience claim
    redirect_uri: req.query.redirect_uri,
    state: req.query.state,
    code_challenge: req.query.code_challenge,
    code_challenge_method: req.query.code_challenge_method,
    timestamp: Date.now()
  });

  // Clean up old states (older than 10 minutes)
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [key, value] of stateStore.entries()) {
    if (value.timestamp < tenMinutesAgo) {
      stateStore.delete(key);
    }
  }

  // Build authorization URL for Kenni.is with REAL credentials and PKCE
  const kenniParams = new URLSearchParams();
  kenniParams.set('client_id', KENNI_CLIENT_ID); // Use real Kenni.is client ID
  kenniParams.set('redirect_uri', `${PROXY_ISSUER}/callback`); // Callback to proxy
  kenniParams.set('response_type', 'code');
  kenniParams.set('scope', req.query.scope || 'openid profile email');
  kenniParams.set('state', stateId); // Use our state ID

  // IMPORTANT: Forward PKCE parameters to Kenni.is
  if (req.query.code_challenge) {
    kenniParams.set('code_challenge', req.query.code_challenge);
    kenniParams.set('code_challenge_method', req.query.code_challenge_method || 'S256');
    console.log(`  🔐 Forwarding PKCE: method=${req.query.code_challenge_method}`);
  }

  const kenniAuthUrl = `${KENNI_BASE}/oidc/auth?${kenniParams.toString()}`;
  console.log(`  ✅ Using Kenni.is client_id: ${KENNI_CLIENT_ID.substring(0, 20)}...`);
  console.log(`  🔄 Redirecting to Kenni.is`);

  res.redirect(kenniAuthUrl);
});

// Callback endpoint - Receive code from Kenni.is and forward to ZITADEL
app.get('/callback', (req, res) => {
  console.log('🔙 Callback received from Kenni.is');
  console.log(`  Code: ${req.query.code ? 'present' : 'missing'}`);
  console.log(`  State: ${req.query.state}`);

  const stateId = req.query.state;
  const zitadelParams = stateStore.get(stateId);

  if (!zitadelParams) {
    console.error('  ❌ Invalid or expired state');
    return res.status(400).send('Invalid or expired state parameter');
  }

  // Clean up used state
  stateStore.delete(stateId);

  // Redirect back to ZITADEL with the authorization code
  const callbackParams = new URLSearchParams();
  callbackParams.set('code', req.query.code);
  callbackParams.set('state', zitadelParams.state);

  const zitadelCallbackUrl = `${zitadelParams.redirect_uri}?${callbackParams.toString()}`;
  console.log(`  ✅ Forwarding to ZITADEL callback`);

  res.redirect(zitadelCallbackUrl);
});

// Token Endpoint - Exchange and re-sign tokens
app.post('/token', async (req, res) => {
  console.log('🎫 Token exchange request received');
  console.log(`  Grant type: ${req.body.grant_type}`);
  console.log(`  Client ID from ZITADEL: ${req.body.client_id}`);

  try {
    console.log('  📤 Forwarding token request to Kenni.is...');

    // ZITADEL doesn't send client_id when using public client flow
    // Use the configured client_id from the provider settings
    const zitadelClientId = req.body.client_id || 'zitadel-kenni-bridge';
    console.log(`  🎯 Will set audience to: ${zitadelClientId}`);

    // Prepare authentication
    const credentials = Buffer.from(`${KENNI_CLIENT_ID}:${KENNI_CLIENT_SECRET}`).toString('base64');

    // Build request body with correct redirect_uri for Kenni.is
    const requestBody = { ...req.body };
    delete requestBody.client_id;
    delete requestBody.client_secret;

    // IMPORTANT: redirect_uri must match what was used in /authorize
    // We used ${PROXY_ISSUER}/callback during authorization
    if (requestBody.grant_type === 'authorization_code') {
      requestBody.redirect_uri = `${PROXY_ISSUER}/callback`;
      console.log(`  ✅ Using correct redirect_uri: ${requestBody.redirect_uri}`);
    }

    const kenniResponse = await axios.post(
      `${KENNI_BASE}/oidc/token`,
      new URLSearchParams(requestBody),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'Authorization': `Basic ${credentials}`
        },
        timeout: 10000
      }
    );

    console.log(`  📥 Kenni.is response: ${kenniResponse.status}`);
    const tokens = kenniResponse.data;

    if (!tokens.id_token) {
      console.log('  ⚠️  No ID token in response');
      return res.json(tokens);
    }

    // Decode original token
    console.log('  🔍 Decoding original ID token...');
    const originalClaims = jwt.decode(tokens.id_token);
    console.log(`  Original issuer: ${originalClaims.iss}`);
    console.log(`  Subject: ${originalClaims.sub}`);

    // Split name for ZITADEL compatibility
    let given_name, family_name;
    if (originalClaims.name) {
      const nameParts = originalClaims.name.trim().split(' ');
      if (nameParts.length >= 2) {
        given_name = nameParts.slice(0, -1).join(' ');
        family_name = nameParts[nameParts.length - 1];
      } else {
        given_name = originalClaims.name;
        family_name = '';
      }
      console.log(`  📝 Split name: "${originalClaims.name}" → "${given_name}" + "${family_name}"`);
    }

    // Create new claims with our issuer and ZITADEL's expected audience
    const newClaims = {
      ...originalClaims,
      iss: PROXY_ISSUER,
      aud: zitadelClientId, // IMPORTANT: Set audience to ZITADEL's client_id
      original_iss: originalClaims.iss,
      original_aud: originalClaims.aud,
      iat: Math.floor(Date.now() / 1000),
      exp: originalClaims.exp || Math.floor(Date.now() / 1000) + 3600,
      ...(given_name && { given_name }),
      ...(family_name && { family_name })
    };

    console.log(`  🎯 Setting audience: ${zitadelClientId}`);

    // Re-sign token
    console.log('  ✍️  Re-signing token...');
    const newIdToken = await JWS.createSign({
      format: 'compact',
      fields: { typ: 'JWT', alg: 'RS256', kid: signingKey.kid }
    }, signingKey)
    .update(JSON.stringify(newClaims))
    .final();

    console.log(`  ✅ Token re-signed successfully with issuer: ${PROXY_ISSUER}`);

    res.json({
      ...tokens,
      id_token: newIdToken
    });

  } catch (error) {
    console.error('❌ Token exchange error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'token_exchange_failed',
      error_description: error.message
    });
  }
});

// Userinfo Endpoint
app.get('/userinfo', async (req, res) => {
  console.log('👤 Userinfo request received');

  try {
    const response = await axios.get(
      `${KENNI_BASE}/oidc/me`,
      {
        headers: {
          'Authorization': req.headers.authorization
        },
        timeout: 5000
      }
    );

    console.log('  ✅ Userinfo retrieved');

    // Enhance with split name fields
    const userinfo = { ...response.data };
    if (userinfo.name && !userinfo.given_name && !userinfo.family_name) {
      const nameParts = userinfo.name.trim().split(' ');
      if (nameParts.length >= 2) {
        userinfo.given_name = nameParts.slice(0, -1).join(' ');
        userinfo.family_name = nameParts[nameParts.length - 1];
      }
    }

    res.json(userinfo);

  } catch (error) {
    console.error('❌ Userinfo error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'userinfo_failed',
      error_description: error.message
    });
  }
});

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    issuer: PROXY_ISSUER,
    timestamp: new Date().toISOString(),
    keys_initialized: !!signingKey
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'OIDC Bridge Proxy',
    status: 'running',
    issuer: PROXY_ISSUER,
    discovery: `${PROXY_ISSUER}/.well-known/openid-configuration`
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    error: 'internal_server_error',
    error_description: 'An unexpected error occurred'
  });
});

// Start server
async function start() {
  try {
    await initializeKeys();

    app.listen(PORT, () => {
      console.log(`\n🚀 OIDC Bridge Proxy running on port ${PORT}`);
      console.log(`📍 Issuer: ${PROXY_ISSUER}`);
      console.log(`🔗 Discovery: ${PROXY_ISSUER}/.well-known/openid-configuration`);
      console.log(`🔑 JWKS: ${PROXY_ISSUER}/.well-known/jwks.json`);
      console.log(`\n✅ Ready to handle ZITADEL + Kenni.is authentication!`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

start();
