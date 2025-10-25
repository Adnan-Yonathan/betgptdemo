#!/bin/bash

# Kalshi Integration Diagnostic Script
# Checks the status of Kalshi integration setup

echo "========================================"
echo "  KALSHI INTEGRATION DIAGNOSTIC TOOL"
echo "========================================"
echo ""

SUPABASE_URL="https://dskfsnbdgyjizoaafqfk.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRza2ZzbmJkZ3lqaXpvYWFmcWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4ODkwMTIsImV4cCI6MjA3NjQ2NTAxMn0.I9tilT4RzFlB21iy2xL7O2ttv_XDAfFNiMZbnzFTJlA"

# Check 1: Test Kalshi connection
echo "📡 Test 1: Checking Kalshi API Connection..."
CONNECTION_RESULT=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/test-kalshi-connection" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  --max-time 30)

if echo "$CONNECTION_RESULT" | grep -q "\"success\":true"; then
  echo "✅ Kalshi API connection successful"
  echo "$CONNECTION_RESULT" | jq '.results.tests' 2>/dev/null || echo "$CONNECTION_RESULT"
else
  echo "❌ Kalshi API connection failed"
  echo "Response: $CONNECTION_RESULT"
  echo ""
  echo "⚠️  This likely means Kalshi credentials are not configured."
  echo "   Please follow the setup guide in KALSHI_SETUP_GUIDE.md"
fi

echo ""

# Check 2: Check database for markets
echo "🗄️  Test 2: Checking Database for Kalshi Markets..."
DB_CHECK=$(curl -s "${SUPABASE_URL}/rest/v1/kalshi_markets?select=count&limit=1" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Prefer: count=exact" \
  --max-time 10)

if echo "$DB_CHECK" | grep -q "content-range"; then
  MARKET_COUNT=$(echo "$DB_CHECK" | grep -i "content-range" | sed 's/.*\///' | head -1)
  if [ -n "$MARKET_COUNT" ] && [ "$MARKET_COUNT" -gt 0 ]; then
    echo "✅ Found ${MARKET_COUNT} markets in database"
  else
    echo "⚠️  Database table exists but is EMPTY (0 markets)"
    echo "   You need to sync markets from Kalshi API"
    echo "   Run: curl -X POST \"${SUPABASE_URL}/functions/v1/fetch-kalshi-markets\" \\"
    echo "        -H \"apikey: ${SUPABASE_ANON_KEY}\""
  fi
else
  echo "❌ Unable to check database (may be network issue)"
  echo "Response: $DB_CHECK"
fi

echo ""

# Check 3: List edge functions
echo "⚙️  Test 3: Checking Edge Functions Configuration..."
if [ -d "supabase/functions" ]; then
  echo "✅ Edge functions directory exists"
  KALSHI_FUNCTIONS=$(ls supabase/functions/ | grep -i kalshi | wc -l)
  echo "   Found ${KALSHI_FUNCTIONS} Kalshi-related functions:"
  ls supabase/functions/ | grep -i kalshi | sed 's/^/   - /'
else
  echo "❌ Edge functions directory not found"
fi

echo ""

# Check 4: Check config.toml
echo "📋 Test 4: Checking Configuration..."
if [ -f "supabase/config.toml" ]; then
  echo "✅ config.toml exists"
  if grep -q "test-kalshi-connection" supabase/config.toml; then
    echo "   ✅ Kalshi functions configured in config.toml"
  else
    echo "   ⚠️  Kalshi functions may not be configured (check config.toml)"
  fi
else
  echo "❌ config.toml not found"
fi

echo ""

# Check 5: Check database migration
echo "🗃️  Test 5: Checking Database Migration..."
if [ -f "supabase/migrations/20251025000000_add_kalshi_tables.sql" ]; then
  echo "✅ Kalshi migration file exists"
  TABLE_COUNT=$(grep -c "CREATE TABLE" supabase/migrations/20251025000000_add_kalshi_tables.sql)
  echo "   Creates ${TABLE_COUNT} tables"
else
  echo "❌ Kalshi migration file not found"
fi

echo ""

# Summary
echo "========================================"
echo "  SUMMARY & RECOMMENDATIONS"
echo "========================================"
echo ""

if echo "$CONNECTION_RESULT" | grep -q "\"success\":true"; then
  if [ -n "$MARKET_COUNT" ] && [ "$MARKET_COUNT" -gt 0 ]; then
    echo "✅ KALSHI INTEGRATION IS FULLY OPERATIONAL"
    echo "   - API credentials configured"
    echo "   - ${MARKET_COUNT} markets in database"
    echo "   - Ready to use at /kalshi route"
  else
    echo "⚠️  PARTIALLY CONFIGURED"
    echo "   - API credentials are configured ✅"
    echo "   - But no market data synced yet ⚠️"
    echo ""
    echo "📝 NEXT STEP: Sync market data"
    echo "   Run this command:"
    echo "   curl -X POST \"${SUPABASE_URL}/functions/v1/fetch-kalshi-markets\" \\"
    echo "        -H \"apikey: ${SUPABASE_ANON_KEY}\""
  fi
else
  echo "❌ NOT CONFIGURED"
  echo "   Kalshi credentials are not set up in Supabase"
  echo ""
  echo "📝 NEXT STEPS:"
  echo "   1. Get Kalshi account credentials (email/password)"
  echo "   2. Set Supabase secrets:"
  echo "      - KALSHI_EMAIL"
  echo "      - KALSHI_PASSWORD"
  echo "      - OPENAI_API_KEY (for AI analysis)"
  echo "   3. Deploy edge functions"
  echo "   4. Sync market data"
  echo ""
  echo "   See KALSHI_SETUP_GUIDE.md for detailed instructions"
fi

echo ""
echo "For full setup guide, see: KALSHI_SETUP_GUIDE.md"
echo "========================================"
