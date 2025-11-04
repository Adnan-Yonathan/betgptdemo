# Rate Limit Fix - Quick Summary

**Problem**: System fetching betting odds every 30 minutes, using 7,200 API calls/month
**API Limit**: 500 calls/month (free tier)
**Result**: System was 14.4x over limit, causing failures

---

## ✅ Solution Applied

Changed fetch frequency from **every 30 minutes** → **every 8 hours**

| Metric | Before | After |
|---|---|---|
| Fetch frequency | Every 30 min | Every 8 hours |
| Fetches per day | 48 | 3 |
| API calls/day | 240 | 15 |
| API calls/month | 7,200 | 450 |
| Status | ❌ 14.4x over | ✅ Within limit |

---

## 📝 Files Changed

1. **supabase/migrations/20251104000000_reduce_betting_odds_fetch_frequency.sql**
   - New migration to update cron job schedule
   - Changes: `*/30 * * * *` → `0 */8 * * *`

2. **supabase/functions/chat/index.ts**
   - Line 1124-1128: Rejection threshold 2 hours → 6 hours
   - Line 1144-1158: Updated staleness warnings
   - Line 2818: Updated error message

---

## 🚀 How to Deploy

### Quick Deploy (SQL Editor)
```sql
-- 1. Update cron schedule
SELECT cron.unschedule('auto-fetch-betting-odds-job');
SELECT cron.schedule('auto-fetch-betting-odds-job', '0 */8 * * *', $$SELECT invoke_fetch_betting_odds();$$);

-- 2. Verify
SELECT * FROM cron.job WHERE jobname = 'auto-fetch-betting-odds-job';
```

### Full Deploy (Recommended)
1. Open `supabase/migrations/20251104000000_reduce_betting_odds_fetch_frequency.sql`
2. Copy entire contents
3. Paste into Supabase SQL Editor
4. Run
5. Deploy updated chat function: `supabase functions deploy chat`

---

## ⚠️ Important Changes

### Data Freshness
- **Before**: Data 0-30 minutes old
- **After**: Data 0-8 hours old

### User Experience
| Data Age | Before | After |
|---|---|---|
| 0-30 min | ✅ Fresh | ✅ Fresh |
| 30-60 min | ⚠️ Stale warning | ✅ Fresh |
| 1-2 hours | ❌ Rejected | ⚠️ Moderate warning |
| 2-6 hours | ❌ Rejected | ⚠️ Stale warning |
| 6-8 hours | ❌ Rejected | ❌ Rejected |

### Fetch Schedule
- **Before**: Every 30 minutes (48 times/day)
- **After**: At 00:00, 08:00, 16:00 UTC (3 times/day)

---

## ✅ Testing Checklist

```sql
-- [ ] 1. Verify cron job updated
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'auto-fetch-betting-odds-job';
-- Expected: schedule = '0 */8 * * *', active = true

-- [ ] 2. Test manual fetch
SELECT trigger_fetch_betting_odds('americanfootball_nfl');

-- [ ] 3. Check fetch log
SELECT * FROM betting_odds_fetch_log ORDER BY fetch_time DESC LIMIT 1;
-- Expected: success = true

-- [ ] 4. Verify data exists
SELECT COUNT(*) FROM betting_odds WHERE last_updated > NOW() - INTERVAL '12 hours';
-- Expected: > 0

-- [ ] 5. Test chat (fresh data)
-- Ask for betting recommendations, should work

-- [ ] 6. Test chat (stale data)
-- Wait 7 hours, ask again, should see error message
```

---

## 🔄 Rollback (if needed)

```sql
-- Revert to 30-minute schedule (requires paid API plan)
SELECT cron.unschedule('auto-fetch-betting-odds-job');
SELECT cron.schedule('auto-fetch-betting-odds-job', '*/30 * * * *', $$SELECT invoke_fetch_betting_odds();$$);
```

Also revert chat function changes:
- Change line 1126: `> 360` back to `> 120`
- Revert staleness thresholds
- Update error message

---

## 💰 Upgrade Option

To restore 30-minute fetches:
- **Cost**: $49/month
- **Limit**: 50,000 calls/month
- **Link**: https://the-odds-api.com/pricing
- **After upgrade**: Run rollback SQL above

---

## 📊 Expected Results

### API Usage (The Odds API Dashboard)
- **Daily**: ~15 calls
- **Monthly**: ~450 calls
- **Status**: ✅ Within 500/month limit

### System Behavior
- Fetches at: 00:00, 08:00, 16:00 UTC daily
- Data age: 0-8 hours
- User warnings: Shown for data >1 hour old
- Rejections: Only for data >6 hours old

### User Impact
- **Best case**: User asks shortly after fetch (fresh data, no warnings)
- **Typical case**: User asks 2-4 hours after fetch (recommendations + warning)
- **Worst case**: User asks 7+ hours after fetch (error message, wait for next fetch)

---

## 📅 Next Steps

1. **Deploy migration** (5 minutes)
2. **Deploy chat function** (2 minutes)
3. **Test end-to-end** (10 minutes)
4. **Monitor for 1 week**
5. **Evaluate user feedback**
6. **Consider API upgrade** if complaints about stale data

---

## 🆘 If Issues Arise

**Issue**: Cron job not running
- Check: `SELECT * FROM cron.job WHERE jobname = 'auto-fetch-betting-odds-job'`
- Fix: Re-run migration

**Issue**: Still seeing rate limit errors
- Check API dashboard usage
- Verify schedule is `0 */8 * * *` (not `*/30 * * * *`)

**Issue**: Users complaining about stale data
- This is expected with 8-hour fetches
- Solution: Upgrade to paid API plan

**Issue**: Data still rejected after update
- Check chat function is deployed with new threshold (360 min)
- Verify: `SELECT MAX(last_updated) FROM betting_odds` is recent

---

**Status**: ✅ Ready to deploy
**Estimated Impact**: Resolves rate limit issue, reduces API costs to $0/month (free tier)
**Trade-off**: Less fresh data (8 hours vs 30 minutes)
