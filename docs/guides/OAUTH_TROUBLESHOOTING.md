# OAuth Troubleshooting Guide

**Last Updated:** 2025-10-20  
**Status:** ✅ Current

This guide helps you diagnose and fix OAuth login issues with Kenni.is quickly using correlation IDs and the health check endpoint.

## What you need
- Deployed Members functions (Gen 2) with:
  - `handleKenniAuth` (Cloud Run URL e.g., https://handlekenniauth-...a.run.app)
  - `healthz` (Cloud Run URL e.g., https://healthz-...a.run.app)
- Frontend with enhanced error handling (shows correlationId on errors)

## Quick checklist
- Frontend redirect URI equals IdP and backend env (no trailing slash)
  - Example: https://ekklesia-prod-10-2025.web.app
- Required env vars present on backend:
  - KENNI_IS_ISSUER_URL
  - KENNI_IS_CLIENT_ID
  - KENNI_IS_CLIENT_SECRET (Secret Manager)
  - KENNI_IS_REDIRECT_URI
  - FIREBASE_STORAGE_BUCKET

## Pre-deploy checklist for secrets and envs

Before deploying any Cloud Function or Cloud Run service that handles authentication or sensitive flows:

- [ ] All required secrets exist in Secret Manager and have an enabled version
- [ ] All required secrets are bound to the service as environment variables (not just present in Secret Manager)
- [ ] All required environment variables are set and non-empty
- [ ] Redirect URI matches exactly across frontend, backend, and IdP config
- [ ] No secrets, API keys, or PII in code, docs, or public repo
- [ ] Run:
  ```bash
  gcloud run services describe <service> --region=<region> --project=<project> --format=json | jq -r '.spec.template.spec.containers[0].env // [] | map({(.name): (.value // ("<secret:" + .valueFrom.secretKeyRef.name + ":" + .valueFrom.secretKeyRef.key + ">"))}) | add'
  ```
  and confirm all required keys are present and correct.

If any item fails, STOP and fix before deploying to production.

## 1) Verify config via healthz
Use the health endpoint to verify configuration before testing OAuth.

Optional:
- Replace URLs and project IDs with your own.

```bash
# Basic health check
curl -s https://handlekenniauth-<hash>-<region>.a.run.app/healthz | jq

# Expected fields
# {
#   "ok": true,
#   "env": {
#     "KENNI_IS_ISSUER_URL": true,
#     "KENNI_IS_CLIENT_ID": true,
#     "KENNI_IS_CLIENT_SECRET": true,
#     "KENNI_IS_REDIRECT_URI": true,
#     "FIREBASE_STORAGE_BUCKET": true
#   },
#   "jwks": { ... },
#   "issuerConfigured": true,
#   "correlationId": "..."
# }
```

If any env value is false, fix deployment config before proceeding.

### If healthz is not available or shows missing Kenni.is config
If the deployed code doesn’t include `/healthz` yet, or logs show "Missing Kenni.is configuration in environment variables", verify and fix the Cloud Run service environment directly.

Check the effective env vars on the latest revision:

```bash
gcloud run services describe handlekenniauth \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025 \
  --format=json | jq -r '.spec.template.spec.containers[0].env // [] | map({(.name): (.value // ("<secret:" + .valueFrom.secretKeyRef.name + ":" + .valueFrom.secretKeyRef.key + ">"))}) | add'
```

Expected env keys (all must be present):
- KENNI_IS_ISSUER_URL
- KENNI_IS_CLIENT_ID
- KENNI_IS_CLIENT_SECRET (wired from Secret Manager)
- KENNI_IS_REDIRECT_URI

If any is missing/null, update the service and bind the secret:

```bash
gcloud secrets versions list kenni-client-secret \
  --project=ekklesia-prod-10-2025 --format='value(name)'

gcloud run services update handlekenniauth \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025 \
  --update-env-vars \
    KENNI_IS_ISSUER_URL=https://idp.kenni.is/sosi-kosningakerfi.is,\
    KENNI_IS_CLIENT_ID=@sosi-kosningakerfi.is/rafr-nt-kosningakerfi-s-s,\
    KENNI_IS_REDIRECT_URI=https://ekklesia-prod-10-2025.web.app \
  --update-secrets \
    KENNI_IS_CLIENT_SECRET=kenni-client-secret:latest
```

Re-test the login and, if it still fails, proceed to step 2 to capture the correlation ID and inspect logs.

## 2) Reproduce and capture correlation ID
- Open the Members site in your browser and start login.
- If login fails, copy the `cid` from the error message shown in the console.
  - Example: `handleKenniAuth failed: 500 INTERNAL (cid: abc123...) - Token exchange failed`

## 3) Find the exact error in logs
Use the correlation ID to find the backend log for this request.

```bash
gcloud logging read "resource.type=cloud_run_revision \
  AND resource.labels.service_name=handlekenniauth \
  AND jsonPayload.correlationId=<YOUR_CID>" \
  --limit=10 \
  --project=<YOUR_PROJECT_ID> \
  --format=json | jq '.[].jsonPayload'
```

Common findings:
- invalid_grant: Redirect URI mismatch (fix the registered URI at Kenni.is). Ensure no trailing slash.
- invalid_client: Client credentials wrong (check Secret Manager binding and client ID).
- invalid_request: Missing/incorrect parameters (verify PKCE and body fields).

## 4) Typical root causes and fixes
- Redirect URI mismatch
  - Symptom: `invalid_grant`, description mentions redirect_uri
  - Fix: Ensure frontend uses configured `config_kenni_redirect_uri` and IdP has the exact same value (no trailing slash).
- Missing KENNI_IS_CLIENT_SECRET
  - Symptom: `CONFIG_MISSING` in logs or 500 with config error
  - Fix: Set Secret Manager binding during deploy and re-deploy.
- PKCE verifier mismatch
  - Symptom: Token exchange fails; logs show IdP validation
  - Fix: Ensure the PKCE verifier is stored and sent from the same session; avoid tab refresh between steps.

## 5) Preflight/CORS issues
Ensure the backend exposes correlation headers and supports preflight:
- Access-Control-Expose-Headers: X-Correlation-ID
- Access-Control-Allow-Headers includes: Content-Type, Authorization, X-Firebase-AppCheck, X-Request-ID, X-Correlation-ID
- Access-Control-Allow-Methods includes: GET, POST, OPTIONS

## 6) Contact points
- Share the correlationId and error snippet with the on-call engineer for rapid triage.
- Keep a record of recurring error types to refine alerting.

---

Last updated: 2025-10-16
