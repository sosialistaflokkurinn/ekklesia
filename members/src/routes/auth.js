import { getOIDCClient } from '../oidc.js';
import { generateCodeVerifier, generateCodeChallenge, generateState, generateNonce } from '../lib/pkce.js';
import config from '../config.js';

/**
 * Authentication routes plugin
 * Handles login, callback, and logout
 */
export default async function authRoutes(fastify) {

  // Login route - initiate OIDC authentication flow
  fastify.get('/login', async (request, reply) => {
    // Already authenticated?
    if (request.session?.authenticated) {
      return reply.redirect('/profile');
    }

    try {
      const client = await getOIDCClient();

      // Generate PKCE parameters
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);
      const state = generateState();
      const nonce = generateNonce();

      // Ensure session exists before setting properties
      if (!request.session) {
        fastify.log.error('Session is undefined in /login route');
        return reply.code(500).send({
          error: 'Session error',
          message: 'Session could not be initialized'
        });
      }

      // Store OIDC data in encrypted cookie (survives Cloud Run instance changes)
      const oidcData = {
        codeVerifier,
        state,
        nonce,
        returnTo: request.query.returnTo || '/profile'
      };

      // Store in session (may not persist across Cloud Run instances)
      request.session.oidc = oidcData;

      // Also store in a signed cookie as backup
      reply.setCookie('oidc_state', JSON.stringify(oidcData), {
        httpOnly: true,
        secure: config.app.env === 'production',
        sameSite: 'none',
        path: '/',
        maxAge: 600, // 10 minutes
        signed: true
      });

      fastify.log.info({ state, sessionId: request.session.sessionId }, 'Stored OIDC state in session and cookie');

      // Build authorization URL
      const authUrl = client.authorizationUrl({
        scope: config.zitadel.scopes.join(' '),
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
        nonce
      });

      fastify.log.info('Redirecting to ZITADEL for authentication');
      return reply.redirect(authUrl);

    } catch (error) {
      fastify.log.error({ err: error }, 'Login error');
      return reply.code(500).send({
        error: 'Login failed',
        message: 'Failed to initiate login. Please try again.'
      });
    }
  });

  // Callback route - handle OIDC callback from ZITADEL
  fastify.get('/callback', async (request, reply) => {
    try {
      const client = await getOIDCClient();

      // Handle errors from ZITADEL
      if (request.query.error) {
        fastify.log.error('OIDC error:', request.query);
        return reply.redirect(`/?error=${request.query.error}`);
      }

      // Retrieve OIDC data from session or signed cookie
      let oidcData = request.session.oidc;

      // Fallback to signed cookie if session doesn't have it
      if (!oidcData) {
        const cookieValue = request.unsignCookie(request.cookies.oidc_state || '');
        if (cookieValue.valid && cookieValue.value) {
          try {
            oidcData = JSON.parse(cookieValue.value);
            fastify.log.info('Restored OIDC state from signed cookie');
          } catch (err) {
            fastify.log.error({ err }, 'Failed to parse OIDC cookie');
          }
        }
      }

      // Verify state (CSRF protection)
      const receivedState = request.query.state;
      const storedState = oidcData?.state;
      const sessionId = request.session.sessionId;

      fastify.log.info({
        receivedState,
        storedState,
        sessionId,
        hasSession: !!request.session,
        hasOidc: !!request.session.oidc,
        hasCookie: !!oidcData,
        sessionKeys: request.session ? Object.keys(request.session) : []
      }, 'Callback state verification');

      if (receivedState !== storedState) {
        fastify.log.error({ receivedState, storedState, sessionId }, 'State mismatch - CSRF attack detected');
        request.session.destroy();
        reply.clearCookie('oidc_state');
        return reply.code(400).send({
          error: 'Security error',
          message: 'Invalid request state'
        });
      }

      // Clear the OIDC cookie after successful verification
      reply.clearCookie('oidc_state');

      // Exchange authorization code for tokens
      const tokenSet = await client.callback(
        config.zitadel.redirectUri,
        request.query,
        {
          code_verifier: oidcData.codeVerifier,
          state: oidcData.state,
          nonce: oidcData.nonce
        }
      );

      // Extract and validate claims from ID token
      const claims = tokenSet.claims();
      fastify.log.info('User authenticated:', { sub: claims.sub, email: claims.email });

      // Store user data and tokens in session
      request.session.user = {
        sub: claims.sub,
        name: claims.name,
        given_name: claims.given_name,
        family_name: claims.family_name,
        email: claims.email,
        email_verified: claims.email_verified,
        phone_number: claims.phone_number,
        updated_at: claims.updated_at
      };

      request.session.tokens = {
        access_token: tokenSet.access_token,
        id_token: tokenSet.id_token,
        expires_at: Date.now() + (tokenSet.expires_in * 1000)
      };

      request.session.authenticated = true;
      request.session.loginTimestamp = Date.now();

      // Get return URL and clear temporary OIDC data
      const returnTo = oidcData.returnTo;
      delete request.session.oidc;

      // Save session before redirecting
      await new Promise((resolve, reject) => {
        request.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      fastify.log.info({ sessionId: request.session.sessionId }, 'Session saved, redirecting to profile');

      // Redirect to return URL
      return reply.redirect(returnTo);

    } catch (error) {
      fastify.log.error('Callback error:', error);
      return reply.redirect('/?error=authentication_failed');
    }
  });

  // Logout route - destroy session and optionally logout from ZITADEL
  fastify.get('/logout', async (request, reply) => {
    const idToken = request.session.tokens?.id_token;

    // Destroy local session
    request.session.destroy((err) => {
      if (err) {
        fastify.log.error('Session destroy error:', err);
      }
    });

    // Optional: ZITADEL logout (RP-Initiated Logout)
    if (idToken && config.app.env === 'production') {
      try {
        const client = await getOIDCClient();
        const logoutUrl = client.endSessionUrl({
          id_token_hint: idToken,
          post_logout_redirect_uri: config.zitadel.redirectUri.replace('/callback', '/')
        });
        return reply.redirect(logoutUrl);
      } catch (error) {
        fastify.log.error('ZITADEL logout error:', error);
      }
    }

    // Simple logout - redirect to home
    return reply.redirect('/');
  });
}
