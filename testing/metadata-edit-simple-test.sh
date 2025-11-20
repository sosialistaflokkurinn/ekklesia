#!/bin/bash
# Simplified Comprehensive Testing for Metadata-Only Edit Feature
# Purpose: Find bugs before merge

TOKEN='eyJhbGciOiJSUzI1NiIsImtpZCI6IjM4MDI5MzRmZTBlZWM0NmE1ZWQwMDA2ZDE0YTFiYWIwMWUzNDUwODMiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiR3XDsHLDtsOwdXIgQXRsaSBKw7Nuc3NvbiIsImtlbm5pdGFsYSI6IjIwMDk3ODM1ODkiLCJyb2xlcyI6WyJtZW1iZXIiLCJzdXBlcnVzZXIiLCJhZG1pbiJdLCJlbWFpbCI6Imd1ZHJvZHVyQGdtYWlsLmNvbSIsInBob25lTnVtYmVyIjoiNzc1LTg0OTMiLCJpc01lbWJlciI6dHJ1ZSwiaXNzIjoiaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tL2Vra2xlc2lhLXByb2QtMTAtMjAyNSIsImF1ZCI6ImVra2xlc2lhLXByb2QtMTAtMjAyNSIsImF1dGhfdGltZSI6MTc2MzM4MDAzMywidXNlcl9pZCI6Ik5FNWU4R3B6ekJjanh1VEhXR3VKdFRmZXZQRDIiLCJzdWIiOiJORTVlOEdwenpCY2p4dVRIV0d1SnRUZmV2UEQyIiwiaWF0IjoxNzYzNDE1MDc3LCJleHAiOjE3NjM0MTg2NzcsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnt9LCJzaWduX2luX3Byb3ZpZGVyIjoiY3VzdG9tIn19.UH9IuYNT5t78Pte2w3gyznNb6Jw0hIP1UiAHLIOqE25ULP3-p_HkamlwbypDccDBOeZhos3F_g4bi-3pzF9y739lYCHVM2Fex4M-i4uJWtAzbPi5Zq82e4JauyFFuGM3AVhI3UlO_doRw-AK6mhhdVm4myzpmXjqnvHhA_OEJ7X69DRHzzSnk5GhxdS3Key7EdVJY9Lqg5l8-83d1PWbnlNxl2OBHo2kCrm9bQ9mm8yHQU36ALQ7t-JVoLFGrRp2gSdbXPjzCIEnJzzekNa8RswvAwpVRp8c25MGwaJ7-uIL3Y7QEOW_IVEYErMnTr2v-OufGj24JRyA9PHRXjC8Lg'
ELECTION_ID='45c984df-7b12-4acd-94c6-81d8a4d946d9'
API_URL='https://elections-service-521240388393.europe-west2.run.app'

PASS=0
FAIL=0

echo "============================================"
echo "METADATA-ONLY EDIT - COMPREHENSIVE TESTING"
echo "============================================"
echo ""

# Helper function
test_api() {
    local num=$1
    local name=$2
    local data=$3
    local expect_success=$4
    
    echo "TEST $num: $name"
    response=$(curl -s -w "\n%{http_code}" -X PATCH "${API_URL}/api/admin/elections/${ELECTION_ID}" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$data")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$expect_success" = "yes" ]; then
        if [ "$http_code" = "200" ]; then
            echo "✓ PASS (200 OK)"
            ((PASS++))
        else
            echo "✗ FAIL (got $http_code, expected 200)"
            echo "Response: $body"
            ((FAIL++))
        fi
    else
        if [ "$http_code" = "400" ] || [ "$http_code" = "401" ] || [ "$http_code" = "404" ]; then
            echo "✓ PASS (got $http_code as expected)"
            ((PASS++))
        else
            echo "✗ FAIL (got $http_code, expected 4xx)"
            echo "Response: $body"
            ((FAIL++))
        fi
    fi
    echo ""
}

# ===== POSITIVE TESTS =====
echo "SECTION 1: POSITIVE TESTS (Should Work)"
echo "========================================"
echo ""

test_api 1 "Edit title only" '{"title":"TEST 1: Title Only"}' "yes"
test_api 2 "Edit description only" '{"description":"TEST 2: Description"}' "yes"
test_api 3 "Edit both fields" '{"title":"TEST 3","description":"Both"}' "yes"
test_api 4 "Null description" '{"description":null}' "yes"
test_api 5 "Unicode emoji" '{"title":"🍕🎉💯"}' "yes"

# ===== NEGATIVE TESTS =====
echo "SECTION 2: NEGATIVE TESTS (Should Fail)"
echo "========================================"
echo ""

test_api 6 "Edit question (SHOULD FAIL)" '{"question":"Hack"}' "no"
test_api 7 "Edit answers (SHOULD FAIL)" '{"answers":[{"answer_text":"X","display_order":0}]}' "no"
test_api 8 "Edit voting_type (SHOULD FAIL)" '{"voting_type":"single-choice"}' "no"
test_api 9 "Edit max_selections (SHOULD FAIL)" '{"max_selections":99}' "no"
test_api 10 "Edit eligibility (SHOULD FAIL)" '{"eligibility":"all"}' "no"

# ===== EDGE CASES =====
echo "SECTION 3: EDGE CASES"
echo "========================================"
echo ""

test_api 11 "Empty title (SHOULD FAIL)" '{"title":""}' "no"
test_api 12 "Null title (SHOULD FAIL)" '{"title":null}' "no"
test_api 13 "Whitespace title (SHOULD FAIL)" '{"title":"   "}' "no"
test_api 14 "HTML/XSS" '{"title":"<script>alert(1)</script>"}' "yes"
test_api 15 "SQL injection" '{"title":"x; DROP TABLE elections; --"}' "yes"

# ===== RESTORE =====
echo "SECTION 4: CLEANUP"
echo "========================================"
echo ""

test_api 16 "Restore original" '{"title":"🍕 PIZZA PARTY","description":"UPPFÆRT LÝSING: Mikilvæg atkvæðagreiðsla um pizzuálegg. Þetta ræður málunum á stjórnfundi!"}' "yes"

# ===== SUMMARY =====
TOTAL=$((PASS + FAIL))
echo "============================================"
echo "SUMMARY: $PASS/$TOTAL tests passed"
echo "============================================"

if [ $FAIL -eq 0 ]; then
    echo "🎉 ALL TESTS PASSED!"
    exit 0
else
    echo "⚠️  $FAIL TESTS FAILED"
    exit 1
fi
