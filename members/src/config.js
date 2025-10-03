// Configuration for Members service
export default {
  zitadel: {
    issuer: process.env.ZITADEL_ISSUER || 'https://zitadel-ymzrguoifa-nw.a.run.app',
    clientId: process.env.ZITADEL_CLIENT_ID || '338586423189856794',
    redirectUri: process.env.ZITADEL_REDIRECT_URI || 'http://localhost:3000/callback',
    scopes: ['openid', 'profile', 'email']
  },

  session: {
    secret: process.env.SESSION_SECRET || 'dev-secret-min-32-chars-long-12345',
    cookieName: process.env.SESSION_COOKIE_NAME || 'members_session',
    maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000') // 24 hours
  },

  app: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info'
  }
};
