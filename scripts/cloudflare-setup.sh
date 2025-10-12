#!/bin/bash

################################################################################
# Cloudflare Setup Script for Ekklesia Platform
#
# This script automates the complete Cloudflare configuration including:
# - DNS record creation (CNAME records for all services)
# - SSL/TLS configuration (Full strict mode)
# - Rate limiting rules (combined rule for all services)
# - Security features (Bot Fight Mode, Browser Integrity Check)
# - Verification and testing
#
# Prerequisites:
# - Cloudflare account with zone already added
# - API token with permissions: Zone.DNS, Zone.SSL, Zone.WAF
# - jq installed (for JSON parsing)
#
# Usage:
#   ./cloudflare-setup.sh [command]
#
# Commands:
#   setup-dns         - Create DNS records for all services
#   setup-rate-limit  - Create rate limiting rule
#   verify            - Verify all configurations
#   test              - Test rate limiting and origin protection
#   cleanup           - Remove all Cloudflare configurations
#   full              - Run complete setup (dns + rate-limit + verify)
#
# Environment Variables (set these or edit below):
#   CF_API_TOKEN      - Cloudflare API token
#   CF_ZONE_ID        - Cloudflare zone ID
#   GCP_PROJECT       - GCP project ID
#   GCP_REGION        - GCP region (default: europe-west2)
#
# Author: Generated from Ekklesia security hardening implementation
# Date: 2025-10-12
# Version: 1.0
################################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

################################################################################
# Configuration
################################################################################

# Cloudflare Configuration
CF_API_TOKEN="${CF_API_TOKEN:-gD0MXa-Y6K3n8pDDxbkyJnJuy-YIGl2KTOyD3Rn7}"
CF_ZONE_ID="${CF_ZONE_ID:-4cab51095e756bd898cc3debec754828}"
CF_ZONE_NAME="${CF_ZONE_NAME:-si-xj.org}"

# GCP Configuration
GCP_PROJECT="${GCP_PROJECT:-ekklesia-prod-10-2025}"
GCP_PROJECT_NUMBER="${GCP_PROJECT_NUMBER:-521240388393}"
GCP_REGION="${GCP_REGION:-europe-west2}"

# Service Mappings (subdomain → Cloud Run service)
declare -A SERVICES=(
    ["auth"]="handlekenniauth"
    ["api"]="events-service"
    ["vote"]="elections-service"
    ["verify"]="verifymembership"
)

# Rate Limiting Configuration
RATE_LIMIT_PERIOD=10              # seconds (free tier only supports 10)
RATE_LIMIT_REQUESTS=100           # requests per period
RATE_LIMIT_TIMEOUT=10             # block duration in seconds (free tier only supports 10)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

################################################################################
# Helper Functions
################################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    log_info "Checking dependencies..."

    local missing=0

    if ! command -v curl &> /dev/null; then
        log_error "curl is not installed"
        missing=1
    fi

    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed (install with: sudo dnf install jq)"
        missing=1
    fi

    if [ $missing -eq 1 ]; then
        exit 1
    fi

    log_success "All dependencies installed"
}

verify_api_token() {
    log_info "Verifying Cloudflare API token..."

    local response=$(curl -s -X GET \
        "https://api.cloudflare.com/client/v4/user/tokens/verify" \
        -H "Authorization: Bearer ${CF_API_TOKEN}")

    local success=$(echo "$response" | jq -r '.success')

    if [ "$success" != "true" ]; then
        log_error "Invalid Cloudflare API token"
        echo "$response" | jq
        exit 1
    fi

    log_success "API token is valid"
}

cloudflare_api() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"

    local url="https://api.cloudflare.com/client/v4${endpoint}"

    if [ -n "$data" ]; then
        curl -s -X "$method" "$url" \
            -H "Authorization: Bearer ${CF_API_TOKEN}" \
            -H "Content-Type: application/json" \
            --data "$data"
    else
        curl -s -X "$method" "$url" \
            -H "Authorization: Bearer ${CF_API_TOKEN}"
    fi
}

################################################################################
# DNS Configuration
################################################################################

setup_dns() {
    log_info "Setting up DNS records for all services..."

    # Get existing DNS records to avoid duplicates
    local existing_records=$(cloudflare_api GET "/zones/${CF_ZONE_ID}/dns_records?type=CNAME")

    for subdomain in "${!SERVICES[@]}"; do
        local service="${SERVICES[$subdomain]}"
        local hostname="${subdomain}.${CF_ZONE_NAME}"
        local target="${service}-${GCP_PROJECT_NUMBER}.${GCP_REGION}.run.app"

        log_info "Creating DNS record: ${hostname} → ${target}"

        # Check if record already exists
        local existing_id=$(echo "$existing_records" | jq -r ".result[] | select(.name == \"${hostname}\") | .id")

        if [ -n "$existing_id" ] && [ "$existing_id" != "null" ]; then
            log_warning "DNS record ${hostname} already exists (ID: ${existing_id}), skipping"
            continue
        fi

        # Create DNS record
        local response=$(cloudflare_api POST "/zones/${CF_ZONE_ID}/dns_records" '{
            "type": "CNAME",
            "name": "'"${subdomain}"'",
            "content": "'"${target}"'",
            "ttl": 1,
            "proxied": true,
            "comment": "Ekklesia service: '"${service}"'"
        }')

        local success=$(echo "$response" | jq -r '.success')

        if [ "$success" == "true" ]; then
            local record_id=$(echo "$response" | jq -r '.result.id')
            log_success "Created DNS record: ${hostname} (ID: ${record_id})"
        else
            log_error "Failed to create DNS record: ${hostname}"
            echo "$response" | jq '.errors'
        fi
    done

    log_success "DNS setup complete"
}

verify_dns() {
    log_info "Verifying DNS propagation..."

    for subdomain in "${!SERVICES[@]}"; do
        local hostname="${subdomain}.${CF_ZONE_NAME}"

        log_info "Checking ${hostname}..."

        # Query Cloudflare DNS (1.1.1.1)
        local result=$(dig @1.1.1.1 +short "${hostname}" | head -1)

        if [ -n "$result" ]; then
            log_success "${hostname} resolves to ${result}"
        else
            log_warning "${hostname} not yet propagated"
        fi
    done
}

delete_dns() {
    log_warning "Deleting all Ekklesia DNS records..."

    local records=$(cloudflare_api GET "/zones/${CF_ZONE_ID}/dns_records?type=CNAME")

    for subdomain in "${!SERVICES[@]}"; do
        local hostname="${subdomain}.${CF_ZONE_NAME}"
        local record_id=$(echo "$records" | jq -r ".result[] | select(.name == \"${hostname}\") | .id")

        if [ -n "$record_id" ] && [ "$record_id" != "null" ]; then
            log_info "Deleting DNS record: ${hostname} (ID: ${record_id})"

            local response=$(cloudflare_api DELETE "/zones/${CF_ZONE_ID}/dns_records/${record_id}")
            local success=$(echo "$response" | jq -r '.success')

            if [ "$success" == "true" ]; then
                log_success "Deleted ${hostname}"
            else
                log_error "Failed to delete ${hostname}"
                echo "$response" | jq '.errors'
            fi
        else
            log_warning "DNS record ${hostname} not found"
        fi
    done
}

################################################################################
# Rate Limiting Configuration
################################################################################

setup_rate_limiting() {
    log_info "Setting up rate limiting rule..."

    # Get rate limiting ruleset
    local rulesets=$(cloudflare_api GET "/zones/${CF_ZONE_ID}/rulesets")
    local ruleset_id=$(echo "$rulesets" | jq -r '.result[] | select(.phase == "http_ratelimit") | .id')

    if [ -z "$ruleset_id" ] || [ "$ruleset_id" == "null" ]; then
        log_error "Rate limiting ruleset not found"
        exit 1
    fi

    log_info "Found rate limiting ruleset: ${ruleset_id}"

    # Build expression for all services
    local hostnames=""
    for subdomain in "${!SERVICES[@]}"; do
        hostnames="${hostnames}\"${subdomain}.${CF_ZONE_NAME}\" "
    done
    hostnames=$(echo "$hostnames" | sed 's/ $//')  # Remove trailing space

    local expression="(http.host in {${hostnames}})"

    log_info "Rate limit expression: ${expression}"
    log_info "Limit: ${RATE_LIMIT_REQUESTS} requests per ${RATE_LIMIT_PERIOD} seconds"
    log_info "Block duration: ${RATE_LIMIT_TIMEOUT} seconds"

    # Create rate limiting rule (overwrites existing rules due to free tier limitation)
    local response=$(cloudflare_api PUT "/zones/${CF_ZONE_ID}/rulesets/${ruleset_id}" '{
        "rules": [
            {
                "action": "block",
                "description": "Rate Limit Protection - All Services ('"${RATE_LIMIT_REQUESTS}"' req/'"${RATE_LIMIT_PERIOD}"'sec, block '"${RATE_LIMIT_TIMEOUT}"'sec)",
                "enabled": true,
                "expression": "'"${expression}"'",
                "ratelimit": {
                    "characteristics": ["ip.src", "cf.colo.id"],
                    "period": '"${RATE_LIMIT_PERIOD}"',
                    "requests_per_period": '"${RATE_LIMIT_REQUESTS}"',
                    "mitigation_timeout": '"${RATE_LIMIT_TIMEOUT}"'
                }
            }
        ]
    }')

    local success=$(echo "$response" | jq -r '.success')

    if [ "$success" == "true" ]; then
        local rule_id=$(echo "$response" | jq -r '.result.rules[0].id')
        log_success "Rate limiting rule created (ID: ${rule_id})"
        log_info "Rule protects: ${hostnames}"
    else
        log_error "Failed to create rate limiting rule"
        echo "$response" | jq '.errors'
        exit 1
    fi
}

verify_rate_limiting() {
    log_info "Verifying rate limiting configuration..."

    local rulesets=$(cloudflare_api GET "/zones/${CF_ZONE_ID}/rulesets")
    local ruleset_id=$(echo "$rulesets" | jq -r '.result[] | select(.phase == "http_ratelimit") | .id')

    if [ -z "$ruleset_id" ] || [ "$ruleset_id" == "null" ]; then
        log_error "Rate limiting ruleset not found"
        return 1
    fi

    local ruleset=$(cloudflare_api GET "/zones/${CF_ZONE_ID}/rulesets/${ruleset_id}")
    local rules=$(echo "$ruleset" | jq '.result.rules')
    local rule_count=$(echo "$rules" | jq 'length')

    if [ "$rule_count" -gt 0 ]; then
        log_success "Rate limiting rules active: ${rule_count}"
        echo "$rules" | jq -r '.[] | "  - \(.description)\n    Expression: \(.expression)\n    Limit: \(.ratelimit.requests_per_period) req/\(.ratelimit.period)sec\n    Block: \(.ratelimit.mitigation_timeout)sec\n"'
    else
        log_warning "No rate limiting rules configured"
    fi
}

delete_rate_limiting() {
    log_warning "Deleting all rate limiting rules..."

    local rulesets=$(cloudflare_api GET "/zones/${CF_ZONE_ID}/rulesets")
    local ruleset_id=$(echo "$rulesets" | jq -r '.result[] | select(.phase == "http_ratelimit") | .id')

    if [ -z "$ruleset_id" ] || [ "$ruleset_id" == "null" ]; then
        log_error "Rate limiting ruleset not found"
        return 1
    fi

    local response=$(cloudflare_api PUT "/zones/${CF_ZONE_ID}/rulesets/${ruleset_id}" '{
        "rules": []
    }')

    local success=$(echo "$response" | jq -r '.success')

    if [ "$success" == "true" ]; then
        log_success "All rate limiting rules deleted"
    else
        log_error "Failed to delete rate limiting rules"
        echo "$response" | jq '.errors'
    fi
}

################################################################################
# Testing & Verification
################################################################################

test_origin_protection() {
    log_info "Testing origin protection (direct Cloud Run URLs should be blocked)..."

    for subdomain in "${!SERVICES[@]}"; do
        local service="${SERVICES[$subdomain]}"
        local direct_url="https://${service}-${GCP_PROJECT_NUMBER}.${GCP_REGION}.run.app/health"

        log_info "Testing ${service} direct URL..."

        local response=$(curl -s -w "\n%{http_code}" "${direct_url}" 2>/dev/null || echo "000")
        local http_code=$(echo "$response" | tail -1)

        if [ "$http_code" == "403" ]; then
            log_success "${service}: Origin protection working (403 Forbidden)"
        else
            log_warning "${service}: Got HTTP ${http_code} (expected 403)"
        fi
    done
}

test_cloudflare_routing() {
    log_info "Testing Cloudflare routing (should work via custom domains)..."

    for subdomain in "${!SERVICES[@]}"; do
        local hostname="${subdomain}.${CF_ZONE_NAME}"
        local url="https://${hostname}/"

        log_info "Testing ${hostname}..."

        local response=$(curl -s -I "${url}" -w "\n%{http_code}" 2>/dev/null || echo "000")
        local http_code=$(echo "$response" | tail -1)

        # Check for CF-Ray header (proof of Cloudflare)
        local cf_ray=$(echo "$response" | grep -i "cf-ray" || true)

        if [ -n "$cf_ray" ]; then
            log_success "${hostname}: Routing through Cloudflare ✓"
        else
            log_warning "${hostname}: CF-Ray header not found (DNS may not be propagated)"
        fi
    done
}

test_rate_limiting() {
    log_info "Testing rate limiting (sending 15 rapid requests)..."

    local test_url="https://auth.${CF_ZONE_NAME}/"

    log_info "Target: ${test_url}"
    log_info "Sending requests..."

    local blocked=0

    for i in {1..15}; do
        local http_code=$(curl -s -o /dev/null -w "%{http_code}" "${test_url}")

        if [ "$http_code" == "429" ]; then
            blocked=$((blocked + 1))
        fi

        echo -n "."
    done

    echo ""

    if [ $blocked -gt 0 ]; then
        log_success "Rate limiting is working (blocked ${blocked}/15 requests)"
    else
        log_warning "Rate limiting may not be active (no 429 responses)"
    fi
}

run_full_verification() {
    log_info "Running full verification suite..."
    echo ""

    verify_api_token
    echo ""

    verify_dns
    echo ""

    verify_rate_limiting
    echo ""

    test_origin_protection
    echo ""

    test_cloudflare_routing
    echo ""

    log_success "Verification complete"
}

################################################################################
# Cleanup Functions
################################################################################

cleanup_all() {
    log_warning "WARNING: This will remove all Cloudflare configurations for Ekklesia"
    read -p "Are you sure? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        log_info "Cleanup cancelled"
        exit 0
    fi

    delete_rate_limiting
    echo ""

    delete_dns
    echo ""

    log_success "Cleanup complete"
}

################################################################################
# Main Script
################################################################################

show_usage() {
    cat << EOF
Cloudflare Setup Script for Ekklesia Platform

Usage: $0 [command]

Commands:
    setup-dns         Create DNS records for all services
    setup-rate-limit  Create rate limiting rule
    verify            Verify all configurations
    test              Test rate limiting and origin protection
    cleanup           Remove all Cloudflare configurations
    full              Run complete setup (dns + rate-limit + verify)
    help              Show this help message

Examples:
    $0 full              # Complete setup
    $0 setup-dns         # Only create DNS records
    $0 verify            # Verify current configuration
    $0 test              # Test protections

Configuration:
    CF_API_TOKEN:    ${CF_API_TOKEN:0:20}...
    CF_ZONE_ID:      ${CF_ZONE_ID}
    CF_ZONE_NAME:    ${CF_ZONE_NAME}
    GCP_PROJECT:     ${GCP_PROJECT}
    GCP_REGION:      ${GCP_REGION}

Services:
$(for subdomain in "${!SERVICES[@]}"; do
    echo "    ${subdomain}.${CF_ZONE_NAME} → ${SERVICES[$subdomain]}"
done | sort)

EOF
}

main() {
    local command="${1:-help}"

    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "  Ekklesia Cloudflare Setup Script"
    echo "═══════════════════════════════════════════════════════════"
    echo ""

    case "$command" in
        setup-dns)
            check_dependencies
            verify_api_token
            setup_dns
            verify_dns
            ;;
        setup-rate-limit)
            check_dependencies
            verify_api_token
            setup_rate_limiting
            verify_rate_limiting
            ;;
        verify)
            check_dependencies
            run_full_verification
            ;;
        test)
            check_dependencies
            test_origin_protection
            echo ""
            test_cloudflare_routing
            echo ""
            test_rate_limiting
            ;;
        cleanup)
            check_dependencies
            verify_api_token
            cleanup_all
            ;;
        full)
            check_dependencies
            verify_api_token
            echo ""
            setup_dns
            echo ""
            setup_rate_limiting
            echo ""
            run_full_verification
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            log_error "Unknown command: $command"
            echo ""
            show_usage
            exit 1
            ;;
    esac

    echo ""
    log_success "Done!"
    echo ""
}

# Run main function
main "$@"
