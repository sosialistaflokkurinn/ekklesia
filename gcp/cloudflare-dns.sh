#!/bin/bash
# Cloudflare DNS Management Helper Script
# Uses Cloudflare API v4

set -e

# Configuration
DOMAIN="si-xj.org"
ZONE_ID=""  # Will be fetched automatically
CF_API_TOKEN="${CF_API_TOKEN:-}"  # Set via environment variable

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if API token is set
if [ -z "$CF_API_TOKEN" ]; then
    echo -e "${RED}ERROR: CF_API_TOKEN environment variable not set${NC}"
    echo "Get your API token from: https://dash.cloudflare.com/profile/api-tokens"
    echo "Then run: export CF_API_TOKEN='your-token-here'"
    exit 1
fi

# Function to get Zone ID
get_zone_id() {
    local domain=$1
    ZONE_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=${domain}" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json" | jq -r '.result[0].id')

    if [ "$ZONE_ID" = "null" ] || [ -z "$ZONE_ID" ]; then
        echo -e "${RED}ERROR: Could not find zone for domain ${domain}${NC}"
        exit 1
    fi
    echo -e "${GREEN}Zone ID: ${ZONE_ID}${NC}"
}

# Function to list DNS records
list_records() {
    echo -e "${YELLOW}DNS Records for ${DOMAIN}:${NC}"
    curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json" | jq -r '.result[] | "\(.type)\t\(.name)\t\(.content)\t\(.proxied)"'
}

# Function to create A record
create_a_record() {
    local name=$1
    local ip=$2
    local proxied=${3:-false}

    echo -e "${YELLOW}Creating A record: ${name}.${DOMAIN} -> ${ip}${NC}"

    curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json" \
        --data "{\"type\":\"A\",\"name\":\"${name}\",\"content\":\"${ip}\",\"ttl\":1,\"proxied\":${proxied}}" | jq
}

# Function to create CNAME record
create_cname_record() {
    local name=$1
    local target=$2
    local proxied=${3:-false}

    echo -e "${YELLOW}Creating CNAME record: ${name}.${DOMAIN} -> ${target}${NC}"

    curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json" \
        --data "{\"type\":\"CNAME\",\"name\":\"${name}\",\"content\":\"${target}\",\"ttl\":1,\"proxied\":${proxied}}" | jq
}

# Function to update record
update_record() {
    local record_id=$1
    local type=$2
    local name=$3
    local content=$4
    local proxied=${5:-false}

    echo -e "${YELLOW}Updating ${type} record: ${name}${NC}"

    curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${record_id}" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json" \
        --data "{\"type\":\"${type}\",\"name\":\"${name}\",\"content\":\"${content}\",\"ttl\":1,\"proxied\":${proxied}}" | jq
}

# Function to delete record
delete_record() {
    local record_id=$1

    echo -e "${YELLOW}Deleting record ID: ${record_id}${NC}"

    curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${record_id}" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json" | jq
}

# Function to get record ID by name
get_record_id() {
    local name=$1
    local full_name="${name}.${DOMAIN}"

    curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?name=${full_name}" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json" | jq -r '.result[0].id'
}

# Main script
case "${1:-}" in
    list)
        get_zone_id "$DOMAIN"
        list_records
        ;;
    create-a)
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo "Usage: $0 create-a <name> <ip> [proxied]"
            echo "Example: $0 create-a auth 34.8.250.20 false"
            exit 1
        fi
        get_zone_id "$DOMAIN"
        create_a_record "$2" "$3" "${4:-false}"
        ;;
    create-cname)
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo "Usage: $0 create-cname <name> <target> [proxied]"
            echo "Example: $0 create-cname www example.com false"
            exit 1
        fi
        get_zone_id "$DOMAIN"
        create_cname_record "$2" "$3" "${4:-false}"
        ;;
    update)
        if [ -z "$2" ] || [ -z "$3" ] || [ -z "$4" ] || [ -z "$5" ]; then
            echo "Usage: $0 update <record-id> <type> <name> <content> [proxied]"
            exit 1
        fi
        get_zone_id "$DOMAIN"
        update_record "$2" "$3" "$4" "$5" "${6:-false}"
        ;;
    delete)
        if [ -z "$2" ]; then
            echo "Usage: $0 delete <record-id>"
            exit 1
        fi
        get_zone_id "$DOMAIN"
        delete_record "$2"
        ;;
    get-id)
        if [ -z "$2" ]; then
            echo "Usage: $0 get-id <name>"
            echo "Example: $0 get-id auth"
            exit 1
        fi
        get_zone_id "$DOMAIN"
        get_record_id "$2"
        ;;
    *)
        echo "Cloudflare DNS Management Tool"
        echo ""
        echo "Usage: $0 <command> [args]"
        echo ""
        echo "Commands:"
        echo "  list                              List all DNS records"
        echo "  create-a <name> <ip> [proxied]    Create A record"
        echo "  create-cname <name> <target> [p]  Create CNAME record"
        echo "  update <id> <type> <name> <val>   Update record"
        echo "  delete <record-id>                Delete record"
        echo "  get-id <name>                     Get record ID by name"
        echo ""
        echo "Examples:"
        echo "  $0 list"
        echo "  $0 create-a auth 34.8.250.20 false"
        echo "  $0 create-cname www example.com false"
        echo "  $0 get-id auth"
        echo ""
        echo "Setup:"
        echo "  1. Get API token: https://dash.cloudflare.com/profile/api-tokens"
        echo "  2. export CF_API_TOKEN='your-token-here'"
        echo "  3. Run commands"
        ;;
esac
