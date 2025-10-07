import { requireAuth } from '../middleware/auth.js';

/**
 * Profile routes plugin
 * Protected routes requiring authentication
 */
export default async function profileRoutes(fastify) {

  // Profile page - protected route
  fastify.get('/profile', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.session.user;

    // Format date
    const lastUpdated = user.updated_at
      ? new Date(user.updated_at * 1000).toLocaleDateString('is-IS')
      : 'N/A';

    return reply.type('text/html').send(`
<!DOCTYPE html>
<html lang="is">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mitt svæði - Samstaða</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 600px;
      width: 100%;
      padding: 40px;
    }
    h1 {
      color: #2d3748;
      margin-bottom: 10px;
      font-size: 32px;
    }
    .subtitle {
      color: #718096;
      margin-bottom: 30px;
    }
    .profile-info {
      background: #f7fafc;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .info-row {
      display: flex;
      padding: 12px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label {
      font-weight: 600;
      color: #4a5568;
      width: 140px;
      flex-shrink: 0;
    }
    .info-value {
      color: #2d3748;
      flex-grow: 1;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
    }
    .badge-success {
      background: #c6f6d5;
      color: #22543d;
    }
    .badge-verified {
      background: #bee3f8;
      color: #2c5282;
    }
    .actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
    }
    .btn {
      flex: 1;
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      text-align: center;
      transition: all 0.2s;
    }
    .btn-primary {
      background: #667eea;
      color: white;
    }
    .btn-primary:hover {
      background: #5568d3;
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: #e2e8f0;
      color: #2d3748;
    }
    .btn-secondary:hover {
      background: #cbd5e0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Mitt svæði</h1>
    <p class="subtitle">Upplýsingar um félagsaðild</p>

    <div class="profile-info">
      <div class="info-row">
        <span class="info-label">Nafn:</span>
        <span class="info-value">${user.name || 'N/A'}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Netfang:</span>
        <span class="info-value">
          ${user.email || 'N/A'}
          ${user.email_verified ? '<span class="badge badge-verified">✓ Staðfest</span>' : ''}
        </span>
      </div>

      ${user.phone_number ? `
      <div class="info-row">
        <span class="info-label">Símanúmer:</span>
        <span class="info-value">${user.phone_number}</span>
      </div>
      ` : ''}

      <div class="info-row">
        <span class="info-label">Staða:</span>
        <span class="info-value">
          <span class="badge badge-success">✓ Virk félagsaðild</span>
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">Síðast uppfært:</span>
        <span class="info-value">${lastUpdated}</span>
      </div>
    </div>

    <div class="actions">
      <a href="/" class="btn btn-secondary">← Heim</a>
      <a href="/logout" class="btn btn-primary">Útskrá</a>
    </div>
  </div>
</body>
</html>
    `);
  });
}
