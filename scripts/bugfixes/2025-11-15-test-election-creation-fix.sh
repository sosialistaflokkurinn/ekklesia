#!/bin/bash

# Test Script for Election Creation Bug Fix
# Tests the fixes implemented for the "Failed to fetch" error

echo "=========================================="
echo "Election Creation Bug Fix - Test Suite"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test Results
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to run tests
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -n "Testing: $test_name ... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test 1: Check if backend is reachable
echo "1. Backend Connectivity Tests"
echo "------------------------------"

run_test "Elections Service Health Check" \
    "curl -s https://elections-service-ymzrguoifa-nw.a.run.app/health | grep -q 'healthy'"

run_test "CORS Headers Present" \
    "curl -s -I -X OPTIONS https://elections-service-ymzrguoifa-nw.a.run.app/api/admin/elections | grep -q 'access-control-allow'"

echo ""

# Test 2: Check if files were modified correctly
echo "2. Code Modification Tests"
echo "------------------------------"

run_test "Rate Limiter IPv6 Fix Applied" \
    "grep -q 'ipKeyGenerator' /home/gudro/Development/projects/ekklesia/services/elections/src/middleware/rateLimiter.js"

run_test "Frontend Timeout Added" \
    "grep -q 'AbortController' /home/gudro/Development/projects/ekklesia/apps/members-portal/admin-elections/js/election-create.js"

run_test "Frontend Retry Logic Added" \
    "grep -q 'fetchWithRetry' /home/gudro/Development/projects/ekklesia/apps/members-portal/admin-elections/js/election-create.js"

run_test "Enhanced Error Logging Added" \
    "grep -q 'Election Create.*Network error' /home/gudro/Development/projects/ekklesia/apps/members-portal/admin-elections/js/election-create.js"

echo ""

# Test 3: Check JavaScript Syntax
echo "3. JavaScript Syntax Tests"
echo "------------------------------"

if command -v node &> /dev/null; then
    run_test "Frontend JS Syntax Valid" \
        "node -c /home/gudro/Development/projects/ekklesia/apps/members-portal/admin-elections/js/election-create.js"
    
    run_test "Backend JS Syntax Valid" \
        "node -c /home/gudro/Development/projects/ekklesia/services/elections/src/middleware/rateLimiter.js"
else
    echo -e "${YELLOW}⚠ SKIP - Node.js not installed${NC}"
fi

echo ""

# Test 4: Verify Documentation
echo "4. Documentation Tests"
echo "------------------------------"

run_test "Bug Report Updated" \
    "grep -q 'RESOLVED' /home/gudro/Development/projects/ekklesia/docs/bugfixes/2025-11-15-admin-elections-failed-to-fetch.md"

run_test "Root Cause Documented" \
    "grep -q 'Network Timeout' /home/gudro/Development/projects/ekklesia/docs/bugfixes/2025-11-15-admin-elections-failed-to-fetch.md"

run_test "Fixes Documented" \
    "grep -q 'AbortController' /home/gudro/Development/projects/ekklesia/docs/bugfixes/2025-11-15-admin-elections-failed-to-fetch.md"

echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Next Steps:"
    echo "1. Deploy backend changes: cd services/elections && ./deploy.sh"
    echo "2. Deploy frontend changes: firebase deploy --only hosting"
    echo "3. Test election creation in Firefox and Chrome"
    echo "4. Monitor Cloud Logging for any new errors"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please review the output above.${NC}"
    exit 1
fi
