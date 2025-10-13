#!/bin/bash
# Fix Cloudflare DNS records to point to correct Cloud Run URLs

set -e

CF_TOKEN="gD0MXa-Y6K3n8pDDxbkyJnJuy-YIGl2KTOyD3Rn7"
CF_ZONE="4cab51095e756bd898cc3debec754828"
GCP_PROJECT="ekklesia-prod-10-2025"
GCP_REGION="europe-west2"

echo "Fetching Cloud Run service URLs..."

# Get actual Cloud Run URLs
AUTH_URL=$(gcloud functions describe handleKenniAuth --region=$GCP_REGION --gen2 --project=$GCP_PROJECT --format="value(serviceConfig.uri)" | sed 's|https://||')
VERIFY_URL=$(gcloud functions describe verifyMembership --region=$GCP_REGION --gen2 --project=$GCP_PROJECT --format="value(serviceConfig.uri)" | sed 's|https://||')
API_URL=$(gcloud run services describe events-service --region=$GCP_REGION --project=$GCP_PROJECT --format="value(status.url)" | sed 's|https://||')
VOTE_URL=$(gcloud run services describe elections-service --region=$GCP_REGION --project=$GCP_PROJECT --format="value(status.url)" | sed 's|https://||')

echo "Cloud Run URLs:"
echo "  auth.si-xj.org → $AUTH_URL"
echo "  verify.si-xj.org → $VERIFY_URL"
echo "  api.si-xj.org → $API_URL"
echo "  vote.si-xj.org → $VOTE_URL"

# Function to get existing DNS record ID
get_record_id() {
    local hostname="$1"
    curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records?name=$hostname" \
        -H "X-Auth-Email: gudrodur@sosialistaflokkurinn.is" \
        -H "X-Auth-Key: $CF_TOKEN" \
        -H "Content-Type: application/json" | jq -r '.result[0].id'
}

# Function to update DNS record
update_dns() {
    local hostname="$1"
    local target="$2"
    local record_id=$(get_record_id "$hostname")

    echo "Updating $hostname (ID: $record_id) → $target"

    if [ "$record_id" != "null" ] && [ -n "$record_id" ]; then
        curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records/$record_id" \
            -H "X-Auth-Email: gudrodur@sosialistaflokkurinn.is" \
            -H "X-Auth-Key: $CF_TOKEN" \
            -H "Content-Type: application/json" \
            --data '{
                "type": "CNAME",
                "name": "'$hostname'",
                "content": "'$target'",
                "ttl": 1,
                "proxied": true
            }' | jq '.success, .errors'
    else
        echo "Record not found, creating new one..."
        curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records" \
            -H "X-Auth-Email: gudrodur@sosialistaflokkurinn.is" \
            -H "X-Auth-Key: $CF_TOKEN" \
            -H "Content-Type: application/json" \
            --data '{
                "type": "CNAME",
                "name": "'$hostname'",
                "content": "'$target'",
                "ttl": 1,
                "proxied": true
            }' | jq '.success, .errors'
    fi
}

# Update all DNS records
update_dns "auth.si-xj.org" "$AUTH_URL"
update_dns "verify.si-xj.org" "$VERIFY_URL"
update_dns "api.si-xj.org" "$API_URL"
update_dns "vote.si-xj.org" "$VOTE_URL"

echo "Done! DNS records updated. Wait 1-2 minutes for propagation."
