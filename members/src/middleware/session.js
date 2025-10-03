import fp from 'fastify-plugin';
import fastifySession from '@fastify/session';
import fastifyCookie from '@fastify/cookie';
import config from '../config.js';

/**
 * Session middleware plugin for Fastify
 * Sets up secure session management with cookies
 * Uses fastify-plugin to avoid encapsulation
 */
async function sessionMiddleware(fastify) {
  // Register cookie plugin (required for session and signed cookies)
  await fastify.register(fastifyCookie, {
    secret: config.session.secret  // Same secret for signed cookies
  });

  // Register session plugin
  await fastify.register(fastifySession, {
    secret: config.session.secret,
    cookieName: config.session.cookieName,
    cookie: {
      httpOnly: true,                    // Prevent XSS attacks
      secure: config.app.env === 'production',  // HTTPS only in production
      sameSite: 'none',                  // Required for cross-site OAuth redirects
      maxAge: config.session.maxAge,     // 24 hours
      path: '/'
    },
    saveUninitialized: true,             // Create session even if empty (required for OIDC flow)
    rolling: true                        // Reset expiry on activity
  });

  fastify.log.info('Session middleware registered');
}

export default fp(sessionMiddleware);
