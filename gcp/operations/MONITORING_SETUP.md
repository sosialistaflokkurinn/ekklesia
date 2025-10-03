# 📊 Monitoring Setup Guide

**Project:** Ekklesia Production Infrastructure
**GCP Project:** ekklesia-prod-10-2025
**Last Updated:** 2025-10-03

---

## 📚 Table of Contents

1. [Overview](#overview)
2. [Cloud Run Monitoring](#cloud-run-monitoring)
3. [Log Analysis](#log-analysis)
4. [Alerting Setup](#alerting-setup)
5. [Performance Metrics](#performance-metrics)
6. [Dashboard Setup](#dashboard-setup)
7. [Best Practices](#best-practices)

---

## 🎯 Overview

### Monitoring Stack

- **Platform:** Google Cloud Operations Suite (formerly Stackdriver)
- **Logs:** Cloud Logging
- **Metrics:** Cloud Monitoring
- **Traces:** Cloud Trace (optional)
- **Alerts:** Cloud Monitoring Alerts

### Services to Monitor

| Service | Priority | Key Metrics |
|---------|----------|-------------|
| **ZITADEL** | Critical | Uptime, latency, error rate, database connections |
| **OIDC Bridge** | Critical | Request rate, latency, token exchange errors |
| **Members** | High | Request rate, latency, error rate |
| **Cloud SQL** | Critical | CPU, memory, connections, replication lag |
| **Load Balancer** | High | Request count, latency, backend health |

---

## ☁️ Cloud Run Monitoring

### Access Cloud Run Metrics

**Console URLs:**

- **Members:** https://console.cloud.google.com/run/detail/europe-west2/members/metrics?project=ekklesia-prod-10-2025
- **OIDC Bridge:** https://console.cloud.google.com/run/detail/europe-west2/oidc-bridge-proxy/metrics?project=ekklesia-prod-10-2025
- **ZITADEL:** https://console.cloud.google.com/run/detail/europe-west2/zitadel/metrics?project=ekklesia-prod-10-2025

### Key Metrics to Monitor

#### Request Count

```bash
# Get request count for last hour
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_count" AND
    resource.labels.service_name="members"' \
  --format="table(points[].value.int64Value,points[].interval.endTime)"
```

#### Request Latency

```bash
# Get P50, P95, P99 latencies
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_latencies" AND
    resource.labels.service_name="members"' \
  --format="table(metric.labels.percentile,points[].value.distributionValue.mean)"
```

#### Container Instance Count

```bash
# Get current instance count
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/container/instance_count" AND
    resource.labels.service_name="members"' \
  --format="table(points[].value.int64Value,points[].interval.endTime)" \
  --order-by="~points[].interval.endTime" \
  --limit=1
```

#### Memory Utilization

```bash
# Get memory usage
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/container/memory/utilizations" AND
    resource.labels.service_name="members"' \
  --format="table(points[].value.distributionValue.mean,points[].interval.endTime)"
```

#### CPU Utilization

```bash
# Get CPU usage
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/container/cpu/utilizations" AND
    resource.labels.service_name="members"' \
  --format="table(points[].value.distributionValue.mean,points[].interval.endTime)"
```

---

## 📝 Log Analysis

### Viewing Logs

#### Console Access

**All Logs:** https://console.cloud.google.com/logs/query?project=ekklesia-prod-10-2025

#### CLI Access

**Members Service Logs:**

```bash
# Real-time logs
gcloud run services logs tail members --region=europe-west2

# Recent logs (last 50)
gcloud run services logs read members \
  --region=europe-west2 \
  --limit=50
```

**ZITADEL Logs:**

```bash
gcloud run services logs tail zitadel --region=europe-west2
```

**OIDC Bridge Logs:**

```bash
gcloud run services logs tail oidc-bridge-proxy --region=europe-west2
```

### Useful Log Queries

#### Filter by Severity

**Errors Only:**

```bash
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" \
  --limit=50 \
  --format="table(timestamp,resource.labels.service_name,severity,textPayload)"
```

**Warnings and Errors:**

```bash
gcloud logging read "resource.type=cloud_run_revision AND severity>=WARNING" \
  --limit=50
```

#### Filter by Service

**Members Service:**

```bash
gcloud logging read "resource.type=cloud_run_revision AND
  resource.labels.service_name='members'" \
  --limit=50 \
  --format="table(timestamp,severity,jsonPayload.message)"
```

**ZITADEL:**

```bash
gcloud logging read "resource.type=cloud_run_revision AND
  resource.labels.service_name='zitadel'" \
  --limit=50
```

#### Filter by Time Range

**Last 1 hour:**

```bash
gcloud logging read "resource.type=cloud_run_revision" \
  --freshness=1h \
  --limit=100
```

**Last 24 hours:**

```bash
gcloud logging read "resource.type=cloud_run_revision" \
  --freshness=1d \
  --limit=200
```

**Specific time range:**

```bash
gcloud logging read "resource.type=cloud_run_revision" \
  --format="table(timestamp,resource.labels.service_name,severity,textPayload)" \
  --start-time="2025-10-03T00:00:00Z" \
  --end-time="2025-10-03T23:59:59Z"
```

#### Search for Specific Errors

**Authentication Errors:**

```bash
gcloud logging read "resource.type=cloud_run_revision AND
  (textPayload=~'authentication' OR textPayload=~'unauthorized' OR severity>=ERROR)" \
  --limit=50
```

**Database Errors:**

```bash
gcloud logging read "resource.type=cloud_run_revision AND
  resource.labels.service_name='zitadel' AND
  (textPayload=~'database' OR textPayload=~'postgres' OR textPayload=~'connection')" \
  --limit=50
```

**Token Errors (OIDC Bridge):**

```bash
gcloud logging read "resource.type=cloud_run_revision AND
  resource.labels.service_name='oidc-bridge-proxy' AND
  (textPayload=~'token' OR textPayload=~'invalid')" \
  --limit=50
```

### Log Export

**Export to BigQuery (for analysis):**

```bash
# Create log sink to BigQuery
gcloud logging sinks create ekklesia-logs-bq \
  bigquery.googleapis.com/projects/ekklesia-prod-10-2025/datasets/logs \
  --log-filter="resource.type=cloud_run_revision"
```

**Export to Cloud Storage (for archival):**

```bash
# Create log sink to GCS
gcloud logging sinks create ekklesia-logs-archive \
  storage.googleapis.com/ekklesia-logs-archive \
  --log-filter="resource.type=cloud_run_revision AND severity>=WARNING"
```

---

## 🚨 Alerting Setup

### Critical Alerts

#### Service Down Alert

**Alert when any service returns 5xx errors > 5% of requests:**

```yaml
# alert-service-down.yaml
displayName: "Service Down - High Error Rate"
conditions:
  - displayName: "Error rate > 5%"
    conditionThreshold:
      filter: |
        resource.type = "cloud_run_revision"
        AND metric.type = "run.googleapis.com/request_count"
        AND metric.labels.response_code_class = "5xx"
      comparison: COMPARISON_GT
      thresholdValue: 5
      duration: 300s
      aggregations:
        - alignmentPeriod: 60s
          perSeriesAligner: ALIGN_RATE
notificationChannels:
  - projects/ekklesia-prod-10-2025/notificationChannels/[CHANNEL_ID]
alertStrategy:
  autoClose: 3600s
```

**Create alert:**

```bash
gcloud alpha monitoring policies create --policy-from-file=alert-service-down.yaml
```

#### High Latency Alert

**Alert when P95 latency > 2 seconds:**

```bash
gcloud alpha monitoring policies create \
  --notification-channels=[CHANNEL_ID] \
  --display-name="High Latency Alert" \
  --condition-display-name="P95 Latency > 2s" \
  --condition-threshold-value=2000 \
  --condition-threshold-duration=300s \
  --condition-filter='
    resource.type = "cloud_run_revision"
    AND metric.type = "run.googleapis.com/request_latencies"
    AND metric.labels.percentile = "95"'
```

#### Database Connection Alert

**Alert when Cloud SQL connections > 80%:**

```bash
gcloud alpha monitoring policies create \
  --notification-channels=[CHANNEL_ID] \
  --display-name="Database Connection Alert" \
  --condition-display-name="Connections > 80%" \
  --condition-threshold-value=0.8 \
  --condition-threshold-duration=300s \
  --condition-filter='
    resource.type = "cloudsql_database"
    AND metric.type = "cloudsql.googleapis.com/database/postgresql/num_backends"'
```

#### Memory Alert

**Alert when container memory usage > 90%:**

```bash
gcloud alpha monitoring policies create \
  --notification-channels=[CHANNEL_ID] \
  --display-name="High Memory Usage" \
  --condition-display-name="Memory > 90%" \
  --condition-threshold-value=0.9 \
  --condition-threshold-duration=300s \
  --condition-filter='
    resource.type = "cloud_run_revision"
    AND metric.type = "run.googleapis.com/container/memory/utilizations"'
```

### Notification Channels

#### Email Channel

```bash
# Create email notification channel
gcloud alpha monitoring channels create \
  --display-name="Ekklesia Ops Email" \
  --type=email \
  --channel-labels=email_address=gudrodur@sosialistaflokkurinn.is
```

#### Slack Channel (if configured)

```bash
# Create Slack notification channel
gcloud alpha monitoring channels create \
  --display-name="Ekklesia Slack" \
  --type=slack \
  --channel-labels=url=[SLACK_WEBHOOK_URL]
```

#### List Notification Channels

```bash
# List all channels
gcloud alpha monitoring channels list

# Get channel ID for use in alerts
gcloud alpha monitoring channels list \
  --format="table(name,displayName,type)"
```

---

## 📈 Performance Metrics

### Service-Level Indicators (SLIs)

#### Availability

**Target:** 99.5% uptime (minimum)

**Measurement:**

```bash
# Calculate availability over last 30 days
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_count" AND
    resource.labels.service_name="members"' \
  --format=json | jq '
    [.[] | .points[].value.int64Value | tonumber] |
    add as $total |
    [.[] | select(.metric.labels.response_code_class != "5xx") |
      .points[].value.int64Value | tonumber] |
    add as $success |
    ($success / $total * 100)
  '
```

#### Latency

**Target:** P95 < 500ms, P99 < 1000ms

**Measurement:**

```bash
# Get P95 and P99 latencies
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_latencies" AND
    resource.labels.service_name="members" AND
    (metric.labels.percentile="95" OR metric.labels.percentile="99")' \
  --format="table(metric.labels.percentile,points[].value.distributionValue.mean)"
```

#### Error Rate

**Target:** < 1% error rate

**Measurement:**

```bash
# Calculate error rate
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_count" AND
    resource.labels.service_name="members" AND
    metric.labels.response_code_class="5xx"' \
  --format=json
```

### Cloud SQL Metrics

#### Database Connection Count

```bash
gcloud monitoring time-series list \
  --filter='resource.type="cloudsql_database" AND
    metric.type="cloudsql.googleapis.com/database/postgresql/num_backends"' \
  --format="table(points[].value.int64Value,points[].interval.endTime)"
```

#### Database CPU Usage

```bash
gcloud monitoring time-series list \
  --filter='resource.type="cloudsql_database" AND
    metric.type="cloudsql.googleapis.com/database/cpu/utilization"' \
  --format="table(points[].value.doubleValue,points[].interval.endTime)"
```

#### Database Memory Usage

```bash
gcloud monitoring time-series list \
  --filter='resource.type="cloudsql_database" AND
    metric.type="cloudsql.googleapis.com/database/memory/utilization"' \
  --format="table(points[].value.doubleValue,points[].interval.endTime)"
```

---

## 📊 Dashboard Setup

### Create Custom Dashboard

**Console:** https://console.cloud.google.com/monitoring/dashboards?project=ekklesia-prod-10-2025

**Recommended Widgets:**

1. **Service Health Overview**
   - Request count (all services)
   - Error rate (all services)
   - P95 latency (all services)

2. **Members Service**
   - Request rate (line chart)
   - Error rate (line chart)
   - Instance count (stacked area)
   - Memory usage (line chart)

3. **ZITADEL**
   - Request rate
   - Authentication success rate
   - Database connection count
   - P99 latency

4. **OIDC Bridge**
   - Token exchange rate
   - Error rate
   - P95 latency

5. **Cloud SQL**
   - CPU utilization
   - Memory utilization
   - Connection count
   - Query latency

### Dashboard JSON (Example)

```json
{
  "displayName": "Ekklesia Production Dashboard",
  "mosaicLayout": {
    "columns": 12,
    "tiles": [
      {
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Members - Request Rate",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"members\" AND metric.type=\"run.googleapis.com/request_count\""
                  }
                }
              }
            ]
          }
        }
      }
    ]
  }
}
```

**Import dashboard:**

```bash
gcloud monitoring dashboards create --config-from-file=dashboard.json
```

---

## ✅ Best Practices

### 1. Log Retention

**Default:** 30 days in Cloud Logging

**Recommendation:** Export logs to Cloud Storage for longer retention

```bash
# Create storage bucket for log archive
gsutil mb -l europe-west2 gs://ekklesia-logs-archive

# Create log sink
gcloud logging sinks create ekklesia-archive \
  storage.googleapis.com/ekklesia-logs-archive \
  --log-filter="resource.type=cloud_run_revision"
```

### 2. Structured Logging

**Members service already uses Pino (structured JSON logs)**

**Example log entry:**

```json
{
  "level": 30,
  "time": 1759492785159,
  "pid": 28569,
  "hostname": "instance-1",
  "reqId": "req-1",
  "req": {
    "method": "GET",
    "url": "/health"
  },
  "msg": "request completed"
}
```

### 3. Correlation IDs

**Add request ID to all logs for tracing:**

```javascript
// Already implemented in Members service via Fastify
fastify.addHook('onRequest', (request, reply, done) => {
  request.log.info({ reqId: request.id }, 'incoming request');
  done();
});
```

### 4. Alert Fatigue Prevention

**Guidelines:**
- Only alert on actionable issues
- Set appropriate thresholds (avoid false positives)
- Use auto-close after issue resolved
- Group related alerts

### 5. Regular Review

**Weekly:**
- Review error logs
- Check SLI compliance
- Verify alert channels working

**Monthly:**
- Review and adjust alert thresholds
- Analyze trends
- Update dashboards

### 6. Cost Optimization

**Monitor logging costs:**

```bash
# Check log ingestion volume
gcloud logging metrics list --filter="logMetric.filter:*"

# Estimate costs (pricing: $0.50/GiB ingested)
gcloud logging read "resource.type=cloud_run_revision" \
  --freshness=30d \
  --format=json | wc -c
```

**Reduce costs:**
- Exclude health check logs
- Lower log verbosity in production
- Use log sampling for high-volume services

---

## 🔍 Monitoring Checklist

### Daily Checks

- [ ] Review error logs for all services
- [ ] Check service uptime status
- [ ] Verify no active alerts

### Weekly Checks

- [ ] Review performance metrics
- [ ] Analyze latency trends
- [ ] Check resource utilization
- [ ] Review and action any warnings

### Monthly Checks

- [ ] Review SLI compliance
- [ ] Update alert thresholds if needed
- [ ] Review cost and optimize
- [ ] Update dashboards
- [ ] Test alert notification channels

---

## 📞 Quick Reference

### Console URLs

- **Monitoring Overview:** https://console.cloud.google.com/monitoring?project=ekklesia-prod-10-2025
- **Logs Explorer:** https://console.cloud.google.com/logs/query?project=ekklesia-prod-10-2025
- **Alerting:** https://console.cloud.google.com/monitoring/alerting?project=ekklesia-prod-10-2025
- **Dashboards:** https://console.cloud.google.com/monitoring/dashboards?project=ekklesia-prod-10-2025

### Common Commands

```bash
# Real-time logs for all services
gcloud run services logs tail members --region=europe-west2 &
gcloud run services logs tail oidc-bridge-proxy --region=europe-west2 &
gcloud run services logs tail zitadel --region=europe-west2 &

# Check service health
for svc in members oidc-bridge-proxy zitadel; do
  echo "=== $svc ==="
  gcloud run services describe $svc --region=europe-west2 \
    --format="value(status.conditions)"
done

# List all active alerts
gcloud alpha monitoring policies list \
  --format="table(displayName,conditions[].displayName,enabled)"
```

---

## 🔗 Related Documentation

- **RUNBOOKS.md** - Operational procedures
- **MEMBERS_DEPLOYMENT_GUIDE.md** - Deployment procedures
- **DOCUMENTATION_MAP.md** - Master documentation index

---

**Last Updated:** 2025-10-03
**Version:** 1.0
**Maintainer:** Ekklesia Operations Team
