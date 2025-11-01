# Phase 2 Testing Guide: Injury Reports & Team Trends

## Status: Ready for Testing
The development server is running at **http://localhost:8080/**

## What Was Built in Phase 2

### 1. Injury Data Sync (`sync-injury-data` edge function)
- Fetches real-time injury reports from ESPN API
- Supports all major leagues: NBA, NFL, MLB, NHL
- Categorizes injuries by severity: Out, Doubtful, Questionable, Day-to-Day
- Stores in `injury_reports` table
- **Bug Fixed**: Now correctly maps sport categories (basketball, football, baseball, hockey)

### 2. Team Trends Calculator (`calculate-team-trends` edge function)
- Calculates comprehensive team statistics:
  - Last 10 game record, Last 5 game record
  - Home/Away splits
  - Against The Spread (ATS) record
  - Over/Under (O/U) record
  - Average points scored/allowed
  - Recent form (W/L patterns)
  - Current win/loss streak
- Stores in `team_schedule_factors` table

### 3. Chat Integration
- Both injury and trends data are now fetched in parallel with odds/lineups
- AI assistant includes this data in betting analysis
- Team names are auto-extracted from user queries
- League is auto-detected (NBA, NFL, MLB, NHL)

## How to Test

### Test 1: Injury Reports Integration

1. Open the app at http://localhost:8080/
2. Log in to your account
3. Go to the Chat interface
4. Ask about injuries for a specific team:

**Example queries:**
```
"Should I bet on the Lakers tonight?"
"Who is injured on the Lakers?"
"Tell me about injuries affecting the Celtics"
"What's the injury report for the Chiefs?"
```

**What to look for:**
- Open browser Developer Tools (F12)
- Go to Console tab
- Look for logs showing parallel data fetches
- The AI response should mention any key injuries
- Network tab should show calls to `chat` function

### Test 2: Team Trends Integration

1. In the same chat interface, ask about team performance:

**Example queries:**
```
"How have the Lakers been playing lately?"
"What are the Lakers trends?"
"Show me the Bulls recent form"
"Are the Chiefs covering the spread?"
```

**What to look for:**
- AI should mention recent win/loss records
- Should include ATS (Against The Spread) performance
- Should mention home/away splits
- Should reference recent form (e.g., "won 4 of last 5")

### Test 3: Combined Analysis

1. Ask for a full betting analysis:

**Example queries:**
```
"Should I bet on Lakers vs Celtics tonight?"
"Give me a full analysis of the Bulls game"
"What's your prediction for Chiefs vs Bills?"
```

**What to look for:**
- Response should integrate:
  - Live odds from multiple sportsbooks
  - Injury reports for both teams
  - Recent team trends (ATS, O/U, form)
  - Statistical analysis
- Check browser console for parallel Promise.all() data fetches

### Test 4: Direct Function Testing (Optional)

If you want to test the edge functions directly:

1. **Install Supabase CLI:**
```bash
npm install -g supabase
```

2. **Login to Supabase:**
```bash
supabase login
```

3. **Link to your project:**
```bash
supabase link --project-ref dskfsnbdgyjizoaafqfk
```

4. **Deploy the functions:**
```bash
supabase functions deploy sync-injury-data
supabase functions deploy calculate-team-trends
```

5. **Run the test script:**
```bash
SUPABASE_SERVICE_ROLE_KEY=your_key_here node test-phase2.js
```

### Test 5: Database Verification

To verify data is being stored correctly:

1. Go to Supabase Dashboard → SQL Editor
2. Run these queries:

```sql
-- Check injury data
SELECT * FROM injury_reports
ORDER BY last_updated DESC
LIMIT 10;

-- Check team trends
SELECT * FROM team_schedule_factors
ORDER BY last_updated DESC
LIMIT 10;

-- View injury summary by league
SELECT
  league,
  COUNT(*) as total_injuries,
  COUNT(*) FILTER (WHERE injury_status = 'Out') as players_out,
  COUNT(*) FILTER (WHERE impact_level = 'High') as high_impact_injuries,
  MAX(last_updated) as last_sync
FROM injury_reports
GROUP BY league;
```

## Expected Behavior

### When injury data is available:
- AI will mention key injuries: "The Lakers are missing LeBron James (Out - knee injury)"
- Impact on betting: "Without their star player, the Lakers may struggle to cover"
- Severity assessment: "This is a high-impact injury"

### When trends data is available:
- AI will cite recent records: "The Lakers are 7-3 in their last 10 games"
- ATS performance: "They're 6-4 against the spread recently"
- Form analysis: "They've won 4 straight games"
- Situational stats: "They're 5-2 at home but 2-1 on the road"

### When no data is available:
- AI will still provide betting analysis based on odds and general knowledge
- May note: "Injury data not available at this time"
- Will fall back to odds-based analysis

## Troubleshooting

### If injury data isn't showing:
1. Check if ESPN API is accessible
2. Verify `injury_reports` table exists in Supabase
3. Check browser console for error messages from `fetchInjuryData()`
4. Ensure edge function is deployed: `supabase functions list`

### If trends data isn't showing:
1. Verify there's historical game data in `sports_scores` table
2. Check `team_schedule_factors` table has recent entries
3. Ensure team names match exactly in database
4. Check console for errors from `fetchTeamTrends()`

### If parallel fetching isn't working:
1. Check chat/index.ts logs in Supabase Functions logs
2. Verify Promise.all() is executing for all data sources
3. Look for timeout errors (increase function timeout if needed)
4. Check CORS settings in Supabase dashboard

## Next Steps After Testing

Once testing confirms everything works:

1. **Apply the cron job migration:**
```bash
supabase db push --include-migrations
```
This will set up daily automated injury sync at 6 AM EST.

2. **Monitor cron job:**
```sql
-- View cron job status
SELECT * FROM cron.job WHERE jobname = 'injury-data-sync';

-- View cron job run history
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'injury-data-sync')
ORDER BY start_time DESC
LIMIT 10;
```

3. **Proceed to Phase 3:** Enhanced memory system and deeper statistical analysis

## Files Modified in Phase 2

- ✅ `supabase/functions/sync-injury-data/index.ts` - Bug fixed
- ✅ `supabase/functions/calculate-team-trends/index.ts` - Created
- ✅ `supabase/functions/chat/index.ts` - Added helpers + integration
- ✅ `supabase/migrations/20251030000000_setup_injury_sync_cron.sql` - Created
- ✅ `test-phase2.js` - Created
- ✅ All changes committed and pushed

## Support

If you encounter issues, check:
- Browser console (F12 → Console)
- Supabase Functions logs (Dashboard → Functions → Logs)
- Network tab (F12 → Network) for failed requests
- Database table contents via SQL queries
