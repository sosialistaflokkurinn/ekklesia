# Login Incident - 2025-10-16

Status: Resolved

## Summary
Production login via Kenni.is failed with 500 from handleKenniAuth. Root cause was missing Cloud Run environment configuration (KENNI_IS_CLIENT_SECRET not wired; other Kenni vars incomplete on the latest revision). Updated service envs and bound Secret Manager; new revision deployed; login now succeeds.

## Timeline (UTC)
- 20:23–21:05: Repeated 500s on POST /. Logs showed: "Unhandled error in handleKenniAuth" and "Missing Kenni.is configuration in environment variables".
- 21:10: Updated Cloud Run service env and secret binding; deployed revision handlekenniauth-00014-f62.
- 21:14: Observed POST 200 from browser; flow healthy.

## Impact
- Users could not complete login flow; OAuth callback failed at server token exchange.

## Root Cause
- Missing Kenni.is configuration on Cloud Run service: KENNI_IS_CLIENT_SECRET was null. Function requires:
  - KENNI_IS_ISSUER_URL
  - KENNI_IS_CLIENT_ID
  - KENNI_IS_CLIENT_SECRET (Secret Manager: kenni-client-secret)
  - KENNI_IS_REDIRECT_URI

## Detection
- Browser console: 500 (Internal Server Error) from handleKenniAuth.
- Cloud Logging entries:
  - message: "Unhandled error in handleKenniAuth"
  - error: "Missing Kenni.is configuration in environment variables"

## Remediation

1) Verified env and secret availability:
```bash
gcloud run services describe handlekenniauth \
  --region=europe-west2 --project=ekklesia-prod-10-2025 --format=json \
  | jq -r '.spec.template.spec.containers[0].env // [] | map({(.name): (.value // ("<secret:" + .valueFrom.secretKeyRef.name + ":" + .valueFrom.secretKeyRef.key + ">"))}) | add'

gcloud secrets versions list kenni-client-secret \
  --project=ekklesia-prod-10-2025 --format='value(name)'
```

2) Applied fix (set envs and bind secret):
```bash
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

## Verification

- Service ready and responding; sample successful POST 200:
```json
{
  "ts": "2025-10-16T21:14:31.134418Z",
  "latency": "1.616265272s",
  "req": "1966",
  "res": "1409",
  "trace": "projects/ekklesia-prod-10-2025/traces/b39c62e527b684ff000184f74a857015"
}
```

## Prevention / Follow-ups
- Add a pre-deploy checklist step to verify required envs/secrets for handleKenniAuth.
- Consider CI guard that queries service env and fails if any required Kenni vars are missing.
- Keep docs in `docs/development/guides/OAUTH_TROUBLESHOOTING.md` updated. Section for missing Kenni config added.

---
Owner: Platform
Project: ekklesia-prod-10-2025
Region: europe-west2
Service: handlekenniauth