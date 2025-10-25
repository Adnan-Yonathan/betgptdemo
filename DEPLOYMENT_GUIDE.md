# BALLDONTLIE Integration - Deployment Guide

**Version:** 1.0
**Date:** October 24, 2025
**Estimated Time:** 30 minutes

---

## 🎯 Quick Start Checklist

```bash
✅ Step 1: Verify API Key (2 min)
✅ Step 2: Deploy Edge Functions (5 min)
✅ Step 3: Run Database Migration (3 min)
✅ Step 4: Test Integration (10 min)
✅ Step 5: Enable Feature Flag (2 min)
✅ Step 6: Monitor & Verify (ongoing)
```

---

## Step 1: Verify BALLDONTLIE API Key (2 minutes)

### Check Local Environment

```bash
# Check if API key exists
echo $BALLDONTLIE_API_KEY
# OR
echo $BALLDONTLIE_API

# Should output: 29e15893-491c-4782-9193-703843ab7211 (or your key)
```

### Check Supabase Secrets

```bash
# List Supabase secrets
npx supabase secrets list

# Should see:
# BALLDONTLIE_API_KEY (or BALLDONTLIE_API)
```

### Add API Key if Missing

```bash
# Set in Supabase (production)
npx supabase secrets set BALLDONTLIE_API_KEY=29e15893-491c-4782-9193-703843ab7211

# Set in .env.local (development)
echo "VITE_BALLDONTLIE_API_KEY=29e15893-491c-4782-9193-703843ab7211" >> .env.local
```

### Test API Access

```bash
# Test with curl (check authentication format)
curl -H "Authorization: 29e15893-491c-4782-9193-703843ab7211" \
  "https://api.balldontlie.io/v1/teams?per_page=1"

# Should return JSON with NBA teams
# If "Access denied", try different auth format (see notes below)
```

**Note on Authentication:**
BALLDONTLIE API may use different auth formats:
- Header: `Authorization: YOUR_KEY`
- Query param: `?api_key=YOUR_KEY`
- Bearer: `Authorization: Bearer YOUR_KEY`

Test which format works and update edge functions accordingly.

---

## Step 2: Deploy Edge Functions (5 minutes)

### Deploy fetch-balldontlie-stats

```bash
# Navigate to project root
cd /home/user/betgptdemo

# Deploy the function
npx supabase functions deploy fetch-balldontlie-stats

# Expected output:
# ✓ Deployed function fetch-balldontlie-stats
```

### Deploy sync-balldontlie-daily

```bash
# Deploy daily sync function
npx supabase functions deploy sync-balldontlie-daily

# Expected output:
# ✓ Deployed function sync-balldontlie-daily
```

### Verify Deployment

```bash
# List deployed functions
npx supabase functions list

# Should see:
# - fetch-balldontlie-stats
# - sync-balldontlie-daily
# (Plus your existing functions)
```

---

## Step 3: Run Database Migration (3 minutes)

### Apply Migration

```bash
# Run the migration
npx supabase db push

# OR if using migration files:
npx supabase migration up

# Expected output:
# ✓ Applied migration 20251024_balldontlie_integration
```

### Verify Schema Changes

```sql
-- Connect to your database and run:

-- Check data_source column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'player_performance_history'
  AND column_name = 'data_source';

-- Should return:
-- column_name | data_type | column_default
-- data_source | text      | 'espn'

-- Check new tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('api_source_log', 'balldontlie_sync_log');

-- Should return both table names

-- Check cron job was created
SELECT jobname, schedule, command
FROM cron.job
WHERE jobname = 'balldontlie-daily-sync';

-- Should return:
-- jobname                  | schedule      | command
-- balldontlie-daily-sync  | 0 3 * * *     | SELECT invoke_balldontlie_daily_sync();
```

---

## Step 4: Test Integration (10 minutes)

### Test 1: Fetch Stats for a Specific Date

```bash
# Test fetching stats for a recent date (use a date with NBA games)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/fetch-balldontlie-stats \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-12-15",
    "store_data": false
  }'

# Expected response:
# {
#   "success": true,
#   "date": "2024-12-15",
#   "stats_count": 200+,
#   "source": "BALLDONTLIE",
#   ...
# }
```

### Test 2: Store Stats in Database

```bash
# Same request but with store_data: true
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/fetch-balldontlie-stats \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-12-15",
    "store_data": true
  }'

# Expected response:
# {
#   "success": true,
#   "stats_count": 200,
#   "stored_count": 200,
#   ...
# }
```

### Test 3: Verify Data in Database

```sql
-- Check if stats were stored
SELECT COUNT(*), data_source
FROM player_performance_history
WHERE game_date = '2024-12-15'
  AND data_source = 'balldontlie'
GROUP BY data_source;

-- Should return:
-- count | data_source
-- 200+  | balldontlie

-- Check sample data
SELECT player_name, team, points, rebounds, assists, data_source
FROM player_performance_history
WHERE game_date = '2024-12-15'
  AND data_source = 'balldontlie'
LIMIT 5;
```

### Test 4: Test Daily Sync Function

```bash
# Manually trigger daily sync
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/sync-balldontlie-daily \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_date": "2024-12-15"
  }'

# Expected response:
# {
#   "success": true,
#   "sync_date": "2024-12-15",
#   "total_games": 10,
#   "completed_games": 10,
#   "successful_syncs": 10,
#   ...
# }
```

### Test 5: Check API Health

```sql
-- Run health check query
SELECT * FROM get_api_health_stats('balldontlie', 24);

-- Should return:
-- source       | total_requests | success_rate | avg_response_time | ...
-- balldontlie  | 5              | 100.00       | 450               | ...
```

---

## Step 5: Enable Feature Flag (2 minutes)

### Set Environment Variables

```bash
# Enable BALLDONTLIE (Supabase production)
npx supabase secrets set VITE_ENABLE_BALLDONTLIE=true

# Start with 10% rollout
npx supabase secrets set VITE_BALLDONTLIE_ROLLOUT=10

# Local development (.env.local)
echo "VITE_ENABLE_BALLDONTLIE=true" >> .env.local
echo "VITE_BALLDONTLIE_ROLLOUT=10" >> .env.local
```

### Gradual Rollout Schedule

```bash
# Day 1-2: 10% of users
VITE_BALLDONTLIE_ROLLOUT=10

# Day 3-4: 50% of users
npx supabase secrets set VITE_BALLDONTLIE_ROLLOUT=50

# Day 5+: 100% of users (full rollout)
npx supabase secrets set VITE_BALLDONTLIE_ROLLOUT=100
```

### Verify Feature Flag

```typescript
// In browser console or component:
console.log('BALLDONTLIE enabled:', import.meta.env.VITE_ENABLE_BALLDONTLIE);
console.log('Rollout %:', import.meta.env.VITE_BALLDONTLIE_ROLLOUT);
```

---

## Step 6: Monitor & Verify (Ongoing)

### Dashboard Queries

```sql
-- 1. API Health Dashboard (last 24 hours)
SELECT * FROM get_api_health_stats(NULL, 24)
ORDER BY source;

-- 2. Data Source Usage (last 30 days)
SELECT * FROM v_data_source_usage;

-- 3. Recent Sync Logs
SELECT *
FROM balldontlie_sync_log
ORDER BY created_at DESC
LIMIT 10;

-- 4. Recent API Errors
SELECT source, endpoint, error_message, created_at
FROM api_source_log
WHERE success = false
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 5. Check Stats Freshness
SELECT * FROM check_stats_freshness('balldontlie', 24);
```

### Expected Metrics

| Metric | Target | Action if Below |
|--------|--------|----------------|
| Success Rate | >95% | Check API key, logs |
| Avg Response Time | <500ms | Check network, caching |
| Daily Sync Success | 100% | Check cron job, logs |
| Data Freshness | <24 hours | Run manual sync |
| Cache Hit Rate | >70% | Check TTL settings |

### Alert Setup

```sql
-- Create alert function (optional)
CREATE OR REPLACE FUNCTION check_api_health_alerts()
RETURNS TABLE(
  alert_type TEXT,
  message TEXT,
  severity TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if BALLDONTLIE success rate < 95%
  RETURN QUERY
  SELECT
    'low_success_rate' AS alert_type,
    'BALLDONTLIE success rate below 95%: ' || success_rate::TEXT || '%' AS message,
    'WARNING' AS severity
  FROM get_api_health_stats('balldontlie', 24)
  WHERE success_rate < 95;

  -- Check if no recent syncs
  RETURN QUERY
  SELECT
    'no_recent_sync' AS alert_type,
    'No BALLDONTLIE sync in last 48 hours' AS message,
    'CRITICAL' AS severity
  WHERE NOT EXISTS (
    SELECT 1
    FROM balldontlie_sync_log
    WHERE created_at >= NOW() - INTERVAL '48 hours'
  );
END;
$$;

-- Run alerts check
SELECT * FROM check_api_health_alerts();
```

---

## Troubleshooting

### Issue 1: "Access denied" from BALLDONTLIE API

**Symptoms:**
```json
{
  "error": "BALLDONTLIE API error: 403 - Access denied",
  "success": false
}
```

**Solutions:**

1. Verify API key is set correctly:
```bash
npx supabase secrets list | grep BALLDONTLIE
```

2. Test different authentication formats:
```typescript
// Try these in edge function:
// Option A: Authorization header
headers: { 'Authorization': API_KEY }

// Option B: Bearer token
headers: { 'Authorization': `Bearer ${API_KEY}` }

// Option C: Query parameter
url.searchParams.append('api_key', API_KEY);
```

3. Check API key validity:
   - Visit https://www.balldontlie.io/
   - Log in to your account
   - Verify API key is active
   - Check usage quota

### Issue 2: No Data Returned

**Symptoms:**
```json
{
  "success": true,
  "stats_count": 0,
  "stored_count": 0
}
```

**Solutions:**

1. Check the date has NBA games:
```bash
# Use a date during NBA season (Oct - June)
# Try a recent date: 2024-12-15
```

2. Verify API response:
```bash
curl -H "Authorization: YOUR_KEY" \
  "https://api.balldontlie.io/v1/games?dates[]=2024-12-15"
```

3. Check if games are completed:
```typescript
// Only completed games have stats
game.status === 'Final' || game.status === 'F'
```

### Issue 3: Daily Sync Not Running

**Symptoms:**
- No new data appearing automatically
- `balldontlie_sync_log` table empty

**Solutions:**

1. Check cron job exists:
```sql
SELECT * FROM cron.job WHERE jobname = 'balldontlie-daily-sync';
```

2. Check cron job is active:
```sql
SELECT active FROM cron.job WHERE jobname = 'balldontlie-daily-sync';
-- Should return: true
```

3. Manually trigger sync:
```sql
SELECT invoke_balldontlie_daily_sync();
```

4. Check cron logs:
```sql
SELECT * FROM cron.job_run_details
WHERE jobname = 'balldontlie-daily-sync'
ORDER BY start_time DESC
LIMIT 5;
```

### Issue 4: Slow Performance

**Symptoms:**
- Response times > 1000ms
- Timeouts

**Solutions:**

1. Check cache hit rate:
```typescript
import { getCacheStats } from '@/utils/unifiedStatsService';
console.log(getCacheStats());
// Target: >70% hit rate
```

2. Enable caching if disabled:
```bash
# In edge function, ensure:
ENABLE_CACHING = true
```

3. Optimize database queries:
```sql
-- Check if indexes exist
SELECT indexname FROM pg_indexes
WHERE tablename = 'player_performance_history'
  AND indexname LIKE '%source%';
```

4. Reduce API calls:
```typescript
// Batch requests where possible
// Use cache more aggressively
```

---

## Rollback Procedure

If critical issues occur, follow this rollback:

### Quick Rollback (<5 minutes)

```bash
# 1. Disable BALLDONTLIE
npx supabase secrets set VITE_ENABLE_BALLDONTLIE=false

# 2. Verify ESPN fallback works
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/fetch-espn-stats \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"event_id": "401584968"}'

# 3. Clear caches
# (Run in browser console or via API)
```

### Full Rollback (if needed)

```sql
-- 1. Disable cron job
SELECT cron.unschedule('balldontlie-daily-sync');

-- 2. Mark all BALLDONTLIE data as ESPN (optional)
UPDATE player_performance_history
SET data_source = 'espn'
WHERE data_source = 'balldontlie';

-- 3. Drop new tables (optional - only if reverting completely)
-- DROP TABLE api_source_log;
-- DROP TABLE balldontlie_sync_log;
```

---

## Performance Benchmarks

### Expected Response Times

| Operation | Target | Acceptable | Action Required |
|-----------|--------|------------|-----------------|
| Fetch Teams | <300ms | <500ms | Optimize if >500ms |
| Fetch Players | <300ms | <500ms | Check cache |
| Fetch Stats (date) | <400ms | <600ms | Reduce per_page |
| Fetch Stats (game) | <300ms | <500ms | Check network |
| Daily Sync (all games) | <30s | <60s | Batch processing |

### Resource Usage

| Resource | Current | Max Capacity | Headroom |
|----------|---------|--------------|----------|
| API Calls/Min | ~4 | 60 (free tier) | 93% |
| Database Size | +50MB/month | Unlimited | ✅ |
| Edge Function Calls | +100/day | Unlimited | ✅ |

---

## Next Steps After Deployment

### Week 1: Monitoring Phase
- [ ] Monitor error rates daily
- [ ] Check cache performance
- [ ] Verify data accuracy
- [ ] Compare with ESPN data

### Week 2: Optimization
- [ ] Tune cache TTL based on usage
- [ ] Optimize database queries
- [ ] Increase rollout to 50%
- [ ] Gather user feedback

### Week 3: Full Rollout
- [ ] Increase to 100% rollout
- [ ] Monitor for 48 hours
- [ ] Update documentation
- [ ] Train support team

### Week 4: Enhancement
- [ ] Add betting odds aggregation
- [ ] Implement historical backfill
- [ ] Add advanced analytics
- [ ] Multi-sport expansion

---

## Support & Resources

**Documentation:**
- BALLDONTLIE Docs: https://docs.balldontlie.io/
- Implementation Plan: `BALLDONTLIE_REVISED_PLAN.md`
- Architecture: `ARCHITECTURE_OVERVIEW.md`

**Monitoring:**
```sql
-- Quick health check
SELECT * FROM get_api_health_stats();

-- Data source breakdown
SELECT * FROM v_data_source_usage;
```

**Common Commands:**
```bash
# Deploy edge functions
npx supabase functions deploy <function-name>

# Check secrets
npx supabase secrets list

# View logs
npx supabase functions logs fetch-balldontlie-stats

# Run migration
npx supabase db push
```

---

**Deployment Complete!** 🎉

The BALLDONTLIE integration is now ready. Monitor the dashboard and gradually increase the rollout percentage as confidence grows.
