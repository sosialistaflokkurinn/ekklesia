#!/bin/bash
# Ekklesia Cloudflare Security Management Script
# Manages DNS records and security settings for Ekklesia voting platform
# Uses Cloudflare API v4
#
# Created: 2025-10-12
# Project: Ekklesia E-Democracy Platform
# Purpose: Edge-level protection, DDoS defense, rate limiting for Cloud Run services

set -e

# ============================================================================
# CONFIGURATION
# ============================================================================

# Domain Configuration
# DECISION (Oct 12, 2025): Use si-xj.org (developer has full access, already on Cloudflare)
# Can migrate to sosialistaflokkurinn.is or xj.is later if party decides
DOMAIN="${CLOUDFLARE_DOMAIN:-si-xj.org}"
ZONE_ID=""  # Will be fetched automatically

# GCP Cloud Run Service URLs (Production)
HANDLEKENNIAUTH_URL="handlekenniauth-521240388393.europe-west2.run.app"
VERIFYMEMBERSHIP_URL="verifymembership-521240388393.europe-west2.run.app"
EVENTS_SERVICE_URL="events-service-521240388393.europe-west2.run.app"
ELECTIONS_SERVICE_URL="elections-service-521240388393.europe-west2.run.app"

# Subdomain Configuration
AUTH_SUBDOMAIN="auth"           # OAuth endpoint
VERIFY_SUBDOMAIN="verify"       # Membership verification
API_SUBDOMAIN="api"             # Events API
VOTE_SUBDOMAIN="vote"           # Elections/Voting API

# API Token (from environment or GCP Secret Manager)
CF_API_TOKEN="${CF_API_TOKEN:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ============================================================================
# AUTHENTICATION CHECK
# ============================================================================

check_auth() {
    if [ -z "$CF_API_TOKEN" ]; then
        echo -e "${RED}ERROR: CF_API_TOKEN not set${NC}"
        echo ""
        echo "Option 1: Set environment variable"
        echo "  export CF_API_TOKEN='your-token-here'"
        echo ""
        echo "Option 2: Load from GCP Secret Manager (recommended)"
        echo "  export CF_API_TOKEN=\$(gcloud secrets versions access latest \\"
        echo "    --secret=cloudflare-api-token \\"
        echo "    --project=ekklesia-prod-10-2025)"
        echo ""
        echo "Get API token from: https://dash.cloudflare.com/profile/api-tokens"
        echo "Required permissions: Zone.DNS (Edit), Zone.Zone Settings (Read)"
        exit 1
    fi
}

# ============================================================================
# ZONE MANAGEMENT
# ============================================================================

get_zone_id() {
    local domain=${1:-$DOMAIN}
    echo -e "${BLUE}Fetching zone ID for ${domain}...${NC}"

    ZONE_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=${domain}" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json" | jq -r '.result[0].id')

    if [ "$ZONE_ID" = "null" ] || [ -z "$ZONE_ID" ]; then
        echo -e "${RED}ERROR: Could not find zone for domain ${domain}${NC}"
        echo "Make sure:"
        echo "  1. Domain is added to Cloudflare"
        echo "  2. API token has correct permissions"
        echo "  3. Domain name is spelled correctly"
        exit 1
    fi

    echo -e "${GREEN}✓ Zone ID: ${ZONE_ID}${NC}"
}

get_zone_info() {
    echo -e "${CYAN}Zone Information for ${DOMAIN}:${NC}"
    curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json" | \
        jq -r '.result | "Name: \(.name)\nStatus: \(.status)\nNameservers: \(.name_servers | join(", "))\nPlan: \(.plan.name)"'
}

# ============================================================================
# DNS RECORD MANAGEMENT
# ============================================================================

list_records() {
    echo -e "${CYAN}DNS Records for ${DOMAIN}:${NC}"
    echo -e "${YELLOW}TYPE\tNAME\t\t\t\t\tTARGET\t\t\t\t\tPROXIED${NC}"
    curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json" | \
        jq -r '.result[] | "\(.type)\t\(.name)\t\(.content)\t\(.proxied)"'
}

create_cname_record() {
    local name=$1
    local target=$2
    local proxied=${3:-true}  # Default to proxied (for security)
    local comment=${4:-"Managed by Ekklesia cloudflare-dns.sh"}

    echo -e "${YELLOW}Creating CNAME record: ${name}.${DOMAIN} -> ${target} (Proxied: ${proxied})${NC}"

    local response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json" \
        --data "{\"type\":\"CNAME\",\"name\":\"${name}\",\"content\":\"${target}\",\"ttl\":1,\"proxied\":${proxied},\"comment\":\"${comment}\"}")

    local success=$(echo "$response" | jq -r '.success')

    if [ "$success" = "true" ]; then
        echo -e "${GREEN}✓ Successfully created ${name}.${DOMAIN}${NC}"
        echo "$response" | jq '.result | {id, name, content, proxied}'
    else
        echo -e "${RED}✗ Failed to create record${NC}"
        echo "$response" | jq '.errors'
        return 1
    fi
}

update_record() {
    local record_id=$1
    local type=$2
    local name=$3
    local content=$4
    local proxied=${5:-true}

    echo -e "${YELLOW}Updating ${type} record: ${name} -> ${content}${NC}"

    local response=$(curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${record_id}" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json" \
        --data "{\"type\":\"${type}\",\"name\":\"${name}\",\"content\":\"${content}\",\"ttl\":1,\"proxied\":${proxied}}")

    local success=$(echo "$response" | jq -r '.success')

    if [ "$success" = "true" ]; then
        echo -e "${GREEN}✓ Successfully updated record${NC}"
    else
        echo -e "${RED}✗ Failed to update record${NC}"
        echo "$response" | jq '.errors'
        return 1
    fi
}

delete_record() {
    local record_id=$1

    echo -e "${YELLOW}Deleting record ID: ${record_id}${NC}"

    local response=$(curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${record_id}" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json")

    local success=$(echo "$response" | jq -r '.success')

    if [ "$success" = "true" ]; then
        echo -e "${GREEN}✓ Successfully deleted record${NC}"
    else
        echo -e "${RED}✗ Failed to delete record${NC}"
        echo "$response" | jq '.errors'
        return 1
    fi
}

get_record_id() {
    local name=$1
    local full_name="${name}.${DOMAIN}"

    local record_id=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?name=${full_name}" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json" | jq -r '.result[0].id')

    if [ "$record_id" = "null" ] || [ -z "$record_id" ]; then
        echo -e "${RED}✗ Record not found: ${full_name}${NC}"
        return 1
    fi

    echo "$record_id"
}

# ============================================================================
# EKKLESIA-SPECIFIC SETUP COMMANDS
# ============================================================================

setup_all_services() {
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${MAGENTA}  Ekklesia Full Service Setup${NC}"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${CYAN}This will create 4 CNAME records (all proxied for security):${NC}"
    echo -e "  1. ${AUTH_SUBDOMAIN}.${DOMAIN} -> ${HANDLEKENNIAUTH_URL}"
    echo -e "  2. ${VERIFY_SUBDOMAIN}.${DOMAIN} -> ${VERIFYMEMBERSHIP_URL}"
    echo -e "  3. ${API_SUBDOMAIN}.${DOMAIN} -> ${EVENTS_SERVICE_URL}"
    echo -e "  4. ${VOTE_SUBDOMAIN}.${DOMAIN} -> ${ELECTIONS_SERVICE_URL}"
    echo ""
    read -p "Continue? (y/N): " confirm

    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "Aborted."
        exit 0
    fi

    get_zone_id "$DOMAIN"
    echo ""

    # Create all records
    create_cname_record "$AUTH_SUBDOMAIN" "$HANDLEKENNIAUTH_URL" true "Ekklesia OAuth endpoint - handleKenniAuth"
    echo ""
    create_cname_record "$VERIFY_SUBDOMAIN" "$VERIFYMEMBERSHIP_URL" true "Ekklesia membership verification"
    echo ""
    create_cname_record "$API_SUBDOMAIN" "$EVENTS_SERVICE_URL" true "Ekklesia Events API - token issuance"
    echo ""
    create_cname_record "$VOTE_SUBDOMAIN" "$ELECTIONS_SERVICE_URL" true "Ekklesia Elections API - anonymous voting"
    echo ""

    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✓ All services configured successfully!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${CYAN}Your new URLs:${NC}"
    echo -e "  OAuth:        https://${AUTH_SUBDOMAIN}.${DOMAIN}/"
    echo -e "  Verification: https://${VERIFY_SUBDOMAIN}.${DOMAIN}/"
    echo -e "  Events API:   https://${API_SUBDOMAIN}.${DOMAIN}/"
    echo -e "  Voting API:   https://${VOTE_SUBDOMAIN}.${DOMAIN}/"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. Wait 1-2 minutes for DNS propagation"
    echo "  2. Test endpoints: ./cloudflare-dns.sh test"
    echo "  3. Configure rate limiting in Cloudflare dashboard"
    echo "  4. Update application URLs in code"
}

teardown_all_services() {
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}  Ekklesia Service Teardown (DESTRUCTIVE)${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${YELLOW}This will DELETE all Ekklesia DNS records:${NC}"
    echo -e "  - ${AUTH_SUBDOMAIN}.${DOMAIN}"
    echo -e "  - ${VERIFY_SUBDOMAIN}.${DOMAIN}"
    echo -e "  - ${API_SUBDOMAIN}.${DOMAIN}"
    echo -e "  - ${VOTE_SUBDOMAIN}.${DOMAIN}"
    echo ""
    read -p "Are you SURE? Type 'DELETE' to confirm: " confirm

    if [ "$confirm" != "DELETE" ]; then
        echo "Aborted."
        exit 0
    fi

    get_zone_id "$DOMAIN"
    echo ""

    # Delete all records
    for subdomain in "$AUTH_SUBDOMAIN" "$VERIFY_SUBDOMAIN" "$API_SUBDOMAIN" "$VOTE_SUBDOMAIN"; do
        local record_id=$(get_record_id "$subdomain")
        if [ -n "$record_id" ] && [ "$record_id" != "null" ]; then
            delete_record "$record_id"
        else
            echo -e "${YELLOW}  Record ${subdomain}.${DOMAIN} not found, skipping${NC}"
        fi
        echo ""
    done

    echo -e "${GREEN}✓ Teardown complete${NC}"
}

# ============================================================================
# TESTING & VERIFICATION
# ============================================================================

test_endpoints() {
    echo -e "${CYAN}Testing Ekklesia Endpoints...${NC}"
    echo ""

    for subdomain in "$AUTH_SUBDOMAIN" "$VERIFY_SUBDOMAIN" "$API_SUBDOMAIN" "$VOTE_SUBDOMAIN"; do
        local url="https://${subdomain}.${DOMAIN}/"
        echo -e "${YELLOW}Testing: ${url}${NC}"

        # Test DNS resolution
        local dns_result=$(dig +short "${subdomain}.${DOMAIN}" | head -1)
        if [ -n "$dns_result" ]; then
            echo -e "  ${GREEN}✓ DNS resolves to: ${dns_result}${NC}"
        else
            echo -e "  ${RED}✗ DNS resolution failed${NC}"
        fi

        # Test HTTPS
        local http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" || echo "TIMEOUT")
        if [ "$http_code" != "TIMEOUT" ]; then
            if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 500 ]; then
                echo -e "  ${GREEN}✓ HTTPS accessible (HTTP ${http_code})${NC}"
            else
                echo -e "  ${YELLOW}⚠ HTTPS responds but with HTTP ${http_code}${NC}"
            fi
        else
            echo -e "  ${RED}✗ HTTPS connection timeout${NC}"
        fi

        echo ""
    done

    echo -e "${CYAN}Testing rate limiting (will send 10 requests)...${NC}"
    local test_url="https://${API_SUBDOMAIN}.${DOMAIN}/health"
    for i in {1..10}; do
        http_code=$(curl -s -o /dev/null -w "%{http_code}" "$test_url" || echo "ERR")
        if [ "$http_code" = "429" ]; then
            echo -e "${GREEN}✓ Rate limiting is working! (got 429 on request #${i})${NC}"
            break
        fi
        echo -n "."
    done
    echo ""
}

check_security_status() {
    echo -e "${CYAN}Security Status for ${DOMAIN}:${NC}"
    echo ""

    get_zone_id "$DOMAIN"

    # Check SSL/TLS settings
    echo -e "${YELLOW}SSL/TLS Settings:${NC}"
    local ssl_info=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/settings/ssl" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json" | jq -r '.result.value')
    echo "  Mode: $ssl_info"

    if [ "$ssl_info" = "full" ] || [ "$ssl_info" = "strict" ]; then
        echo -e "  ${GREEN}✓ Secure SSL mode${NC}"
    else
        echo -e "  ${YELLOW}⚠ Consider using 'full' or 'strict' mode${NC}"
    fi
    echo ""

    # Check security level
    echo -e "${YELLOW}Security Level:${NC}"
    local sec_level=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/settings/security_level" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json" | jq -r '.result.value')
    echo "  Level: $sec_level"
    echo ""

    # Check if records are proxied
    echo -e "${YELLOW}DNS Records Proxy Status:${NC}"
    curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json" | \
        jq -r '.result[] | select(.type == "CNAME") | "\(.name): \(if .proxied then "✓ Proxied (Protected)" else "✗ Not proxied (Exposed)" end)"'
    echo ""

    echo -e "${CYAN}Rate Limiting Configuration:${NC}"
    echo "  Note: Rate limiting rules must be configured in Cloudflare dashboard"
    echo "  https://dash.cloudflare.com → Security → WAF → Rate limiting rules"
    echo ""
    echo -e "${YELLOW}Recommended rules for Ekklesia:${NC}"
    echo "  1. OAuth endpoint: 100 req/min → Block 10 min"
    echo "  2. API endpoints: 300 req/min → CAPTCHA challenge"
    echo "  3. Verify endpoint: 60 req/min → Block 5 min"
}

# ============================================================================
# GCP INTEGRATION
# ============================================================================

load_token_from_gcp() {
    echo -e "${BLUE}Loading Cloudflare API token from GCP Secret Manager...${NC}"

    if ! command -v gcloud &> /dev/null; then
        echo -e "${RED}✗ gcloud CLI not found${NC}"
        return 1
    fi

    local token=$(gcloud secrets versions access latest \
        --secret=cloudflare-api-token \
        --project=ekklesia-prod-10-2025 2>/dev/null)

    if [ -n "$token" ]; then
        export CF_API_TOKEN="$token"
        echo -e "${GREEN}✓ Token loaded successfully${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed to load token${NC}"
        echo "Create secret with:"
        echo "  echo -n 'your-token' | gcloud secrets create cloudflare-api-token \\"
        echo "    --project=ekklesia-prod-10-2025 \\"
        echo "    --replication-policy automatic \\"
        echo "    --data-file=-"
        return 1
    fi
}

# ============================================================================
# HELP & USAGE
# ============================================================================

show_help() {
    cat << EOF
${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}
${MAGENTA}  Ekklesia Cloudflare Security Management${NC}
${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}

${CYAN}Edge-Level Protection Commands:${NC}
  ${GREEN}setup${NC}              Create all Ekklesia DNS records (recommended)
  ${GREEN}teardown${NC}           Delete all Ekklesia DNS records (destructive!)
  ${GREEN}test${NC}               Test all endpoints and verify configuration
  ${GREEN}status${NC}             Show security status and recommendations

${CYAN}DNS Management Commands:${NC}
  ${GREEN}list${NC}               List all DNS records for domain
  ${GREEN}zone-info${NC}          Show zone information
  ${GREEN}create-cname${NC} <name> <target> [proxied]
                       Create CNAME record (proxied=true by default)
  ${GREEN}update${NC} <id> <type> <name> <content> [proxied]
                       Update existing record
  ${GREEN}delete${NC} <record-id> Delete record by ID
  ${GREEN}get-id${NC} <name>      Get record ID by subdomain name

${CYAN}Authentication Commands:${NC}
  ${GREEN}load-token${NC}         Load API token from GCP Secret Manager

${CYAN}Configuration:${NC}
  Domain:      ${DOMAIN}
  Subdomains:  ${AUTH_SUBDOMAIN}, ${VERIFY_SUBDOMAIN}, ${API_SUBDOMAIN}, ${VOTE_SUBDOMAIN}

${CYAN}Quick Start:${NC}
  1. Set API token:
     ${YELLOW}export CF_API_TOKEN='your-token'${NC}

     Or load from GCP:
     ${YELLOW}./cloudflare-dns.sh load-token${NC}

  2. Set up all services:
     ${YELLOW}./cloudflare-dns.sh setup${NC}

  3. Test configuration:
     ${YELLOW}./cloudflare-dns.sh test${NC}

  4. Check security status:
     ${YELLOW}./cloudflare-dns.sh status${NC}

${CYAN}Security Features:${NC}
  ✓ Edge-level DDoS protection (Cloudflare)
  ✓ WAF (Web Application Firewall) ready
  ✓ Rate limiting capable (configure in dashboard)
  ✓ SSL/TLS encryption (automatic)
  ✓ All services proxied by default (hide origin IPs)

${CYAN}Examples:${NC}
  ./cloudflare-dns.sh setup
  ./cloudflare-dns.sh list
  ./cloudflare-dns.sh create-cname test example.com true
  ./cloudflare-dns.sh get-id auth
  ./cloudflare-dns.sh test

${CYAN}Documentation:${NC}
  Setup Guide: docs/status/CLOUDFLARE_SETUP_PLAN.md
  Security: docs/status/SECURITY_HARDENING_PLAN.md

${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}
EOF
}

# ============================================================================
# MAIN SCRIPT LOGIC
# ============================================================================

# Parse command
case "${1:-help}" in
    # Ekklesia-specific commands
    setup)
        check_auth
        setup_all_services
        ;;
    teardown)
        check_auth
        teardown_all_services
        ;;
    test)
        check_auth
        test_endpoints
        ;;
    status)
        check_auth
        check_security_status
        ;;

    # DNS management commands
    list)
        check_auth
        get_zone_id "$DOMAIN"
        list_records
        ;;
    zone-info)
        check_auth
        get_zone_id "$DOMAIN"
        get_zone_info
        ;;
    create-cname)
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo "Usage: $0 create-cname <name> <target> [proxied]"
            echo "Example: $0 create-cname test example.com true"
            exit 1
        fi
        check_auth
        get_zone_id "$DOMAIN"
        create_cname_record "$2" "$3" "${4:-true}"
        ;;
    update)
        if [ -z "$2" ] || [ -z "$3" ] || [ -z "$4" ] || [ -z "$5" ]; then
            echo "Usage: $0 update <record-id> <type> <name> <content> [proxied]"
            exit 1
        fi
        check_auth
        get_zone_id "$DOMAIN"
        update_record "$2" "$3" "$4" "$5" "${6:-true}"
        ;;
    delete)
        if [ -z "$2" ]; then
            echo "Usage: $0 delete <record-id>"
            exit 1
        fi
        check_auth
        get_zone_id "$DOMAIN"
        delete_record "$2"
        ;;
    get-id)
        if [ -z "$2" ]; then
            echo "Usage: $0 get-id <name>"
            echo "Example: $0 get-id auth"
            exit 1
        fi
        check_auth
        get_zone_id "$DOMAIN"
        get_record_id "$2"
        ;;

    # Authentication commands
    load-token)
        load_token_from_gcp
        ;;

    # Help
    help|--help|-h|*)
        show_help
        ;;
esac
