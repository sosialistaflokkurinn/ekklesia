import Fastify from 'fastify';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info'
  }
});

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'ekklesia-members'
  };
});

// Root endpoint
fastify.get('/', async (request, reply) => {
  return {
    message: 'Ekklesia Members Service',
    version: '1.0.0',
    endpoints: {
      health: '/health'
    }
  };
});

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
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    fastify.log.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
