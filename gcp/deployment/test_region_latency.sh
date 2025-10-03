#!/bin/bash
# Test latency to various GCP regions to find the best one for Iceland
# Pings Cloud Run endpoints in different regions

echo "======================================="
echo "🌍 Testing GCP Region Latency from Iceland"
echo "======================================="
echo ""
echo "Testing latency to various GCP regions..."
echo "Lower latency = better performance"
echo ""

# European regions (closest to Iceland)
REGIONS=(
    "europe-north1:Finland"
    "europe-west1:Belgium"
    "europe-west2:London"
    "europe-west3:Frankfurt"
    "europe-west4:Netherlands"
    "europe-west6:Zurich"
    "europe-west8:Milan"
    "europe-west9:Paris"
    "europe-west10:Berlin"
    "europe-west12:Turin"
    "europe-central2:Warsaw"
    "northamerica-northeast1:Montreal"
    "us-east1:South Carolina"
    "us-east4:Virginia"
)

# Google's Cloud Run health check endpoints
# We'll use google.com as a proxy since we don't have deployed services yet
declare -A REGION_ENDPOINTS=(
    ["europe-north1"]="europe-north1-run.googleapis.com"
    ["europe-west1"]="europe-west1-run.googleapis.com"
    ["europe-west2"]="europe-west2-run.googleapis.com"
    ["europe-west3"]="europe-west3-run.googleapis.com"
    ["europe-west4"]="europe-west4-run.googleapis.com"
    ["europe-west6"]="europe-west6-run.googleapis.com"
    ["europe-west8"]="europe-west8-run.googleapis.com"
    ["europe-west9"]="europe-west9-run.googleapis.com"
    ["europe-west10"]="europe-west10-run.googleapis.com"
    ["europe-west12"]="europe-west12-run.googleapis.com"
    ["europe-central2"]="europe-central2-run.googleapis.com"
    ["northamerica-northeast1"]="northamerica-northeast1-run.googleapis.com"
    ["us-east1"]="us-east1-run.googleapis.com"
    ["us-east4"]="us-east4-run.googleapis.com"
)

results=()

echo "Testing regions (this will take about 30 seconds)..."
echo ""

for region_info in "${REGIONS[@]}"; do
    region="${region_info%%:*}"
    location="${region_info##*:}"
    endpoint="${REGION_ENDPOINTS[$region]}"
    
    # Try to ping the endpoint 4 times and get average
    if ping_result=$(ping -c 4 -W 2 "$endpoint" 2>/dev/null | grep 'avg' | awk -F'/' '{print $5}'); then
        if [ -n "$ping_result" ]; then
            # Format: latency|region|location
            results+=("$ping_result|$region|$location")
            printf "%-25s %-35s %6.1f ms\n" "$region" "($location)" "$ping_result"
        else
            printf "%-25s %-35s %s\n" "$region" "($location)" "unreachable"
        fi
    else
        printf "%-25s %-35s %s\n" "$region" "($location)" "unreachable"
    fi
done

echo ""
echo "======================================="
echo "📊 Results Summary (Sorted by Latency)"
echo "======================================="
echo ""

# Sort results by latency
IFS=$'\n' sorted=($(printf '%s\n' "${results[@]}" | sort -t'|' -k1 -n))

rank=1
for result in "${sorted[@]}"; do
    latency="${result%%|*}"
    rest="${result#*|}"
    region="${rest%%|*}"
    location="${rest##*|}"
    
    if [ $rank -eq 1 ]; then
        emoji="🥇"
    elif [ $rank -eq 2 ]; then
        emoji="🥈"
    elif [ $rank -eq 3 ]; then
        emoji="🥉"
    else
        emoji="  "
    fi
    
    printf "%s %d. %-23s %-30s %6.1f ms\n" "$emoji" "$rank" "$region" "($location)" "$latency"
    ((rank++))
done

echo ""
echo "======================================="
echo "💡 Recommendation"
echo "======================================="
echo ""

if [ ${#sorted[@]} -gt 0 ]; then
    best="${sorted[0]}"
    latency="${best%%|*}"
    rest="${best#*|}"
    region="${rest%%|*}"
    location="${rest##*|}"
    
    echo "🎯 Best region for Iceland: $region ($location)"
    echo "   Average latency: ${latency} ms"
    echo ""
    echo "To use this region in your deployment:"
    echo "  1. Edit deploy_proxy.sh"
    echo "  2. Change REGION=\"$region\""
    echo ""
else
    echo "⚠️  Could not determine best region"
    echo "   Default recommendation: europe-north1 (Finland) - closest geographically"
fi

echo "======================================="
echo ""
