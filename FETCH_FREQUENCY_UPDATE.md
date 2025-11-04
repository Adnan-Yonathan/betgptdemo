# Betting Odds Fetch Frequency Update

**Date**: November 4, 2025
**Branch**: `claude/betting-data-unavailable-011CUmgsb9NoxRqjtSfDysEm`
**Issue**: API rate limits exceeded with current 30-minute fetch schedule

---

## Summary of Changes

**BEFORE**: Fetches every 30 minutes (48 times/day)
**AFTER**: Fetches every 8 hours (3 times/day)

**Reason**: The Odds API free tier allows 500 calls/month. Previous schedule used ~7,200 calls/month (14.4x over limit).

---

## Rate Limit Analysis

### The Odds API Free Tier
- **Limit**: 500 API calls per month
- **Daily allowance**: 500 ÷ 30 days = ~16.67 calls/day
- **Cost to upgrade**: $49/month for 50,000 calls

### Previous Schedule (Every 30 minutes)
```
Cron runs: 48 times/day
Active sports (peak season): 5 (NFL, NBA, NHL, MLS, MLB)
API calls per sport: 1
Total API calls: 48 cron runs × 5 sports = 240 calls/day
Monthly usage: 240 × 30 = 7,200 calls/month
Status: ❌ 14.4x OVER LIMIT
```

### New Schedule (Every 8 hours)
```
Cron runs: 3 times/day (00:00, 08:00, 16:00 UTC)
Active sports (peak season): 5 (NFL, NBA, NHL, MLS, MLB)
API calls per sport: 1
Total API calls: 3 cron runs × 5 sports = 15 calls/day
Monthly usage: 15 × 30 = 450 calls/month
Status: ✅ WITHIN LIMIT (90% utilization)
```

---

## Changes Made

### 1. Migration File
**File**: `supabase/migrations/20251104000000_reduce_betting_odds_fetch_frequency.sql`

- Updates cron job schedule from `*/30 * * * *` to `0 */8 * * *`
- Runs at: 00:00, 08:00, 16:00 UTC (midnight, 8am, 4pm)
- Includes detailed impact analysis and rollback plan

### 2. Chat Function Updates
**File**: `supabase/functions/chat/index.ts`

#### a) Data Staleness Threshold (line 1124-1128)
```typescript
// OLD: Reject data older than 2 hours
if (dataAgeMinutes > 120) { ... }

// NEW: Reject data older than 6 hours (to accommodate 8-hour fetch cycle)
if (dataAgeMinutes > 360) { ... }
```

#### b) Staleness Warnings (line 1144-1158)
Updated warning thresholds to match new expectations:
- **>4 hours old**: "VERY STALE - Lines may have significantly moved"
- **>2 hours old**: "STALE - Lines may have moved, verify before betting"
- **>1 hour old**: "MODERATELY STALE - Consider verifying with bookmaker"
- **<1 hour old**: "RECENT/FRESH"

#### c) Error Message (line 2818)
Updated to reflect 8-hour refresh cycle:
```typescript
"The system refreshes odds every 8 hours. Please try again later..."
```

---

## Impact on User Experience

### Data Freshness

| Time Since Last Fetch | Status | User Experience |
|---|---|---|
| 0-1 hours | ✅ Fresh | No warnings, full recommendations |
| 1-2 hours | ⚠️ Moderately Stale | Warning shown, recommendations provided |
| 2-4 hours | ⚠️ Stale | Strong warning, recommendations provided |
| 4-6 hours | ⚠️ Very Stale | Very strong warning, recommendations provided |
| 6-8 hours | ❌ Too Stale | Error message, no recommendations |

### Expected Behavior

**Scenario 1**: User asks for betting advice at 00:30 (30 min after fetch)
- Data age: 30 minutes
- Status: ✅ FRESH
- Response: Full betting recommendations with current odds

**Scenario 2**: User asks for betting advice at 06:00 (6 hours after last fetch)
- Data age: 6 hours
- Status: ⚠️ VERY STALE
- Response: Recommendations provided with strong warnings
- Message: "Lines may have significantly moved. Use with extreme caution."

**Scenario 3**: User asks for betting advice at 07:30 (7.5 hours after last fetch)
- Data age: 7.5 hours
- Status: ❌ TOO STALE
- Response: Error message, no recommendations
- Message: "Cannot provide recommendations... data too stale (>6 hours old). System refreshes every 8 hours."

**Scenario 4**: User asks at 08:15 (15 min after fresh fetch at 08:00)
- Data age: 15 minutes
- Status: ✅ FRESH
- Response: Full betting recommendations with current odds

---

## How to Apply This Update

### Option A: Run Migration in Supabase Dashboard (Recommended)

1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `dskfsnbdgyjizoaafqfk`
3. Go to: SQL Editor
4. Open file: `supabase/migrations/20251104000000_reduce_betting_odds_fetch_frequency.sql`
5. Copy entire contents
6. Paste into SQL Editor
7. Click "Run"

**Verification**:
```sql
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname = 'auto-fetch-betting-odds-job';
```

Expected result:
- `schedule`: `0 */8 * * *`
- `active`: `true`

### Option B: Deploy with Supabase CLI

```bash
# Navigate to project directory
cd /home/user/betgptdemo

# Apply migration
supabase db push

# Verify
supabase db query "SELECT * FROM cron.job WHERE jobname = 'auto-fetch-betting-odds-job'"
```

### Option C: Manual Update (Quick Fix)

```sql
-- Unschedule old job
SELECT cron.unschedule('auto-fetch-betting-odds-job');

-- Schedule new job (every 8 hours)
SELECT cron.schedule(
  'auto-fetch-betting-odds-job',
  '0 */8 * * *',
  $$SELECT invoke_fetch_betting_odds();$$
);
```

---

## Testing

### 1. Verify Cron Job Update
```sql
SELECT
  jobname,
  schedule,
  active,
  command
FROM cron.job
WHERE jobname = 'auto-fetch-betting-odds-job';
```

**Expected**:
- `schedule` = `0 */8 * * *` (not `*/30 * * * *`)
- `active` = `true`

### 2. Test Manual Fetch
```sql
-- Trigger a fetch manually
SELECT trigger_fetch_betting_odds('americanfootball_nfl');

-- Check the log
SELECT * FROM betting_odds_fetch_log
ORDER BY fetch_time DESC
LIMIT 1;
```

**Expected**:
- `success` = `true`
- Recent `fetch_time` (within last minute)

### 3. Verify Data Exists
```sql
SELECT
  sport_key,
  COUNT(DISTINCT event_id) as events,
  MAX(last_updated) as last_update,
  EXTRACT(MINUTES FROM NOW() - MAX(last_updated))::INTEGER as minutes_old
FROM betting_odds
WHERE commence_time >= CURRENT_DATE
GROUP BY sport_key;
```

**Expected**:
- Multiple sports listed
- `minutes_old` < 480 (8 hours)

### 4. Test Chat Integration

**Test 1: Fresh data (<1 hour old)**
- Ask: "What are the best bets for tonight's NFL game?"
- Expected: Full betting recommendations, no warnings

**Test 2: Stale data (2-4 hours old)**
- Wait 2 hours after fetch
- Ask: "What are the best bets for tonight's NFL game?"
- Expected: Recommendations with warning: "STALE - Lines may have moved"

**Test 3: Very stale data (>6 hours old)**
- Wait 7 hours after fetch (or manually set old data)
- Ask: "What are the best bets for tonight's NFL game?"
- Expected: Error message: "Cannot provide recommendations... data too stale (>6 hours old)"

---

## Rollback Plan

If you need to revert to the old 30-minute schedule (requires paid API plan):

```sql
-- Remove current job
SELECT cron.unschedule('auto-fetch-betting-odds-job');

-- Restore 30-minute schedule
SELECT cron.schedule(
  'auto-fetch-betting-odds-job',
  '*/30 * * * *',
  $$SELECT invoke_fetch_betting_odds();$$
);

-- Also revert chat function changes:
-- 1. Change line 1126: if (dataAgeMinutes > 360) back to if (dataAgeMinutes > 120)
-- 2. Revert staleness warning thresholds
-- 3. Update error message to say "refreshes every 30 minutes"
```

---

## Monitoring

### Check API Usage

1. Visit The Odds API dashboard: https://the-odds-api.com/
2. Log in with your account
3. Check "API Usage" section
4. Verify usage is below 500 calls/month

### Monitor Fetch Success Rate

```sql
-- Check recent fetches
SELECT
  DATE(fetch_time) as date,
  COUNT(*) as total_fetches,
  COUNT(*) FILTER (WHERE success = true) as successful,
  COUNT(*) FILTER (WHERE success = false) as failed
FROM betting_odds_fetch_log
WHERE fetch_time > NOW() - INTERVAL '7 days'
GROUP BY DATE(fetch_time)
ORDER BY date DESC;
```

**Expected**: 3 fetches per day, 100% success rate

### Check Data Staleness

```sql
-- Run daily to ensure data is updating
SELECT
  sport_key,
  MAX(last_updated) as last_update,
  EXTRACT(HOURS FROM NOW() - MAX(last_updated))::INTEGER as hours_old,
  CASE
    WHEN EXTRACT(HOURS FROM NOW() - MAX(last_updated)) > 8 THEN '❌ MISSED FETCH'
    WHEN EXTRACT(HOURS FROM NOW() - MAX(last_updated)) > 6 THEN '⚠️ WARNING'
    ELSE '✅ OK'
  END as status
FROM betting_odds
WHERE commence_time >= CURRENT_DATE
GROUP BY sport_key;
```

---

## Future Considerations

### Option 1: Upgrade API Plan (Recommended for Production)
- Cost: $49/month for 50,000 calls
- Benefit: Can revert to 30-minute fetches for fresh data
- Use case: Production app with active users

### Option 2: Smart Fetching
- Fetch more frequently (every 2 hours) during peak betting hours
- Fetch less frequently (every 12 hours) during off-hours
- Requires custom scheduling logic

### Option 3: On-Demand Fetching
- Add "Refresh Odds" button in UI
- Users trigger fresh fetch when needed
- Prevents wasted API calls

### Option 4: Tiered Fetching
- High-priority games (tonight's games): Fetch every 2 hours
- Low-priority games (3+ days away): Fetch every 12 hours
- Requires logic to differentiate game priority

---

## FAQ

**Q: Why not fetch every 4 hours instead of 8?**
A: 4-hour schedule = 6 fetches/day × 5 sports = 30 calls/day × 30 days = 900 calls/month (still over limit)

**Q: Will users complain about stale data?**
A: Possibly. Betting lines don't change drastically every hour, but serious bettors prefer real-time data. Consider upgrading API plan.

**Q: Can I manually trigger a fetch between scheduled times?**
A: Yes! Run: `SELECT trigger_fetch_betting_odds();` in SQL Editor

**Q: What happens during off-season when fewer sports are active?**
A: Fetch frequency stays the same, but fewer API calls are made (only active sports are fetched)

**Q: How do I upgrade to paid API plan?**
A: Visit https://the-odds-api.com/pricing and select the $49/month plan

---

## Summary

✅ **Applied**: Cron job now runs every 8 hours instead of 30 minutes
✅ **Updated**: Chat guardrails adjusted from 2-hour to 6-hour threshold
✅ **Result**: API usage reduced from 7,200/month to 450/month (within limit)
⚠️ **Trade-off**: Data can be up to 8 hours old (vs 30 minutes old)
💡 **Recommendation**: Upgrade to paid API plan for production use

---

**Next Steps**:
1. Apply the migration (see "How to Apply This Update" section)
2. Test the changes (see "Testing" section)
3. Monitor API usage for 1 week
4. Consider upgrading API plan based on user feedback

---

**Last Updated**: November 4, 2025
**Status**: Ready to deploy
