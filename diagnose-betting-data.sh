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
THE_ODDS_API_KEY="${THE_ODDS_API_KEY:-}"
X_RAPID_APIKEY="${X_RAPID_APIKEY:-}"
THE_RUNDOWN_API="${THE_RUNDOWN_API:-}"

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

SUPABASE_CLI_AVAILABLE=0
REST_STATUS=""
REST_BODY=""

call_supabase_rest() {
  local path="$1"
  local url="${SUPABASE_URL}/rest/v1/${path}"

  set +e
  local response
  response=$(curl -sS -w "\n%{http_code}" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Accept: application/json" \
    "$url")
  local status="${response##*$'\n'}"
  REST_BODY="${response%$'\n'$status}"
  REST_STATUS="$status"
  set -e
}

check_supabase_cli() {
  if command -v supabase &> /dev/null; then
    SUPABASE_CLI_AVAILABLE=1
    print_success "Supabase CLI is installed"
  else
    SUPABASE_CLI_AVAILABLE=0
    print_warning "Supabase CLI not found"
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

# Check betting odds API secrets
if [ -n "$THE_ODDS_API_KEY" ]; then
  print_success "THE_ODDS_API_KEY is configured"
else
  print_warning "THE_ODDS_API_KEY not set (primary odds provider)"
fi

if [ -n "$X_RAPID_APIKEY" ] || [ -n "$THE_RUNDOWN_API" ]; then
  print_success "RapidAPI fallback key detected"
else
  print_warning "No RapidAPI fallback key set (configure X_RAPID_APIKEY or legacy THE_RUNDOWN_API)"
fi

check_supabase_cli

# ============================================================================
# SECTION 2: DATABASE QUERIES VIA SUPABASE CLI
# ============================================================================

print_section "SECTION 2: DATABASE DIAGNOSTICS"

if [ "$SUPABASE_CLI_AVAILABLE" -eq 1 ]; then
  if supabase status &> /dev/null; then
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
    print_warning "Supabase CLI is installed but not authenticated (supabase status failed)"
    echo "Please run: supabase login"
    echo "Then link project: supabase link --project-ref your-project-ref"
  fi
elif [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  print_warning "Supabase CLI not available – using REST API fallback queries"
  echo "Ensure SUPABASE_SERVICE_ROLE_KEY has database access for these checks."

  TODAY=$(date -u +%Y-%m-%d || echo "")

  echo ""
  echo "--- Cron Job Status (REST) ---"
  call_supabase_rest "cron.job?select=jobname,schedule,active,database&jobname=like.*betting*odds*"
  if [ "$REST_STATUS" = "200" ] || [ "$REST_STATUS" = "206" ]; then
    echo "$REST_BODY" | jq '.' 2>/dev/null || echo "$REST_BODY"
  else
    print_error "Failed to read cron job status via REST (HTTP $REST_STATUS)"
    echo "$REST_BODY"
  fi

  echo ""
  echo "--- Recent Fetch Logs (Last 10 via REST) ---"
  call_supabase_rest "betting_odds_fetch_log?select=fetch_time,sports_fetched,success,events_count,odds_count,error_message&order=fetch_time.desc&limit=10"
  if [ "$REST_STATUS" = "200" ] || [ "$REST_STATUS" = "206" ]; then
    echo "$REST_BODY" | jq 'map(.minutes_ago = (if .fetch_time then ((now - (.fetch_time | fromdateiso8601)) / 60 | floor) else null end))' 2>/dev/null || echo "$REST_BODY"
  else
    print_error "Failed to read fetch logs via REST (HTTP $REST_STATUS)"
    echo "$REST_BODY"
  fi

  echo ""
  echo "--- Data Freshness by Sport (REST) ---"
  if [ -n "$TODAY" ]; then
    call_supabase_rest "betting_odds?select=sport_key,events:count(event_id),most_recent_update:max(last_updated)&commence_time=gte.${TODAY}&group=sport_key&order=most_recent_update.desc"
  else
    call_supabase_rest "betting_odds?select=sport_key,events:count(event_id),most_recent_update:max(last_updated)&group=sport_key&order=most_recent_update.desc"
  fi
  if [ "$REST_STATUS" = "200" ] || [ "$REST_STATUS" = "206" ]; then
    echo "$REST_BODY" | jq 'map(.minutes_old = (if .most_recent_update then ((now - (.most_recent_update | fromdateiso8601)) / 60 | floor) else null end))' 2>/dev/null || echo "$REST_BODY"
  else
    print_error "Failed to read freshness summary via REST (HTTP $REST_STATUS)"
    echo "$REST_BODY"
  fi

  echo ""
  echo "--- Overall Health Status (REST) ---"
  if [ -n "$TODAY" ]; then
    call_supabase_rest "betting_odds?select=total_odds:count(*),unique_events:count.distinct(event_id),sports:count.distinct(sport_key),newest_data:max(last_updated)&commence_time=gte.${TODAY}"
  else
    call_supabase_rest "betting_odds?select=total_odds:count(*),unique_events:count.distinct(event_id),sports:count.distinct(sport_key),newest_data:max(last_updated)"
  fi
  if [ "$REST_STATUS" = "200" ] || [ "$REST_STATUS" = "206" ]; then
    if command -v jq &> /dev/null; then
      echo "$REST_BODY" | jq 'map(.minutes_old = (if .newest_data then ((now - (.newest_data | fromdateiso8601)) / 60 | floor) else null end))'
    else
      echo "$REST_BODY"
    fi
  else
    print_error "Failed to read overall status via REST (HTTP $REST_STATUS)"
    echo "$REST_BODY"
  fi

  echo ""
  echo "If jq is unavailable or REST calls fail, you can run equivalent SQL in the Supabase dashboard using BETTING_DATA_DIAGNOSIS.sql."
else
  print_warning "Cannot run Supabase diagnostics without CLI or service role key"
  echo "Install the CLI with: npm install -g supabase"
  echo "Or download from: https://supabase.com/docs/guides/cli"
  echo "Alternatively, set SUPABASE_SERVICE_ROLE_KEY to enable REST fallback queries."
fi

# ============================================================================
# SECTION 3: API ENDPOINT CHECKS
# ============================================================================

print_section "SECTION 3: API ENDPOINT CHECKS"

if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then

  # Test fetch-betting-odds endpoint
  echo "Testing fetch-betting-odds endpoint..."
  echo "Endpoint: ${SUPABASE_URL}/functions/v1/fetch-betting-odds"

  set +e
  response=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${SUPABASE_URL}/functions/v1/fetch-betting-odds" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"sport": "americanfootball_nfl"}' \
    --max-time 10)
  curl_status=$?
  set -e

  if [ $curl_status -ne 0 ]; then
    print_error "fetch-betting-odds endpoint request failed (curl exit code $curl_status)"
  else
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
    set +e
    full_response=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/fetch-betting-odds" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Content-Type: application/json" \
      -d '{"sport": "americanfootball_nfl"}' \
      --max-time 10)
    full_response_status=$?
    set -e
    if [ $full_response_status -ne 0 ]; then
      print_error "Failed to retrieve full response (curl exit code $full_response_status)"
    else
      echo "$full_response" | jq '.' 2>/dev/null || echo "$full_response"
    fi
  fi

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
echo "   - Fix: Confirm RapidAPI fallback (X_RAPID_APIKEY or THE_RUNDOWN_API) is configured"
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
