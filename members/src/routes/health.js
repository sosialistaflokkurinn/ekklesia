/**
 * Health check routes
 */
export default async function healthRoutes(fastify) {

  // Health check endpoint for Cloud Run
  fastify.get('/healthz', async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      service: 'ekklesia-members',
      features: {
        oidc: 'enabled',
        authentication: 'kenni.is'
      }
    };
  });

  // Legacy health endpoint (backward compatibility)
  fastify.get('/health', async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      service: 'ekklesia-members'
    };
  });
}
