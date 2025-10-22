# Admin Alerts (Cloud Logging)

**Last Updated:** 2025-10-20  
**Status:** ✅ Current

Goal: Alert when a destructive reset (scope=all) is executed.

## Log pattern
The admin reset route emits structured logs with messages like:
- `Admin reset - FULL RESET executed`
- `Admin reset completed`

## Create log-based alert (Console)
1. Go to Cloud Logging → Logs Explorer
2. Query filter:
```
resource.type="cloud_run_revision"
jsonPayload.message="Admin reset - FULL RESET executed"
```
3. Click “Create alert”
4. Notification channel: Email (or Slack via webhook)
5. Name: “ALERT: Full election reset executed”

## Notes
- Consider adding a second alert for `Blocked full reset in production (guardrail)` to notify attempted operations.
- For Slack, set up a webhook and hook a Cloud Function or use native alert channel.

## Create alert via CLI (gcloud)

Prerequisites:
- Notification channel ID (email or Slack) in Cloud Monitoring
- Or create one using the steps below

Discover or create notification channels:

List channels:
```bash
gcloud monitoring channels list --format="table(name, displayName, type)"
```

Create an email channel:
```bash
gcloud monitoring channels create \
	--display-name="Admin Email" \
	--type=email \
	--channel-labels=email_address=your-email@example.com
```

Example: Create policy for full reset executed (inline MQL)

```bash
gcloud monitoring policies create \
	--display-name="ALERT: Full election reset executed" \
	--conditions="displayName=Full reset log match,conditionMonitoringQueryLanguage=fetch cloud_run_revision | filter jsonPayload.message=\"Admin reset - FULL RESET executed\" | group_by [], [value:count()] | every 1m, duration=0s, comparison=COMPARISON_GT, thresholdValue=0" \
	--notification-channels="projects/$(gcloud config get-value project)/notificationChannels/YOUR_CHANNEL_ID"
```

Guardrail block attempt (optional):

```bash
gcloud monitoring policies create \
	--display-name="ALERT: Full reset blocked by guardrail" \
	--conditions="displayName=Guardrail block log match,conditionMonitoringQueryLanguage=fetch cloud_run_revision | filter jsonPayload.message=\"Blocked full reset in production (guardrail)\" | group_by [], [value:count()] | every 1m, duration=0s, comparison=COMPARISON_GT, thresholdValue=0" \
	--notification-channels="projects/$(gcloud config get-value project)/notificationChannels/YOUR_CHANNEL_ID"
```

Rate limit triggered (optional):

```bash
gcloud monitoring policies create \
	--display-name="NOTICE: Admin reset rate-limited" \
	--conditions="displayName=Rate-limit log match,conditionMonitoringQueryLanguage=fetch cloud_run_revision | filter jsonPayload.message=\"Admin reset rate-limited\" | group_by [], [value:count()] | every 5m, duration=0s, comparison=COMPARISON_GT, thresholdValue=0" \
	--notification-channels="projects/$(gcloud config get-value project)/notificationChannels/YOUR_CHANNEL_ID"
```

## YAML-based deployment (recommended):

1) Edit the YAML to replace PROJECT_ID and CHANNEL_ID:
	- docs/development/guides/alerts/full-reset-executed.yaml
	- docs/development/guides/alerts/full-reset-blocked.yaml
	- docs/development/guides/alerts/admin-rate-limited.yaml

2) Apply with gcloud:

```bash
gcloud monitoring policies create --policy-from-file=docs/development/guides/alerts/full-reset-executed.yaml
gcloud monitoring policies create --policy-from-file=docs/development/guides/alerts/full-reset-blocked.yaml
gcloud monitoring policies create --policy-from-file=docs/development/guides/alerts/admin-rate-limited.yaml
```
