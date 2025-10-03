#!/bin/bash
# Test latency to different GCP regions

echo "======================================"
echo "🌍 GCP Region Latency Test"
echo "======================================"
echo "Testing from Iceland to GCP regions..."
echo ""

# GCP region endpoints (using Google DNS servers in each region as test targets)
declare -A regions=(
    ["europe-north1"]="35.228.0.1"      # Finland (Helsinki)
    ["europe-west1"]="35.195.0.1"       # Belgium (St. Ghislain)
    ["europe-west2"]="35.189.0.1"       # UK (London)
    ["europe-west3"]="35.198.0.1"       # Germany (Frankfurt)
    ["europe-west4"]="35.204.0.1"       # Netherlands (Eemshaven)
    ["europe-west6"]="34.65.0.1"        # Switzerland (Zurich)
    ["europe-central2"]="34.118.0.1"    # Poland (Warsaw)
    ["europe-north1"]="35.228.0.1"      # Finland (Helsinki)
)

echo "Running ping tests (5 packets each)..."
echo ""
echo "Region                Location              Avg Latency"
echo "--------------------------------------------------------"

# Test each region
for region in "${!regions[@]}"; do
    ip="${regions[$region]}"
    
    # Run ping and extract average latency
    if ping_result=$(ping -c 5 -W 2 $ip 2>/dev/null | grep "rtt min/avg/max"); then
        avg_latency=$(echo $ping_result | cut -d'/' -f5)
        
        # Format region name and location
        case $region in
            "europe-north1") location="Finland (Helsinki)" ;;
            "europe-west1") location="Belgium" ;;
            "europe-west2") location="UK (London)" ;;
            "europe-west3") location="Germany (Frankfurt)" ;;
            "europe-west4") location="Netherlands" ;;
            "europe-west6") location="Switzerland" ;;
            "europe-central2") location="Poland (Warsaw)" ;;
            *) location="Unknown" ;;
        esac
        
        printf "%-20s %-20s %s ms\n" "$region" "$location" "$avg_latency"
    else
        printf "%-20s %-20s %s\n" "$region" "$location" "Failed/Timeout"
    fi
done

echo ""
echo "--------------------------------------------------------"
echo ""
echo "💡 Recommendations:"
echo "- Choose the region with lowest latency"
echo "- europe-north1 (Finland) is geographically closest to Iceland"
echo "- europe-west1 (Belgium) has good connectivity"
echo "- europe-west4 (Netherlands) is also a good option"
echo ""

# Alternative test using gcping
echo "======================================"
echo "Alternative: Web-based test"
echo "======================================"
echo "Visit: https://gcping.com"
echo "This will show real-time latency to all GCP regions"
echo ""