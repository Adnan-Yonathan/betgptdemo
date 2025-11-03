# Betting Data Diagnostic Report

**Date**: November 3, 2025
**Issue**: "I cannot provide betting recommendations... data may be unavailable or too stale"
**Branch**: `claude/betting-data-unavailable-011CUmgsb9NoxRqjtSfDysEm`

---

## Executive Summary

The error message you're seeing is **WORKING AS INTENDED** - it's a safety mechanism that prevents the AI from making betting recommendations when data is unavailable or stale (>2 hours old).

**The real problem**: The data pipeline that feeds betting odds into the database is not working correctly.

---

## What We've Discovered

### ✅ Working Correctly

1. **AI Guardrails** (supabase/functions/chat/index.ts:2800-2844)
   - System properly detects missing/stale data
   - Refuses to provide betting recommendations
   - Returns helpful error message to user

2. **Data Freshness Validation** (supabase/functions/chat/index.ts:1124-1127)
   - Rejects data older than 2 hours as too stale
   - Provides clear error messages about data age

3. **Edge Function Configuration**
   - fetch-betting-odds function exists and is deployed
   - Health check endpoint created and configured
   - CORS headers properly configured

### ❌ What's Broken

The betting odds data pipeline has stopped working. Here's the data flow and where it's failing:

```
Cron Job (every 30 min)           ← ❓ Is this running?
    ↓
invoke_fetch_betting_odds()       ← ❓ Is this executing?
    ↓
fetch-betting-odds edge function  ← ✅ Exists, but returns "Access denied"
    ↓
The Odds API / Rundown API        ← ❓ Are API keys configured?
    ↓
betting_odds table                ← ❓ Empty or stale?
    ↓
Chat function (fetchLiveOdds)     ← ✅ Working, but no data to retrieve
    ↓
User sees error message           ← ✅ Correct behavior given no data
```

---

## Root Cause Analysis

Based on the investigation, the most likely causes (in order of probability):

### 1. Missing or Invalid API Keys (MOST LIKELY)

**Evidence**:
- Testing the fetch-betting-odds endpoint returns "Access denied"
- Even with proper Supabase auth headers, endpoint denies access

**What to check**:
- Supabase Dashboard → Settings → Edge Functions → Secrets
- Look for these environment variables:
  - `THE_ODDS_API_KEY` (primary API)
  - `X_RAPID_APIKEY` (fallback API - The Rundown on RapidAPI)
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

**Expected behavior**:
- If `THE_ODDS_API_KEY` is set → uses The Odds API
- If not set but `X_RAPID_APIKEY` is set → uses Rundown API
- If neither is set → function logs error and returns 500

### 2. Cron Job Not Running

**Evidence**:
- Migration file exists: `supabase/migrations/20251023120000_setup_auto_fetch_betting_odds.sql`
- Cron job should be scheduled to run every 30 minutes
- If not running, data would become stale quickly

**What to check**:
Run this SQL query in Supabase SQL Editor:
```sql
SELECT * FROM cron.job WHERE jobname LIKE '%betting%odds%';
```

**Expected result**:
- Should show job named `auto-fetch-betting-odds-job`
- `active` column should be `true`
- `schedule` should be `*/30 * * * *` (every 30 minutes)

**If job doesn't exist or is inactive**:
- pg_cron extension may not be enabled
- Migration may not have run successfully
- Database may have been reset

### 3. API Rate Limits Exceeded

**Evidence**:
- The Odds API free tier: 500 calls/month = ~16.7 calls/day
- Current fetch schedule: Every 30 minutes × 5 sports (peak season) = 240 calls/day
- **This is 14x over the free tier limit!**

**What to check**:
```sql
SELECT * FROM betting_odds_fetch_log
WHERE error_message LIKE '%429%' OR error_message LIKE '%rate limit%'
ORDER BY fetch_time DESC
LIMIT 10;
```

**Expected behavior**:
- If API quota exhausted → fetches return 429 error
- Should fallback to Rundown API if configured

### 4. Database Table Empty or Stale

**Evidence**:
- User sees "data unavailable or too stale" message
- This happens when `betting_odds` table is empty OR data is >2 hours old

**What to check**:
```sql
SELECT
  sport_key,
  COUNT(DISTINCT event_id) as events,
  MAX(last_updated) as most_recent_update,
  EXTRACT(MINUTES FROM NOW() - MAX(last_updated))::INTEGER as minutes_old
FROM betting_odds
WHERE commence_time >= CURRENT_DATE
GROUP BY sport_key
ORDER BY MAX(last_updated) DESC;
```

**Expected result**:
- Should show recent data (<30 minutes old) for active sports
- If empty → pipeline has never run successfully
- If >120 minutes old → pipeline stopped working

---

## Diagnostic Tools Created

### 1. SQL Diagnostic Script
**File**: `BETTING_DATA_DIAGNOSIS.sql`

**How to use**:
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy/paste entire file
4. Run

**What it checks**:
- Cron job status and schedule
- Recent fetch logs (success/failure)
- Betting odds table freshness
- Active sports for current season
- Overall system health summary
- Recommended actions based on findings

### 2. Bash Diagnostic Script
**File**: `diagnose-betting-data.sh`

**How to use**:
```bash
# Set environment variables (if not in .env)
export SUPABASE_URL="https://dskfsnbdgyjizoaafqfk.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"

# Run diagnostic
./diagnose-betting-data.sh
```

**What it checks**:
- Environment configuration
- API endpoint accessibility
- Database queries via Supabase CLI
- Recent errors in logs

**Note**: Requires Supabase CLI for full functionality. Install with:
```bash
brew install supabase/tap/supabase
# or
npm install -g supabase
```

### 3. Health Check Endpoint
**File**: `supabase/functions/health-check-betting-odds/index.ts`

**How to deploy**:
```bash
supabase functions deploy health-check-betting-odds
```

**How to use**:
```bash
curl https://dskfsnbdgyjizoaafqfk.supabase.co/functions/v1/health-check-betting-odds
```

**What it returns**:
```json
{
  "status": "critical|degraded|healthy",
  "summary": {
    "canProvideBettingRecommendations": false,
    "dataFreshness": "120 minutes old",
    "eventsAvailable": 0,
    "bookmakersAvailable": 0
  },
  "issues": [
    "CRITICAL: Betting data is too stale"
  ],
  "recommendations": [
    "Check if API keys are configured",
    "Verify cron job is running"
  ]
}
```

---

## Immediate Action Items

### Priority 1: Check API Keys (5 minutes)

1. Log into Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to your project: `dskfsnbdgyjizoaafqfk`
3. Go to: Settings → Edge Functions → Secrets
4. Verify these secrets exist:
   - `THE_ODDS_API_KEY`
   - `SUPABASE_URL` (should be `https://dskfsnbdgyjizoaafqfk.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY`

**If missing**:
- Get API key from: https://the-odds-api.com/
- Free tier: 500 calls/month
- Or use RapidAPI for Rundown API: https://rapidapi.com/theoddsapi/api/the-rundown

### Priority 2: Check Cron Job Status (2 minutes)

Run in Supabase SQL Editor:
```sql
-- Check if job exists and is active
SELECT * FROM cron.job WHERE jobname LIKE '%betting%odds%';

-- Check recent runs
SELECT * FROM betting_odds_fetch_log
ORDER BY fetch_time DESC
LIMIT 10;
```

**If job doesn't exist**:
```sql
-- Re-run the setup migration
-- Copy/paste from: supabase/migrations/20251023120000_setup_auto_fetch_betting_odds.sql
```

### Priority 3: Manual Fetch Test (5 minutes)

After confirming API keys are set, trigger a manual fetch:

```sql
-- This will attempt to fetch odds for all active sports
SELECT trigger_fetch_betting_odds();

-- Or test a specific sport
SELECT trigger_fetch_betting_odds('americanfootball_nfl');
```

**Check results**:
```sql
SELECT * FROM betting_odds_fetch_log
ORDER BY fetch_time DESC
LIMIT 1;

-- If success = true, check the odds table
SELECT COUNT(*) as total_odds FROM betting_odds;
```

### Priority 4: Verify Data Availability (2 minutes)

```sql
-- Check what data exists
SELECT
  sport_key,
  COUNT(DISTINCT event_id) as events,
  COUNT(DISTINCT bookmaker) as bookmakers,
  MAX(last_updated) as newest_data,
  EXTRACT(MINUTES FROM NOW() - MAX(last_updated))::INTEGER as minutes_old
FROM betting_odds
WHERE commence_time >= CURRENT_DATE
GROUP BY sport_key;
```

**Expected**:
- Data should be <30 minutes old
- Should see multiple bookmakers (DraftKings, FanDuel, BetMGM, etc.)
- Should see upcoming games for active sports

---

## Long-term Fixes

### Fix 1: API Rate Limit Management

**Current problem**: 240 calls/day > 16.7 calls/day (free tier)

**Options**:

**A. Upgrade API Plan** (Recommended)
- The Odds API: $49/month for 50,000 calls
- Cost per fetch: ~$0.001 (very affordable)
- Reliable, well-documented

**B. Reduce Fetch Frequency**
- Change from every 30 minutes to every 60 minutes
- Reduces to 120 calls/day (still over limit)
- File to edit: `supabase/migrations/20251023120000_setup_auto_fetch_betting_odds.sql`
- Change: `'*/30 * * * *'` → `'0 * * * *'` (every hour)

**C. Smart Fetching**
- Only fetch 2 hours before game time
- Reduces calls by ~50%
- Requires logic changes

### Fix 2: Add Monitoring & Alerts

**Create alert system**:
```sql
-- Add to a new cron job (every 15 minutes)
CREATE OR REPLACE FUNCTION alert_stale_betting_data()
RETURNS void AS $$
DECLARE
  minutes_old INTEGER;
BEGIN
  SELECT EXTRACT(MINUTES FROM NOW() - MAX(last_updated))::INTEGER
  INTO minutes_old
  FROM betting_odds
  WHERE commence_time >= CURRENT_DATE;

  IF minutes_old IS NULL OR minutes_old > 60 THEN
    -- Send alert (could integrate with Slack, Discord, email, etc.)
    INSERT INTO system_alerts (alert_type, message, severity)
    VALUES (
      'STALE_BETTING_DATA',
      format('Betting odds data is %s minutes old', minutes_old),
      'HIGH'
    );
  END IF;
END;
$$ LANGUAGE plpgsql;
```

### Fix 3: Add Health Dashboard

Deploy the health check endpoint and create a simple dashboard:

```bash
# Deploy function
supabase functions deploy health-check-betting-odds

# Test it
curl https://dskfsnbdgyjizoaafqfk.supabase.co/functions/v1/health-check-betting-odds | jq
```

**Add to frontend** (optional):
```typescript
// Show system health in UI
const { data: health } = await fetch(
  'https://dskfsnbdgyjizoaafqfk.supabase.co/functions/v1/health-check-betting-odds'
).then(r => r.json());

if (health.status !== 'healthy') {
  showWarning('Betting data may be delayed');
}
```

---

## Testing Checklist

After implementing fixes, verify:

- [ ] API keys are configured in Supabase secrets
- [ ] Cron job is active: `SELECT * FROM cron.job WHERE active = true`
- [ ] Manual fetch works: `SELECT trigger_fetch_betting_odds()`
- [ ] Fetch logs show success: `SELECT * FROM betting_odds_fetch_log ORDER BY fetch_time DESC`
- [ ] Odds table has recent data: `SELECT MAX(last_updated) FROM betting_odds`
- [ ] Data is <30 minutes old: `SELECT EXTRACT(MINUTES FROM NOW() - MAX(last_updated)) FROM betting_odds`
- [ ] Health check returns "healthy": `curl .../health-check-betting-odds`
- [ ] Chat function provides betting recommendations (test with real query)
- [ ] No "data unavailable" error messages

---

## Expected Behavior After Fix

### ✅ Healthy System

**User asks**: "What are the best bets for tonight's NFL game?"

**System response**:
1. fetchLiveOdds queries `betting_odds` table
2. Finds data <30 minutes old ✓
3. Formats odds from multiple bookmakers
4. AI analyzes trends, injuries, matchups
5. Provides specific betting recommendations with current lines

**Example good response**:
> "Based on the current odds (updated 15 minutes ago), I recommend..."

### ❌ Broken System (Current State)

**User asks**: "What are the best bets for tonight's NFL game?"

**System response**:
1. fetchLiveOdds queries `betting_odds` table
2. Finds no data OR data >2 hours old ✗
3. Guardrail detects invalid data
4. Returns error message immediately (doesn't call AI)
5. User sees: "I apologize, but I cannot provide betting recommendations..."

---

## Files Created/Modified

### New Files
1. `BETTING_DATA_DIAGNOSIS.sql` - Comprehensive SQL diagnostics
2. `diagnose-betting-data.sh` - Bash diagnostic script
3. `supabase/functions/health-check-betting-odds/index.ts` - Health check endpoint
4. `BETTING_DATA_DIAGNOSTIC_REPORT.md` - This document

### Modified Files
1. `supabase/config.toml` - Added health-check-betting-odds function config

### Existing Files Referenced
1. `supabase/functions/chat/index.ts` - Chat function with guardrails
2. `supabase/functions/fetch-betting-odds/index.ts` - Betting odds fetcher
3. `supabase/migrations/20251023120000_setup_auto_fetch_betting_odds.sql` - Cron job setup
4. `BETTING_LINES_DEBUG_PLAN.md` - Original debug plan (still relevant)

---

## Next Steps

1. **Run the SQL diagnostic script** (BETTING_DATA_DIAGNOSIS.sql)
   - This will identify exactly what's broken
   - Should take 2-3 minutes

2. **Based on results, apply fixes**:
   - If API keys missing → Add them to Supabase secrets
   - If cron job inactive → Re-run migration or manually schedule
   - If rate limited → Upgrade API plan or reduce frequency
   - If data stale → Manually trigger fetch

3. **Deploy health check endpoint**:
   ```bash
   supabase functions deploy health-check-betting-odds
   ```

4. **Test end-to-end**:
   - Trigger manual fetch
   - Verify data appears in `betting_odds` table
   - Ask chat for betting recommendations
   - Should receive proper recommendations (not error message)

5. **Monitor ongoing**:
   - Check health endpoint daily
   - Review fetch logs weekly
   - Upgrade API plan if hitting rate limits

---

## Support

If issues persist after following this guide:

1. Check Supabase logs:
   - Dashboard → Logs → Edge Functions
   - Look for errors in `fetch-betting-odds` function

2. Review fetch log errors:
   ```sql
   SELECT * FROM betting_odds_fetch_log
   WHERE success = false
   ORDER BY fetch_time DESC;
   ```

3. Test API keys manually:
   ```bash
   # Test The Odds API
   curl "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?apiKey=YOUR_KEY&regions=us&markets=h2h,spreads,totals"
   ```

4. Contact support channels:
   - Supabase support: support@supabase.com
   - The Odds API support: support@the-odds-api.com

---

## Conclusion

**The error message is correct** - you legitimately don't have fresh betting data.

**The fix is straightforward**:
1. Configure API keys in Supabase
2. Ensure cron job is running
3. Verify data is flowing into the database

Once fixed, the system will automatically resume providing betting recommendations with current odds.

**Estimated time to fix**: 15-30 minutes (assuming you have API keys)

---

**Last Updated**: November 3, 2025
**Status**: Diagnostic complete, awaiting fixes
