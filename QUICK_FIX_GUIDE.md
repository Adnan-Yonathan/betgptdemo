# Quick Fix Guide: Betting Data Unavailable

**Problem**: "I cannot provide betting recommendations... data may be unavailable or too stale"

**Diagnosis Time**: 5-10 minutes
**Fix Time**: 5-30 minutes

---

## Step 1: Run SQL Diagnostic (5 minutes)

1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Select project: `dskfsnbdgyjizoaafqfk`
3. Go to: SQL Editor
4. Copy/paste this query:

```sql
-- QUICK DIAGNOSTIC
SELECT
  'Cron Job Status' as check_name,
  CASE
    WHEN COUNT(*) = 0 THEN '❌ NOT SCHEDULED'
    WHEN active = false THEN '❌ INACTIVE'
    ELSE '✅ ACTIVE'
  END as status
FROM cron.job
WHERE jobname LIKE '%betting%odds%'

UNION ALL

SELECT
  'Recent Fetches' as check_name,
  CASE
    WHEN COUNT(*) = 0 THEN '❌ NO FETCH LOGS'
    WHEN MAX(fetch_time) < NOW() - INTERVAL '1 hour' THEN '❌ STALE (>1h)'
    ELSE '✅ RECENT'
  END
FROM betting_odds_fetch_log
WHERE fetch_time > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'Betting Data' as check_name,
  CASE
    WHEN COUNT(*) = 0 THEN '❌ NO DATA'
    WHEN MAX(last_updated) < NOW() - INTERVAL '2 hours' THEN '❌ TOO STALE'
    WHEN MAX(last_updated) < NOW() - INTERVAL '1 hour' THEN '⚠️ STALE'
    ELSE '✅ FRESH'
  END
FROM betting_odds
WHERE commence_time >= CURRENT_DATE;
```

---

## Step 2: Identify The Problem

Look at the results above. The most common issues:

### Issue A: ❌ Cron Job NOT SCHEDULED or INACTIVE

**Quick Fix**:
```sql
-- Re-schedule the cron job
SELECT cron.schedule(
  'auto-fetch-betting-odds-job',
  '*/30 * * * *',
  $$SELECT invoke_fetch_betting_odds();$$
);

-- Verify it's active
SELECT * FROM cron.job WHERE jobname = 'auto-fetch-betting-odds-job';
```

### Issue B: ❌ NO FETCH LOGS or STALE FETCHES

**Likely cause**: Missing API keys

**Quick Fix**:
1. Go to: Settings → Edge Functions → Secrets
2. Check if these exist:
   - `THE_ODDS_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

3. If missing, add:
   - Get API key from: https://the-odds-api.com/ (free 500 calls/month)
   - Set `THE_ODDS_API_KEY` = your-api-key-here
   - Set `SUPABASE_URL` = https://dskfsnbdgyjizoaafqfk.supabase.co
   - Set `SUPABASE_SERVICE_ROLE_KEY` = (from Supabase settings)

4. Trigger manual fetch:
```sql
SELECT trigger_fetch_betting_odds('americanfootball_nfl');
```

5. Check result:
```sql
SELECT * FROM betting_odds_fetch_log
ORDER BY fetch_time DESC
LIMIT 1;
```

### Issue C: ❌ NO DATA or TOO STALE

**Quick Fix**:
```sql
-- Check for errors in fetch logs
SELECT
  fetch_time,
  sports_fetched,
  success,
  error_message
FROM betting_odds_fetch_log
ORDER BY fetch_time DESC
LIMIT 5;
```

**If you see errors**:
- `"API key not configured"` → Add `THE_ODDS_API_KEY` (see Issue B)
- `"429"` or `"rate limit"` → Upgrade API plan or reduce fetch frequency
- `"authentication"` → Check `SUPABASE_SERVICE_ROLE_KEY` is correct

**If no errors but no data**:
- May be off-season (normal for some sports)
- Check active sports:
```sql
SELECT * FROM get_active_sports_by_season();
```

---

## Step 3: Verify Fix

After applying fixes, verify data is flowing:

```sql
-- Should show recent data (<30 min old)
SELECT
  sport_key,
  COUNT(DISTINCT event_id) as events,
  MAX(last_updated) as last_update,
  EXTRACT(MINUTES FROM NOW() - MAX(last_updated))::INTEGER as minutes_old
FROM betting_odds
WHERE commence_time >= CURRENT_DATE
GROUP BY sport_key;
```

**Expected**: `minutes_old` should be <30

---

## Step 4: Test In Chat

1. Open your betting app
2. Ask: "What are the best bets for tonight's NFL game?"
3. You should get **betting recommendations** (not an error message)

---

## Still Not Working?

### Check API Quota

```bash
# Test The Odds API directly
curl "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?apiKey=YOUR_KEY&regions=us&markets=h2h"
```

**If response shows quota exceeded**:
- Free tier: 500 calls/month = 16.7 calls/day
- Current usage: 240 calls/day (way over!)
- **Solution**: Upgrade to paid tier ($49/month for 50k calls)

### Manual Fetch Test

```sql
-- This should return success = true
SELECT trigger_fetch_betting_odds('americanfootball_nfl');

-- Check what happened
SELECT * FROM betting_odds_fetch_log
ORDER BY fetch_time DESC
LIMIT 1;

-- Verify data arrived
SELECT COUNT(*) FROM betting_odds
WHERE sport_key = 'americanfootball_nfl'
AND last_updated > NOW() - INTERVAL '5 minutes';
```

---

## Quick Reference: Important Queries

### Check System Health
```sql
SELECT
  (SELECT COUNT(*) FROM betting_odds WHERE commence_time >= CURRENT_DATE) as total_odds,
  (SELECT EXTRACT(MINUTES FROM NOW() - MAX(last_updated))::INTEGER FROM betting_odds) as minutes_old,
  (SELECT COUNT(*) FILTER (WHERE success = true) FROM betting_odds_fetch_log WHERE fetch_time > NOW() - INTERVAL '24 hours') as successful_fetches,
  (SELECT active FROM cron.job WHERE jobname LIKE '%betting%odds%' LIMIT 1) as cron_active;
```

### Trigger Manual Fetch (All Sports)
```sql
SELECT trigger_fetch_betting_odds();
```

### Trigger Manual Fetch (Specific Sport)
```sql
SELECT trigger_fetch_betting_odds('americanfootball_nfl');
SELECT trigger_fetch_betting_odds('basketball_nba');
SELECT trigger_fetch_betting_odds('icehockey_nhl');
```

### View Recent Errors
```sql
SELECT * FROM betting_odds_fetch_log
WHERE success = false
ORDER BY fetch_time DESC
LIMIT 10;
```

### Check Data Freshness
```sql
SELECT
  sport_key,
  MAX(last_updated) as last_update,
  EXTRACT(MINUTES FROM NOW() - MAX(last_updated))::INTEGER as minutes_old,
  CASE
    WHEN EXTRACT(MINUTES FROM NOW() - MAX(last_updated)) > 120 THEN '❌ CRITICAL'
    WHEN EXTRACT(MINUTES FROM NOW() - MAX(last_updated)) > 60 THEN '⚠️ STALE'
    WHEN EXTRACT(MINUTES FROM NOW() - MAX(last_updated)) > 30 THEN '⚠️ MODERATE'
    ELSE '✅ FRESH'
  END as status
FROM betting_odds
WHERE commence_time >= CURRENT_DATE
GROUP BY sport_key;
```

---

## Need More Help?

See full diagnostic report: `BETTING_DATA_DIAGNOSTIC_REPORT.md`

Run comprehensive diagnostics:
- SQL: Copy/paste `BETTING_DATA_DIAGNOSIS.sql` into SQL Editor
- Bash: Run `./diagnose-betting-data.sh`

Deploy health check:
```bash
supabase functions deploy health-check-betting-odds
curl https://dskfsnbdgyjizoaafqfk.supabase.co/functions/v1/health-check-betting-odds
```

---

## Summary

**90% of cases**: Missing `THE_ODDS_API_KEY` in Supabase secrets

**Fix**: Add API key → Trigger manual fetch → Verify data appears → Test chat

**Time**: 10 minutes

---

**Last Updated**: November 3, 2025
