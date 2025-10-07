/**
 * Authentication middleware
 * Protects routes by requiring valid authentication
 */
export async function requireAuth(request, reply) {
  // Check if user is authenticated
  if (!request.session?.authenticated) {
    const returnTo = encodeURIComponent(request.url);
    return reply.redirect(`/login?returnTo=${returnTo}`);
  }

  // Check if access token has expired
  const tokens = request.session.tokens;
  if (tokens?.expires_at && tokens.expires_at < Date.now()) {
    request.log.warn('Access token expired, destroying session');
    request.session.destroy();
    const returnTo = encodeURIComponent(request.url);
    return reply.redirect(`/login?error=session_expired&returnTo=${returnTo}`);
  }

  // Authentication valid, continue
}
