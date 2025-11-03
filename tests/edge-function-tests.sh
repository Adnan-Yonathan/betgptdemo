#!/bin/bash

# Edge Function Test Suite
# Tests all value-based Edge Functions to ensure they work correctly

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_URL="${SUPABASE_URL:-http://localhost:54321}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}"

if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}ERROR: SUPABASE_ANON_KEY environment variable not set${NC}"
    echo "Set it with: export SUPABASE_ANON_KEY=your_anon_key"
    exit 1
fi

echo "==================================="
echo "Edge Function Test Suite"
echo "==================================="
echo ""

TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to test an endpoint
test_endpoint() {
    local name=$1
    local endpoint=$2
    local method=$3
    local data=$4
    local expect_success=$5

    echo -e "${YELLOW}Testing: $name${NC}"

    response=$(curl -s -w "\n%{http_code}" -X $method \
        "$SUPABASE_URL/functions/v1/$endpoint" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        -H "Content-Type: application/json" \
        -d "$data")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$expect_success" = true ]; then
        if [ "$http_code" = "200" ]; then
            echo -e "${GREEN}✓ PASS${NC} - HTTP $http_code"
            echo "Response: $body" | head -c 200
            echo ""
            ((TESTS_PASSED++))
        else
            echo -e "${RED}✗ FAIL${NC} - HTTP $http_code (expected 200)"
            echo "Response: $body"
            ((TESTS_FAILED++))
        fi
    else
        if [ "$http_code" != "200" ]; then
            echo -e "${GREEN}✓ PASS${NC} - HTTP $http_code (expected error)"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}✗ FAIL${NC} - HTTP $http_code (expected error)"
            ((TESTS_FAILED++))
        fi
    fi
    echo ""
}

echo "-----------------------------------"
echo "1. Testing generate-value-insights"
echo "-----------------------------------"
echo ""

# Test with valid event ID (will need to be updated with real event_id)
test_endpoint \
    "Value insights with valid eventId" \
    "generate-value-insights" \
    "POST" \
    '{"eventId": "test_event_123"}' \
    true

# Test with missing eventId
test_endpoint \
    "Value insights with missing eventId" \
    "generate-value-insights" \
    "POST" \
    '{}' \
    false

echo "-----------------------------------"
echo "2. Testing get-team-trends"
echo "-----------------------------------"
echo ""

# Test with valid team and league
test_endpoint \
    "Team trends with valid params" \
    "get-team-trends" \
    "POST" \
    '{"team": "Lakers", "league": "NBA", "limit": 10}' \
    true

# Test with missing team
test_endpoint \
    "Team trends with missing team" \
    "get-team-trends" \
    "POST" \
    '{"league": "NBA"}' \
    false

# Test with missing league
test_endpoint \
    "Team trends with missing league" \
    "get-team-trends" \
    "POST" \
    '{"team": "Lakers"}' \
    false

echo "-----------------------------------"
echo "3. Testing analyze-odds-discrepancies"
echo "-----------------------------------"
echo ""

# Test with no filters
test_endpoint \
    "Odds discrepancies with no filters" \
    "analyze-odds-discrepancies" \
    "POST" \
    '{}' \
    true

# Test with sport filter
test_endpoint \
    "Odds discrepancies with sport filter" \
    "analyze-odds-discrepancies" \
    "POST" \
    '{"sport": "americanfootball_nfl"}' \
    true

echo "-----------------------------------"
echo "4. Testing get-game-insights"
echo "-----------------------------------"
echo ""

# Test with valid event ID
test_endpoint \
    "Game insights with valid eventId" \
    "get-game-insights?eventId=test_event_123" \
    "GET" \
    '' \
    true

# Test with missing eventId
test_endpoint \
    "Game insights with missing eventId" \
    "get-game-insights" \
    "GET" \
    '' \
    false

echo "-----------------------------------"
echo "5. Testing detect-alerts"
echo "-----------------------------------"
echo ""

# Test detect alerts (no params needed)
test_endpoint \
    "Detect alerts" \
    "detect-alerts" \
    "POST" \
    '{}' \
    true

echo "-----------------------------------"
echo "6. Testing detect-sharp-money"
echo "-----------------------------------"
echo ""

# Test detect sharp money (no params needed)
test_endpoint \
    "Detect sharp money" \
    "detect-sharp-money" \
    "POST" \
    '{}' \
    true

echo "==================================="
echo "Test Results Summary"
echo "==================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
