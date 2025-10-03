import { Issuer } from 'openid-client';
import config from './config.js';

let client = null;

/**
 * Get or create the OIDC client
 * Discovers ZITADEL configuration and creates a client instance
 * @returns {Promise<Client>} OpenID Connect client
 */
export async function getOIDCClient() {
  if (client) return client;

  try {
    // Discover ZITADEL configuration from .well-known/openid-configuration
    const issuer = await Issuer.discover(config.zitadel.issuer);

    // Create client for public application (PKCE flow)
    client = new issuer.Client({
      client_id: config.zitadel.clientId,
      redirect_uris: [config.zitadel.redirectUri],
      response_types: ['code'],
      token_endpoint_auth_method: 'none'  // Public client uses PKCE instead
    });

    return client;
  } catch (error) {
    console.error('Failed to initialize OIDC client:', error);
    throw new Error('OIDC client initialization failed');
  }
}
