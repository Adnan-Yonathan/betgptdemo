#!/bin/bash

# ============================================================================
# BETTING DATA PIPELINE DIAGNOSTIC SCRIPT (BASH VERSION)
# ============================================================================
# Purpose: Run diagnostic checks using Supabase CLI or curl
# Usage: ./diagnose-betting-data.sh
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

echo "============================================================================"
echo "BETTING DATA PIPELINE DIAGNOSTICS"
echo "============================================================================"
echo ""

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

print_section() {
  echo ""
  echo "============================================================================"
  echo "$1"
  echo "============================================================================"
  echo ""
}

print_error() {
  echo -e "${RED}❌ ERROR: $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
}

print_success() {
  echo -e "${GREEN}✅ SUCCESS: $1${NC}"
}

check_supabase_cli() {
  if command -v supabase &> /dev/null; then
    print_success "Supabase CLI is installed"
    return 0
  else
    print_warning "Supabase CLI not found"
    return 1
  fi
}

# ============================================================================
# SECTION 1: ENVIRONMENT CHECK
# ============================================================================

print_section "SECTION 1: ENVIRONMENT CHECK"

if [ -f "$SCRIPT_DIR/.env" ]; then
  print_success "Found .env file"
  source "$SCRIPT_DIR/.env"
elif [ -f "$SCRIPT_DIR/.env.local" ]; then
  print_success "Found .env.local file"
  source "$SCRIPT_DIR/.env.local"
else
  print_warning ".env file not found"
fi

if [ -z "$SUPABASE_URL" ]; then
  print_error "SUPABASE_URL not set"
  echo "Please set SUPABASE_URL environment variable or create .env file"
  echo "Example: export SUPABASE_URL=https://your-project.supabase.co"
  exit 1
else
  print_success "SUPABASE_URL is set: $SUPABASE_URL"
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  print_warning "SUPABASE_SERVICE_ROLE_KEY not set"
  echo "Some checks may fail without service role key"
  echo "Example: export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key"
else
  print_success "SUPABASE_SERVICE_ROLE_KEY is set"
fi

check_supabase_cli

# ============================================================================
# SECTION 2: DATABASE QUERIES VIA SUPABASE CLI
# ============================================================================

print_section "SECTION 2: DATABASE DIAGNOSTICS"

if command -v supabase &> /dev/null && supabase status &> /dev/null; then
  echo "Running diagnostic queries via Supabase CLI..."

  # Check cron job status
  echo ""
  echo "--- Cron Job Status ---"
  supabase db query <<SQL
SELECT
  jobname,
  schedule,
  active,
  database
FROM cron.job
WHERE jobname LIKE '%betting%odds%';
SQL

  # Check recent fetch logs
  echo ""
  echo "--- Recent Fetch Logs (Last 10) ---"
  supabase db query <<SQL
SELECT
  fetch_time,
  sports_fetched,
  success,
  events_count,
  odds_count,
  error_message,
  EXTRACT(MINUTES FROM NOW() - fetch_time)::INTEGER as minutes_ago
FROM betting_odds_fetch_log
ORDER BY fetch_time DESC
LIMIT 10;
SQL

  # Check data freshness
  echo ""
  echo "--- Data Freshness by Sport ---"
  supabase db query <<SQL
SELECT
  sport_key,
  COUNT(DISTINCT event_id) as events,
  MAX(last_updated) as most_recent_update,
  EXTRACT(MINUTES FROM NOW() - MAX(last_updated))::INTEGER as minutes_old
FROM betting_odds
WHERE commence_time >= CURRENT_DATE
GROUP BY sport_key
ORDER BY MAX(last_updated) DESC;
SQL

  # Overall health check
  echo ""
  echo "--- Overall Health Status ---"
  supabase db query <<SQL
SELECT
  COUNT(*) as total_odds,
  COUNT(DISTINCT event_id) as unique_events,
  COUNT(DISTINCT sport_key) as sports,
  MAX(last_updated) as newest_data,
  EXTRACT(MINUTES FROM NOW() - MAX(last_updated))::INTEGER as minutes_old
FROM betting_odds
WHERE commence_time >= CURRENT_DATE;
SQL

else
  print_warning "Cannot run Supabase CLI queries (CLI not available or not logged in)"
  echo "Please run: supabase login"
  echo "Then link project: supabase link --project-ref your-project-ref"
fi

# ============================================================================
# SECTION 3: API ENDPOINT CHECKS
# ============================================================================

print_section "SECTION 3: API ENDPOINT CHECKS"

if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then

  # Test fetch-betting-odds endpoint
  echo "Testing fetch-betting-odds endpoint..."
  echo "Endpoint: ${SUPABASE_URL}/functions/v1/fetch-betting-odds"

  response=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${SUPABASE_URL}/functions/v1/fetch-betting-odds" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"sport": "americanfootball_nfl"}' \
    --max-time 10)

  if [ "$response" = "200" ]; then
    print_success "fetch-betting-odds endpoint is accessible (HTTP 200)"
  elif [ "$response" = "000" ]; then
    print_error "fetch-betting-odds endpoint timed out or is unreachable"
  else
    print_warning "fetch-betting-odds endpoint returned HTTP $response"
  fi

  # Get full response for debugging
  echo ""
  echo "Full response from fetch-betting-odds:"
  curl -s -X POST "${SUPABASE_URL}/functions/v1/fetch-betting-odds" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"sport": "americanfootball_nfl"}' \
    --max-time 10 | jq '.' 2>/dev/null || echo "(Response not in JSON format or jq not installed)"

else
  print_warning "Skipping API checks (SUPABASE_SERVICE_ROLE_KEY not set)"
fi

# ============================================================================
# SECTION 4: LOG FILE ANALYSIS
# ============================================================================

print_section "SECTION 4: SUPABASE LOG ANALYSIS"

echo "To view Supabase function logs, run:"
echo "  supabase functions logs fetch-betting-odds"
echo ""
echo "Or check logs in Supabase Dashboard:"
echo "  ${SUPABASE_URL}/project/_/logs/edge-functions"

# ============================================================================
# SECTION 5: RECOMMENDATIONS
# ============================================================================

print_section "SECTION 5: DIAGNOSTIC SUMMARY & RECOMMENDATIONS"

echo "Based on the diagnostics above, check for these common issues:"
echo ""
echo "1. ❌ CRON JOB NOT ACTIVE"
echo "   - If cron.job shows active=false or no results"
echo "   - Fix: Run the migration file or manually schedule the job"
echo ""
echo "2. ❌ NO RECENT FETCHES"
echo "   - If fetch_time is >60 minutes ago or no logs exist"
echo "   - Fix: Check if THE_ODDS_API_KEY is set in Supabase secrets"
echo "   - Fix: Manually trigger: SELECT trigger_fetch_betting_odds();"
echo ""
echo "3. ❌ FETCH ERRORS IN LOGS"
echo "   - If error_message is not null and success=false"
echo "   - Check error_message for API authentication or rate limit errors"
echo "   - Fix: Verify API keys are valid and have quota remaining"
echo ""
echo "4. ❌ EMPTY BETTING_ODDS TABLE"
echo "   - If total_odds = 0"
echo "   - Fix: Check if games are scheduled (may be off-season)"
echo "   - Fix: Manually fetch: curl -X POST .../fetch-betting-odds"
echo ""
echo "5. ⚠️  STALE DATA (>60 MINUTES OLD)"
echo "   - If minutes_old > 60"
echo "   - This triggers the error message you're seeing"
echo "   - Fix: Investigate why cron job is not running successfully"
echo ""

print_section "NEXT STEPS"

echo "To continue diagnosis:"
echo ""
echo "1. Review the SQL diagnostic output above"
echo "2. Check Supabase Dashboard → Database → Table Editor → betting_odds_fetch_log"
echo "3. Check Supabase Dashboard → Settings → Edge Functions → Secrets for API keys"
echo "4. Run manual fetch test:"
echo "   SELECT trigger_fetch_betting_odds('americanfootball_nfl');"
echo ""
echo "5. For detailed SQL diagnostics, run the SQL script:"
echo "   cat BETTING_DATA_DIAGNOSIS.sql | supabase db query"
echo "   OR copy/paste BETTING_DATA_DIAGNOSIS.sql into Supabase SQL Editor"
echo ""

print_section "DIAGNOSIS COMPLETE"

echo "For more help, see:"
echo "  - BETTING_DATA_DIAGNOSIS.sql (comprehensive SQL diagnostics)"
echo "  - BETTING_LINES_DEBUG_PLAN.md (detailed fix plan)"
echo ""
