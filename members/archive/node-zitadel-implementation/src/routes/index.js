/**
 * Index route - Landing page
 */
export default async function indexRoutes(fastify) {

  // Landing page
  fastify.get('/', async (request, reply) => {
    const isAuthenticated = request.session?.authenticated || false;
    const userName = request.session?.user?.name;
    const error = request.query.error;

    let errorMessage = '';
    if (error === 'authentication_failed') {
      errorMessage = '<div class="error">Innskráning mistókst. Vinsamlegast reyndu aftur.</div>';
    } else if (error === 'access_denied') {
      errorMessage = '<div class="error">Innskráning var hætt við.</div>';
    } else if (error === 'session_expired') {
      errorMessage = '<div class="error">Seta rann út. Vinsamlegast skráðu þig inn aftur.</div>';
    }

    return reply.type('text/html').send(`
<!DOCTYPE html>
<html lang="is">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Samstaða - Félagasvæði</title>
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
      max-width: 500px;
      width: 100%;
      padding: 48px;
      text-align: center;
    }
    .logo {
      font-size: 64px;
      margin-bottom: 24px;
    }
    h1 {
      color: #2d3748;
      margin-bottom: 12px;
      font-size: 36px;
    }
    .subtitle {
      color: #718096;
      margin-bottom: 32px;
      font-size: 18px;
    }
    .welcome-message {
      background: #e6fffa;
      border-left: 4px solid #38b2ac;
      padding: 16px;
      margin-bottom: 24px;
      text-align: left;
      border-radius: 4px;
    }
    .welcome-message strong {
      color: #234e52;
    }
    .error {
      background: #fed7d7;
      border-left: 4px solid #f56565;
      color: #742a2a;
      padding: 16px;
      margin-bottom: 24px;
      text-align: left;
      border-radius: 4px;
    }
    .btn {
      display: inline-block;
      width: 100%;
      padding: 16px 32px;
      background: #667eea;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-size: 18px;
      font-weight: 600;
      transition: all 0.3s;
      border: none;
      cursor: pointer;
    }
    .btn:hover {
      background: #5568d3;
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
    }
    .btn-secondary {
      background: #48bb78;
      margin-bottom: 12px;
    }
    .btn-secondary:hover {
      background: #38a169;
      box-shadow: 0 10px 20px rgba(72, 187, 120, 0.4);
    }
    .features {
      margin-top: 32px;
      text-align: left;
      color: #4a5568;
    }
    .features h3 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 16px;
      color: #718096;
    }
    .feature {
      padding: 12px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .feature:last-child { border-bottom: none; }
    .feature-icon {
      margin-right: 8px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
      color: #a0aec0;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🏛️</div>
    <h1>Samstaða</h1>
    <p class="subtitle">Félagasvæði</p>

    ${errorMessage}

    ${isAuthenticated ? `
      <div class="welcome-message">
        Velkomin/n, <strong>${userName}</strong>!
      </div>
      <a href="/profile" class="btn btn-secondary">📋 Mínar upplýsingar</a>
      <a href="/logout" class="btn">Útskrá</a>
    ` : `
      <a href="/login" class="btn">🔐 Innskrá með Kenni.is</a>
    `}

    <div class="features">
      <h3>Eiginleikar</h3>
      <div class="feature">
        <span class="feature-icon">🔒</span>
        Viðurkennd Rafræn skilríki
      </div>
      <div class="feature">
        <span class="feature-icon">👤</span>
        Persónulegt félagasvæði
      </div>
      <div class="feature">
        <span class="feature-icon">🗳️</span>
        Atkvæðagreiðslur (væntanlegt)
      </div>
      <div class="feature">
        <span class="feature-icon">📅</span>
        Viðburðir (væntanlegt)
      </div>
    </div>

    <div class="footer">
      Ekklesia Members v2.0.0 · Milestone 2
    </div>
  </div>
</body>
</html>
    `);
  });
}
