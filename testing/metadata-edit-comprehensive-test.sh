#!/bin/bash
# Comprehensive Testing Script for Metadata-Only Edit Feature
# Created: 2025-11-17
# Purpose: Find bugs and edge cases before feature merge

set -e

# Configuration
TOKEN='eyJhbGciOiJSUzI1NiIsImtpZCI6IjM4MDI5MzRmZTBlZWM0NmE1ZWQwMDA2ZDE0YTFiYWIwMWUzNDUwODMiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiR3XDsHLDtsOwdXIgQXRsaSBKw7Nuc3NvbiIsImtlbm5pdGFsYSI6IjIwMDk3ODM1ODkiLCJyb2xlcyI6WyJtZW1iZXIiLCJzdXBlcnVzZXIiLCJhZG1pbiJdLCJlbWFpbCI6Imd1ZHJvZHVyQGdtYWlsLmNvbSIsInBob25lTnVtYmVyIjoiNzc1LTg0OTMiLCJpc01lbWJlciI6dHJ1ZSwiaXNzIjoiaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tL2Vra2xlc2lhLXByb2QtMTAtMjAyNSIsImF1ZCI6ImVra2xlc2lhLXByb2QtMTAtMjAyNSIsImF1dGhfdGltZSI6MTc2MzM4MDAzMywidXNlcl9pZCI6Ik5FNWU4R3B6ekJjanh1VEhXR3VKdFRmZXZQRDIiLCJzdWIiOiJORTVlOEdwenpCY2p4dVRIV0d1SnRUZmV2UEQyIiwiaWF0IjoxNzYzNDE1MDc3LCJleHAiOjE3NjM0MTg2NzcsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnt9LCJzaWduX2luX3Byb3ZpZGVyIjoiY3VzdG9tIn19.UH9IuYNT5t78Pte2w3gyznNb6Jw0hIP1UiAHLIOqE25ULP3-p_HkamlwbypDccDBOeZhos3F_g4bi-3pzF9y739lYCHVM2Fex4M-i4uJWtAzbPi5Zq82e4JauyFFuGM3AVhI3UlO_doRw-AK6mhhdVm4myzpmXjqnvHhA_OEJ7X69DRHzzSnk5GhxdS3Key7EdVJY9Lqg5l8-83d1PWbnlNxl2OBHo2kCrm9bQ9mm8yHQU36ALQ7t-JVoLFGrRp2gSdbXPjzCIEnJzzekNa8RswvAwpVRp8c25MGwaJ7-uIL3Y7QEOW_IVEYErMnTr2v-OufGj24JRyA9PHRXjC8Lg'
ELECTION_ID='45c984df-7b12-4acd-94c6-81d8a4d946d9'
API_URL='https://elections-service-521240388393.europe-west2.run.app'

# Counters
PASS=0
FAIL=0
TOTAL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
run_test() {
    local test_num=$1
    local test_name=$2
    local method=$3
    local endpoint=$4
    local data=$5
    local expected_status=$6
    local expected_message=$7
    
    ((TOTAL++))
    
    echo ""
    echo -e "${YELLOW}TEST $test_num: $test_name${NC}"
    echo "Expected: HTTP $expected_status"
    
    # Make request
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "${API_URL}${endpoint}" \
            -H "Authorization: Bearer ${TOKEN}" \
            -H "Content-Type: application/json")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "${API_URL}${endpoint}" \
            -H "Authorization: Bearer ${TOKEN}" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    # Extract status code (last line)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    echo "Got: HTTP $http_code"
    
    # Check status code
    if [ "$http_code" = "$expected_status" ]; then
        # Check message if provided
        if [ -n "$expected_message" ]; then
            if echo "$body" | grep -q "$expected_message"; then
                echo -e "${GREEN}✓ PASS${NC}"
                ((PASS++))
            else
                echo -e "${RED}✗ FAIL - Status OK but message mismatch${NC}"
                echo "Expected message: $expected_message"
                echo "Got: $body" | head -c 200
                ((FAIL++))
            fi
        else
            echo -e "${GREEN}✓ PASS${NC}"
            ((PASS++))
        fi
    else
        echo -e "${RED}✗ FAIL - Status code mismatch${NC}"
        echo "Response: $body" | head -c 200
        ((FAIL++))
    fi
}

echo "============================================"
echo "METADATA-ONLY EDIT - COMPREHENSIVE TESTING"
echo "============================================"
echo "Election ID: $ELECTION_ID"
echo "Status: closed"
echo "Token expires: 1763418677"
echo ""

# ============================================
# SECTION 1: POSITIVE TESTS (Should Work)
# ============================================

echo ""
echo "===================================="
echo "SECTION 1: POSITIVE TESTS"
echo "===================================="

run_test 1 \
    "Edit title only (closed election)" \
    "PATCH" \
    "/api/admin/elections/${ELECTION_ID}" \
    '{"title":"TEST 1: Title Only Edit"}' \
    "200" \
    ""

run_test 2 \
    "Edit description only" \
    "PATCH" \
    "/api/admin/elections/${ELECTION_ID}" \
    '{"description":"TEST 2: Description only edit"}' \
    "200" \
    ""

run_test 3 \
    "Edit both title and description" \
    "PATCH" \
    "/api/admin/elections/${ELECTION_ID}" \
    '{"title":"TEST 3: Both Fields","description":"Testing both metadata fields"}' \
    "200" \
    ""

run_test 4 \
    "Empty description (null - should be allowed)" \
    "PATCH" \
    "/api/admin/elections/${ELECTION_ID}" \
    '{"description":null}' \
    "200" \
    ""

run_test 5 \
    "Unicode/emoji in title" \
    "PATCH" \
    "/api/admin/elections/${ELECTION_ID}" \
    '{"title":"TEST 5: 🍕🎉💯🚀⚡️🔥✨🌟 Unicode Test"}' \
    "200" \
    ""

# ============================================
# SECTION 2: NEGATIVE TESTS (Should Fail)
# ============================================

echo ""
echo "===================================="
echo "SECTION 2: NEGATIVE TESTS"
echo "===================================="

run_test 6 \
    "Try to edit question (SHOULD FAIL)" \
    "PATCH" \
    "/api/admin/elections/${ELECTION_ID}" \
    '{"question":"Hacked question?"}' \
    "400" \
    "Cannot modify question"

run_test 7 \
    "Try to edit answers (SHOULD FAIL)" \
    "PATCH" \
    "/api/admin/elections/${ELECTION_ID}" \
    '{"answers":[{"answer_text":"Hacked","display_order":0}]}' \
    "400" \
    "Cannot modify answers"

run_test 8 \
    "Try to edit voting_type (SHOULD FAIL)" \
    "PATCH" \
    "/api/admin/elections/${ELECTION_ID}" \
    '{"voting_type":"single-choice"}' \
    "400" \
    "Cannot modify voting_type"

run_test 9 \
    "Try to edit max_selections (SHOULD FAIL)" \
    "PATCH" \
    "/api/admin/elections/${ELECTION_ID}" \
    '{"max_selections":10}' \
    "400" \
    "Cannot modify max_selections"

run_test 10 \
    "Try to edit eligibility (SHOULD FAIL)" \
    "PATCH" \
    "/api/admin/elections/${ELECTION_ID}" \
    '{"eligibility":"all"}' \
    "400" \
    "Cannot modify eligibility"

run_test 11 \
    "Try multiple restricted fields (SHOULD FAIL)" \
    "PATCH" \
    "/api/admin/elections/${ELECTION_ID}" \
    '{"question":"X","voting_type":"single-choice","answers":[]}' \
    "400" \
    "Cannot modify"

# ============================================
# SECTION 3: EDGE CASES
# ============================================

echo ""
echo "===================================="
echo "SECTION 3: EDGE CASES"
echo "===================================="

run_test 12 \
    "Empty title (SHOULD FAIL - required field)" \
    "PATCH" \
    "/api/admin/elections/${ELECTION_ID}" \
    '{"title":""}' \
    "400" \
    ""

run_test 13 \
    "Very long title (1000 chars)" \
    "PATCH" \
    "/api/admin/elections/${ELECTION_ID}" \
    "{\"title\":\"$(python3 -c 'print("A"*1000)')\"}" \
    "200" \
    ""

run_test 14 \
    "HTML in title (XSS test)" \
    "PATCH" \
    "/api/admin/elections/${ELECTION_ID}" \
    '{"title":"TEST 14: <script>alert(1)</script>"}' \
    "200" \
    ""

run_test 15 \
    "SQL injection in title" \
    "PATCH" \
    "/api/admin/elections/${ELECTION_ID}" \
    "{\"title\":\"TEST 15: '; DROP TABLE elections; --\"}" \
    "200" \
    ""

run_test 16 \
    "Null title (SHOULD FAIL)" \
    "PATCH" \
    "/api/admin/elections/${ELECTION_ID}" \
    '{"title":null}' \
    "400" \
    ""

run_test 17 \
    "Only whitespace title (SHOULD FAIL)" \
    "PATCH" \
    "/api/admin/elections/${ELECTION_ID}" \
    '{"title":"   "}' \
    "400" \
    ""

# ============================================
# SECTION 4: AUTH & AUTHORIZATION TESTS
# ============================================

echo ""
echo "===================================="
echo "SECTION 4: AUTH TESTS"
echo "===================================="

run_test 18 \
    "Invalid election ID (SHOULD FAIL)" \
    "PATCH" \
    "/api/admin/elections/00000000-0000-0000-0000-000000000000" \
    '{"title":"Test"}' \
    "404" \
    ""

run_test 19 \
    "No authorization header (SHOULD FAIL)" \
    "PATCH" \
    "/api/admin/elections/${ELECTION_ID}" \
    "" \
    "401" \
    ""

# Invalid token test - requires modifying the curl command
echo ""
echo -e "${YELLOW}TEST 20: Invalid token (SHOULD FAIL)${NC}"
echo "Expected: HTTP 401 or 403"
response=$(curl -s -w "\n%{http_code}" -X PATCH \
    "${API_URL}/api/admin/elections/${ELECTION_ID}" \
    -H "Authorization: Bearer invalid_token_here" \
    -H "Content-Type: application/json" \
    -d '{"title":"Test"}' 2>&1)
http_code=$(echo "$response" | tail -n1)
echo "Got: HTTP $http_code"
if [[ "$http_code" == "401" || "$http_code" == "403" ]]; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASS++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAIL++))
fi
((TOTAL++))

# ============================================
# SECTION 5: RESTORE ORIGINAL DATA
# ============================================

echo ""
echo "===================================="
echo "SECTION 5: CLEANUP"
echo "===================================="

run_test 21 \
    "Restore original title" \
    "PATCH" \
    "/api/admin/elections/${ELECTION_ID}" \
    '{"title":"🍕 PIZZA PARTY"}' \
    "200" \
    ""

run_test 22 \
    "Restore original description" \
    "PATCH" \
    "/api/admin/elections/${ELECTION_ID}" \
    '{"description":"UPPFÆRT LÝSING: Mikilvæg atkvæðagreiðsla um pizzuálegg. Þetta ræður málunum á stjórnfundi!"}' \
    "200" \
    ""

# ============================================
# SUMMARY
# ============================================

echo ""
echo "============================================"
echo "TEST SUMMARY"
echo "============================================"
echo -e "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  SOME TESTS FAILED${NC}"
    exit 1
fi
