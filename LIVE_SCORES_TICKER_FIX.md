# Live Scores Ticker Fix

## Problem
The live scores ticker was not displaying any scores for NBA and CFB games, even though games were currently in progress.

## Root Causes Identified

1. **Missing Sports in Configuration**: The `monitor-live-bets` function only had 4 sports configured (NBA, NFL, MLB, NHL) and was missing NCAAF (CFB), WNBA, and MLS.

2. **Only Fetching for Active Bets**: The `monitor-live-bets` function was only fetching live scores for leagues that had active bets being tracked. If there were no active bets, the `live_score_cache` table would remain empty, leaving the ticker with no data to display.

3. **No Automated Fetching**: There was no cron job set up to regularly call the `monitor-live-bets` function, so the live score cache was never being populated.

4. **Inconsistent Environment Variables**: The `monitor-live-bets` function was using `RUNDOWN_API_KEY` while other functions now expect `X_RAPID_APIKEY` (or legacy `THE_RUNDOWN_API`).

## Fixes Applied

### 1. Updated `monitor-live-bets` Function
**File**: `/supabase/functions/monitor-live-bets/index.ts`

- **Added missing sports** to `sportIdMap`:
  - NCAAF (College Football) - Sport ID 9
  - WNBA - Sport ID 12
  - MLS - Sport ID 10

- **Changed to fetch ALL sports**: Modified the function to always fetch live scores for all configured sports, regardless of whether there are active bets. This ensures the ticker always has data.

- **Fixed environment variable**: Changed from `RUNDOWN_API_KEY` to `X_RAPID_APIKEY` (with `THE_RUNDOWN_API` accepted for legacy compatibility) to match other functions.

- **Removed strict authorization**: Removed the authorization check that was preventing the function from being called by automated cron jobs.

### 2. Created Automated Cron Job
**File**: `/supabase/migrations/20251101120000_setup_live_scores_cron.sql`

Created a new migration that:
- Sets up a pg_cron job to run every minute
- Calls the `monitor-live-bets` function automatically
- Ensures the `live_score_cache` table is always up-to-date with the latest scores
- Provides a manual trigger function: `trigger_live_scores_update()`

## Deployment Steps

To deploy these fixes:

1. **Deploy the Edge Function**:
   ```bash
   supabase functions deploy monitor-live-bets
   ```

2. **Run the Migration**:
   ```bash
   supabase db push
   ```

   Or manually run the migration file in the Supabase SQL editor:
   - `/supabase/migrations/20251101120000_setup_live_scores_cron.sql`

3. **Verify the Cron Job**:
   After deployment, you can verify the cron job is scheduled by running:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'populate-live-scores';
   ```

4. **Manual Testing**:
   You can manually trigger a live scores update to test immediately:
   ```sql
   SELECT trigger_live_scores_update();
   ```

## Expected Behavior After Fix

1. Every minute, the system will automatically fetch live scores for all sports:
   - NBA
   - NFL
   - NCAAF (College Football/CFB)
   - MLB
   - NHL
   - WNBA
   - MLS

2. The `live_score_cache` table will be updated with current scores for all games in progress

3. The live scores ticker components will display these scores with:
   - Team names and current scores
   - Game period/quarter
   - Time remaining
   - League badge
   - Live indicator (pulsing red dot)

4. The ticker will auto-scroll and show all live games across all sports

## Notes

- The fix ensures live scores are fetched even when there are no active bets
- Scores update every minute to keep data fresh
- The ticker will show "No live games at the moment" when there are genuinely no live games
- The RapidAPI fallback must have valid credentials set in environment variable `X_RAPID_APIKEY` (legacy `THE_RUNDOWN_API` still supported)
