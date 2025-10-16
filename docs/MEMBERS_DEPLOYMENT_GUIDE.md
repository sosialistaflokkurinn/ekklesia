# Members Service Deployment Guide

This guide documents the deployment configuration, environment variables, and troubleshooting tips for the Members Cloud Functions.

## Environment Variables

### JWKS_CACHE_TTL_SECONDS
- Purpose: Time-to-live (in seconds) for cached JWKS clients (security key rotation hygiene)
- Default: `3600` (1 hour)
- Recommended:
  - Production: `3600` (1 hour)
  - Staging: `1800` (30 minutes)
  - Development: `300` (5 minutes)
- Deployment example:

```bash
# Deploy with explicit TTL (Cloud Functions Gen2)
gcloud functions deploy handleKenniAuth \
  --gen2 \
  --runtime=python311 \
  --region=europe-west2 \
  --entry-point=handleKenniAuth \
  --trigger-http \
  --allow-unauthenticated \
  --source=members/functions \
  --timeout=60s \
  --memory=512MB \
  --set-env-vars JWKS_CACHE_TTL_SECONDS=3600
```

### Future variables (planned)
- RATE_LIMIT_MAX_ATTEMPTS
- RATE_LIMIT_WINDOW_MINUTES
- CORS_ALLOWED_ORIGINS (see Issue #50)

## Observability

- Structured logs are emitted as JSON with correlation IDs when available:
  - Correlation header support: `X-Correlation-ID`, `X-Request-ID`; a UUID is generated if missing
  - Sensitive fields (tokens/secrets) are masked
- Example log messages to look for:
  - `Exchanging authorization code for tokens`
  - `JWKS cache expired, refreshing`

## Troubleshooting

- 502: `Token exchange failed`
  - Usually indicates upstream token exchange error (invalid code or Kenni.is issue). Check logs for correlationId.
- 429: `Too many authentication attempts`
  - Rate limiting exceeded for the client IP; retry after recommended window.
- Invalid JSON / 400 responses
  - Ensure `Content-Type: application/json` and required fields are present.

## Notes
- Rate limiting uses time-bucketed transactional counters; old bucket documents naturally age out without manual cleanup.
- JWKS cache TTL is configurable via env var for each environment.
