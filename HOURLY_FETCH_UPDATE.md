# Hourly Betting Odds Fetch Update

**Date**: November 4, 2025
**Branch**: `claude/betting-data-unavailable-011CUmgsb9NoxRqjtSfDysEm`
**Requirement**: Data must never be more than 1 hour old

---

## Summary of Changes

**Schedule**: Fetches every 1 hour (at the top of each hour)
**Data Freshness**: Maximum 60 minutes old
**API Usage**: 3,600 calls/month (requires paid plan)

---

## Rate Limit Analysis

### The Odds API Paid Tier Required
- **Free tier**: 500 calls/month (insufficient)
- **Paid tier**: $49/month for 50,000 calls ✅ **REQUIRED**
- **Link**: https://the-odds-api.com/pricing

### Hourly Schedule Calculation
```
Cron runs: 24 times/day (once per hour)
Active sports (peak season): 5 (NFL, NBA, NHL, MLS, MLB)
API calls per sport: 1
Total API calls: 24 cron runs × 5 sports = 120 calls/day
Monthly usage: 120 × 30 = 3,600 calls/month
Status: ✅ Within 50,000 limit (7% utilization)
```

---

## Changes Made

### 1. Migration File
**File**: `supabase/migrations/20251104000000_reduce_betting_odds_fetch_frequency.sql`

- Updates cron job schedule to `0 * * * *` (every hour at :00)
- Runs at: 00:00, 01:00, 02:00, 03:00, ... 23:00 UTC (24 times/day)
- **Critical**: Includes warning that paid API plan is required

### 2. Chat Function Updates
**File**: `supabase/functions/chat/index.ts`

#### a) Data Rejection Threshold (line 1124-1128)
```typescript
// Reject data older than 60 minutes (1 hour)
if (dataAgeMinutes > 60) {
  return `ERROR: Betting odds data is too stale (${dataAgeMinutes} minutes old)...`;
}
```

#### b) Staleness Warnings (line 1144-1156)
Adjusted for hourly fetch:
- **>45 min**: "STALE - Next update coming soon"
- **>30 min**: "MODERATELY STALE - Consider verifying"
- **15-30 min**: "RECENT"
- **<15 min**: "FRESH/VERY FRESH"

#### c) Error Message (line 2816)
Updated to reflect hourly refresh:
```typescript
"The system refreshes odds every hour. Please try again in a few minutes..."
```

---

## User Experience

### Data Freshness Guarantee
- **Maximum age**: 60 minutes
- **Typical age**: 0-30 minutes (most of the time)
- **Rejection**: Data >60 minutes old is rejected

### User Experience by Data Age

| Data Age | Status | User Experience |
|---|---|---|
| 0-5 min | ✅ Very Fresh | No warnings, excellent data |
| 5-15 min | ✅ Fresh | No warnings, full recommendations |
| 15-30 min | ✅ Recent | No warnings, full recommendations |
| 30-45 min | ⚠️ Moderately Stale | Minor warning, recommendations provided |
| 45-60 min | ⚠️ Stale | Warning shown, recommendations provided |
| >60 min | ❌ Too Stale | **Error message, no recommendations** |

### Example Scenarios

**Best Case**: User asks at 01:05 (5 min after 01:00 fetch)
- Data age: 5 minutes
- Response: ✅ "VERY FRESH - Full betting recommendations"

**Typical Case**: User asks at 01:35 (35 min after 01:00 fetch)
- Data age: 35 minutes
- Response: ⚠️ "MODERATELY STALE - Recommendations with minor warning"

**Worst Case**: User asks at 02:05 but fetch failed at 02:00
- Data age: 65 minutes (still using 01:00 data)
- Response: ❌ "Cannot provide recommendations... data too stale (>60 min)"

---

## Deployment Steps

### CRITICAL: Upgrade API Plan First!

**Before applying this migration, you MUST upgrade to the paid API plan:**

1. Visit: https://the-odds-api.com/pricing
2. Log in to your account
3. Select: **$49/month plan** (50,000 calls)
4. Complete payment
5. Verify your new quota in the dashboard

⚠️ **DO NOT proceed without upgrading** - the system will exceed free tier limits immediately.

### Step-by-Step Deployment

#### 1. Apply Migration (5 minutes)

**Option A: SQL Editor** (Recommended)
1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Select project: `dskfsnbdgyjizoaafqfk`
3. Go to: SQL Editor
4. Run this:

```sql
-- Update cron schedule to hourly
SELECT cron.unschedule('auto-fetch-betting-odds-job') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-fetch-betting-odds-job'
);

SELECT cron.schedule(
  'auto-fetch-betting-odds-job',
  '0 * * * *',
  $$SELECT invoke_fetch_betting_odds();$$
);

-- Verify
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname = 'auto-fetch-betting-odds-job';
```

**Expected Result**:
- `schedule`: `0 * * * *`
- `active`: `true`

**Option B: Copy Migration File**
1. Open: `supabase/migrations/20251104000000_reduce_betting_odds_fetch_frequency.sql`
2. Copy entire contents
3. Paste into Supabase SQL Editor
4. Run

#### 2. Deploy Chat Function (2 minutes)

```bash
cd /home/user/betgptdemo
supabase functions deploy chat
```

Or redeploy via Supabase Dashboard:
- Go to: Functions → chat → Deploy

#### 3. Test Manual Fetch (5 minutes)

```sql
-- Trigger a fetch manually
SELECT trigger_fetch_betting_odds('americanfootball_nfl');

-- Check the log (should show success = true)
SELECT * FROM betting_odds_fetch_log
ORDER BY fetch_time DESC
LIMIT 1;

-- Verify data arrived
SELECT
  COUNT(*) as total_odds,
  MAX(last_updated) as newest_data,
  EXTRACT(MINUTES FROM NOW() - MAX(last_updated))::INTEGER as minutes_old
FROM betting_odds
WHERE commence_time >= CURRENT_DATE;
```

**Expected**:
- `success` = `true`
- `minutes_old` < 5

#### 4. Test Chat Integration (5 minutes)

1. Open your betting app
2. Ask: "What are the best bets for tonight's NFL game?"
3. Should receive: Full betting recommendations (not error message)
4. Check data freshness indicator in response

---

## Testing Checklist

```sql
-- ✓ 1. Verify cron job schedule
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname = 'auto-fetch-betting-odds-job';
-- Expected: schedule = '0 * * * *', active = true

-- ✓ 2. Test manual fetch
SELECT trigger_fetch_betting_odds();
-- Expected: Returns success message

-- ✓ 3. Check fetch log
SELECT fetch_time, success, events_count, odds_count, error_message
FROM betting_odds_fetch_log
ORDER BY fetch_time DESC
LIMIT 5;
-- Expected: Recent entries with success = true

-- ✓ 4. Verify data freshness
SELECT
  sport_key,
  COUNT(DISTINCT event_id) as events,
  MAX(last_updated) as last_update,
  EXTRACT(MINUTES FROM NOW() - MAX(last_updated))::INTEGER as minutes_old
FROM betting_odds
WHERE commence_time >= CURRENT_DATE
GROUP BY sport_key;
-- Expected: minutes_old < 60 for all sports

-- ✓ 5. Check API usage (external)
-- Visit: https://the-odds-api.com/
-- Check: API Usage dashboard
-- Expected: ~120 calls/day, well under 50,000/month limit
```

---

## Monitoring

### Daily Monitoring
```sql
-- Check fetch success rate
SELECT
  DATE(fetch_time) as date,
  COUNT(*) as total_fetches,
  COUNT(*) FILTER (WHERE success = true) as successful,
  COUNT(*) FILTER (WHERE success = false) as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success = true) / COUNT(*), 2) as success_rate
FROM betting_odds_fetch_log
WHERE fetch_time > NOW() - INTERVAL '7 days'
GROUP BY DATE(fetch_time)
ORDER BY date DESC;
```

**Expected**: 24 fetches/day, 100% success rate

### Weekly Monitoring
```sql
-- Check data staleness over past week
SELECT
  DATE(created_at) as date,
  AVG(EXTRACT(MINUTES FROM created_at - last_updated))::INTEGER as avg_data_age_min,
  MAX(EXTRACT(MINUTES FROM created_at - last_updated))::INTEGER as max_data_age_min
FROM (
  SELECT
    NOW() as created_at,
    last_updated
  FROM betting_odds
  WHERE last_updated > NOW() - INTERVAL '7 days'
) sub
GROUP BY DATE(created_at);
```

**Expected**:
- Average age: 15-30 minutes
- Max age: <60 minutes

### API Usage Monitoring
1. Visit: https://the-odds-api.com/
2. Go to: Dashboard → API Usage
3. Check monthly usage
4. **Expected**: ~3,600 calls/month (7% of 50,000 limit)

---

## Troubleshooting

### Issue: Cron job not running every hour
```sql
-- Check job status
SELECT * FROM cron.job WHERE jobname = 'auto-fetch-betting-odds-job';
-- Should show schedule = '0 * * * *' and active = true

-- If not active or wrong schedule, re-run migration
SELECT cron.unschedule('auto-fetch-betting-odds-job');
SELECT cron.schedule('auto-fetch-betting-odds-job', '0 * * * *', $$SELECT invoke_fetch_betting_odds();$$);
```

### Issue: Data still >60 minutes old
```sql
-- Check recent fetch logs for errors
SELECT * FROM betting_odds_fetch_log
WHERE success = false
ORDER BY fetch_time DESC
LIMIT 10;

-- Common errors:
-- 1. "API key not configured" → Check Supabase secrets
-- 2. "429 rate limit" → Verify paid plan is active
-- 3. "Network timeout" → Temporary issue, should resolve
```

### Issue: Still hitting rate limits
```sql
-- Count API calls per day
SELECT
  DATE(fetch_time) as date,
  COUNT(*) as fetch_count,
  COUNT(*) * 5 as estimated_api_calls
FROM betting_odds_fetch_log
WHERE fetch_time > NOW() - INTERVAL '7 days'
GROUP BY DATE(fetch_time)
ORDER BY date DESC;

-- If >24 fetches/day, check for duplicate cron jobs
SELECT * FROM cron.job WHERE command LIKE '%betting%';
-- Should only show 1 job
```

### Issue: Chat still rejecting data
```sql
-- Check if chat function was deployed
-- Look at function deployment logs in Supabase Dashboard

-- Manual test: Check data age
SELECT
  MAX(last_updated) as newest_data,
  EXTRACT(MINUTES FROM NOW() - MAX(last_updated))::INTEGER as minutes_old
FROM betting_odds;

-- If minutes_old > 60, data is legitimately too old
-- If minutes_old < 60 but still getting errors, redeploy chat function
```

---

## Cost Analysis

### Monthly Costs
- **The Odds API**: $49/month
- **Supabase**: (existing costs, no change)
- **Total new cost**: $49/month

### Cost per Fetch
- Monthly fetches: 24/day × 30 days = 720 fetches
- Cost per fetch: $49 / 720 = $0.068 per fetch
- Cost per API call: $49 / 3,600 = $0.0136 per call

### Value Proposition
- **Benefit**: Data never more than 1 hour old
- **User experience**: Significantly better than stale data
- **Cost**: $49/month for professional-grade data freshness
- **ROI**: Essential for betting application credibility

---

## Comparison with Previous Schedules

| Schedule | Fetches/Day | API Calls/Month | Status | Data Age | Cost |
|---|---|---|---|---|---|
| Every 30 min | 48 | 7,200 | ❌ Over limit | 0-30 min | $0 (fails) |
| Every 8 hours | 3 | 450 | ✅ Free tier | 0-8 hours | $0 |
| **Every 1 hour** | **24** | **3,600** | ✅ **Paid tier** | **0-60 min** | **$49/mo** |

**Chosen**: Every 1 hour (optimal balance of freshness and cost)

---

## Rollback Plan

If you need to revert:

### Revert to 8-hour schedule (free tier):
```sql
SELECT cron.unschedule('auto-fetch-betting-odds-job');
SELECT cron.schedule('auto-fetch-betting-odds-job', '0 */8 * * *', $$SELECT invoke_fetch_betting_odds();$$);
```

Also revert chat function:
- Change line 1126: `> 60` back to `> 360`
- Revert staleness thresholds to 8-hour values
- Update error message to say "refreshes every 8 hours"

### Revert to 30-minute schedule:
```sql
SELECT cron.unschedule('auto-fetch-betting-odds-job');
SELECT cron.schedule('auto-fetch-betting-odds-job', '*/30 * * * *', $$SELECT invoke_fetch_betting_odds();$$);
```

---

## Success Criteria

✅ Cron job runs every hour (24 times/day)
✅ Fetch success rate >95%
✅ Data never >60 minutes old
✅ Chat provides betting recommendations without errors
✅ API usage <50,000 calls/month
✅ User experience: Fresh betting lines always available

---

## Next Steps

1. ✅ **Upgrade API plan** (https://the-odds-api.com/pricing)
2. ✅ **Apply migration** (run SQL in Supabase)
3. ✅ **Deploy chat function** (supabase functions deploy chat)
4. ✅ **Test thoroughly** (run testing checklist above)
5. ✅ **Monitor for 24 hours** (ensure fetches running hourly)
6. ✅ **Verify user experience** (test chat recommendations)

---

**Status**: ✅ Ready to deploy (after API upgrade)
**Cost**: $49/month
**Benefit**: Data guaranteed fresh (<60 min old)
**User Impact**: Excellent - always current betting lines
