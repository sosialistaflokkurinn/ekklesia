// Load environment variables from .env file (development only)
import 'dotenv/config';

import Fastify from 'fastify';
import config from './config.js';
import sessionMiddleware from './middleware/session.js';
import indexRoutes from './routes/index.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import healthRoutes from './routes/health.js';

const fastify = Fastify({
  logger: {
    level: config.app.logLevel
  }
});

// Register session middleware (includes cookies)
await fastify.register(sessionMiddleware);

// Security headers
fastify.addHook('onRequest', async (request, reply) => {
  reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('X-XSS-Protection', '1; mode=block');
});

// Register routes
await fastify.register(indexRoutes);
await fastify.register(authRoutes);
await fastify.register(profileRoutes);
await fastify.register(healthRoutes);

// Graceful shutdown
const closeListeners = ['SIGINT', 'SIGTERM'];
closeListeners.forEach((signal) => {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, closing server gracefully`);
    await fastify.close();
    process.exit(0);
  });
});

// Start server
const start = async () => {
  try {
    await fastify.listen({
      port: config.app.port,
      host: config.app.host
    });
    fastify.log.info(`🚀 Server listening on ${config.app.host}:${config.app.port}`);
    fastify.log.info(`📋 Environment: ${config.app.env}`);
    fastify.log.info(`🔐 OIDC configured for: ${config.zitadel.issuer}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
