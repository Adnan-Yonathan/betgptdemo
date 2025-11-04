# Hourly Fetch - Quick Reference

**Requirement**: Data max 1 hour old
**Solution**: Fetch every hour
**Cost**: $49/month API plan (required)

---

## Quick Deploy

### 1. Upgrade API (REQUIRED)
https://the-odds-api.com/pricing → $49/month

### 2. Run SQL
```sql
SELECT cron.unschedule('auto-fetch-betting-odds-job');
SELECT cron.schedule('auto-fetch-betting-odds-job', '0 * * * *', $$SELECT invoke_fetch_betting_odds();$$);
SELECT * FROM cron.job WHERE jobname = 'auto-fetch-betting-odds-job';
```

### 3. Deploy Function
```bash
supabase functions deploy chat
```

### 4. Test
```sql
SELECT trigger_fetch_betting_odds();
SELECT * FROM betting_odds_fetch_log ORDER BY fetch_time DESC LIMIT 1;
```

---

## Summary

| Metric | Value |
|---|---|
| Fetch frequency | Every hour |
| Fetches/day | 24 |
| API calls/month | 3,600 |
| Data max age | 60 minutes |
| Required plan | $49/month |

---

**See HOURLY_FETCH_UPDATE.md for full details**
