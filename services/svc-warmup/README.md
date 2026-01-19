# svc-warmup

Cloud Function that keeps Cloud Run services warm to avoid cold starts.

## How it works

- Cloud Scheduler triggers this function every 5 minutes
- Function pings all configured endpoints
- Keeps instances warm, eliminating 30-60 second cold starts

## Endpoints

| Service | URL | Method |
|---------|-----|--------|
| xj-next | https://xj-next-521240388393.europe-west1.run.app/ | GET |
| xj-strapi | https://xj-strapi-521240388393.europe-west1.run.app/graphql | POST |
| django | https://starf.sosialistaflokkurinn.is/health/ | GET |

## Deploy

```bash
gcloud functions deploy warmup \
  --gen2 \
  --runtime=python312 \
  --region=europe-west1 \
  --source=. \
  --entry-point=warmup \
  --trigger-http \
  --allow-unauthenticated \
  --memory=128Mi \
  --timeout=60s \
  --project=ekklesia-prod-10-2025
```

## Test

```bash
curl https://europe-west1-ekklesia-prod-10-2025.cloudfunctions.net/warmup
```

Expected response:
```json
[
  {"url": "https://xj-next-...", "status": 200},
  {"url": "https://xj-strapi-...", "status": 200},
  {"url": "https://starf.../health/", "status": 200}
]
```

## Add new endpoint

Edit `main.py` and add to the `ENDPOINTS` list:

```python
{"url": "https://new-service.run.app/", "method": "GET"},
# or with POST body:
{"url": "https://api.example.com/graphql", "method": "POST", "body": '{"query":"{ __typename }"}'},
```

Then redeploy.
