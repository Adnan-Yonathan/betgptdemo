# Bankroll CRM Integration with Live Score Monitoring

## Overview

This system provides real-time bankroll management by automatically:
1. **Fetching live scores** from ESPN every 10 minutes
2. **Settling pending bets** when games complete
3. **Updating user bankrolls** based on bet outcomes
4. **Syncing CRM statistics** automatically via database triggers

## Architecture

### Components

1. **Database Tables**
   - `profiles` - User profiles with bankroll and CRM stats
   - `bets` - Individual bet records with outcomes
   - `sports_scores` - Live game scores and status
   - `betting_odds` - Historical odds for CLV calculation

2. **Edge Functions**
   - `auto-monitor-bets` - Main automation function (NEW)
   - `settle-bets` - Settles bets based on game results
   - `fetch-sports-scores` - Fetches live scores from ESPN
   - `log-bet` - Logs new bets with analytics

3. **Database Functions**
   - `sync_user_betting_profile()` - Syncs CRM stats from bets
   - `invoke_auto_monitor_bets()` - Calls edge function from SQL
   - `trigger_auto_monitor()` - Manual trigger for monitoring

4. **Database Triggers**
   - `trigger_sync_profile_on_bet_insert` - Syncs on bet creation
   - `trigger_sync_profile_on_bet_update` - Syncs on bet update
   - `trigger_sync_profile_on_bet_delete` - Syncs on bet deletion

5. **Cron Job**
   - Runs every 10 minutes via pg_cron
   - Automatically invokes auto-monitor-bets function

## How It Works

### 1. Bet Placement Flow

```
User places bet via chat
        ↓
log-bet function creates bet record
        ↓
Database trigger fires
        ↓
sync_user_betting_profile() updates CRM stats
        ↓
Profile shows updated statistics
```

**Key Points:**
- Bet amount is NOT deducted from bankroll when placed
- CRM stats update immediately (pending bet count, pending amount)
- Bankroll remains unchanged until bet settles

### 2. Automated Settlement Flow

```
Cron job triggers every 10 minutes
        ↓
invoke_auto_monitor_bets() SQL function
        ↓
auto-monitor-bets edge function
        ↓
Fetch scores for all leagues (NFL, CFB, etc.)
        ↓
Update sports_scores table
        ↓
Check all pending bets
        ↓
For each completed game:
  - Determine win/loss/push
  - Calculate CLV (Closing Line Value)
  - Update bet outcome
  - Update user bankroll
        ↓
Database trigger fires
        ↓
sync_user_betting_profile() updates CRM stats
        ↓
User sees updated bankroll and stats
```

### 3. Bankroll Update Logic

The system uses a **deferred deduction** model:

- **Initial State**: User has $1,000 bankroll
- **Bet Placed**: User bets $100 at +150 odds
  - Bankroll: $1,000 (unchanged)
  - Potential return: $250
  - Status: pending

- **Bet Wins**: Game completes, bet wins
  - Profit: $250 - $100 = $150
  - New bankroll: $1,000 + $150 = $1,150
  - Status: win

- **Bet Loses**: Game completes, bet loses
  - Loss: $100
  - New bankroll: $1,000 - $100 = $900
  - Status: loss

- **Bet Pushes**: Game ties
  - Change: $0
  - New bankroll: $1,000 (unchanged)
  - Status: push

### 4. CRM Statistics Synced Automatically

When any bet is created, updated, or deleted, the profile CRM stats are automatically recalculated:

- `total_bets_placed` - Total count of all bets
- `total_bets_won` - Count of winning bets
- `total_bets_lost` - Count of losing bets
- `total_bets_pushed` - Count of pushed bets
- `win_rate` - Win percentage (wins / (wins + losses))
- `roi` - Return on investment percentage
- `total_profit` - Net profit/loss
- `current_streak` - Current win/loss streak
- `longest_win_streak` - Best winning streak
- `longest_loss_streak` - Worst losing streak
- `pending_bet_count` - Number of pending bets
- `pending_bet_amount` - Total amount in pending bets
- `average_bet_size` - Average bet amount
- `largest_win` - Biggest single win
- `largest_loss` - Biggest single loss
- `last_bet_at` - Timestamp of most recent bet
- `last_win_at` - Timestamp of most recent win
- `last_loss_at` - Timestamp of most recent loss
- `last_sync_at` - Timestamp of last sync

## Setup Instructions

### 1. Deploy Edge Function

The `auto-monitor-bets` function is already created. Deploy it:

```bash
supabase functions deploy auto-monitor-bets
```

### 2. Run Database Migration

Apply the migration to set up the cron job:

```bash
supabase db push
```

This will:
- Enable `pg_cron` and `pg_net` extensions
- Create the `invoke_auto_monitor_bets()` function
- Schedule the cron job to run every 10 minutes
- Create helper functions for manual triggering

### 3. Verify Cron Job Setup

Check if the cron job is running:

```sql
SELECT * FROM cron_job_status;
```

You should see:
- Job name: `auto-monitor-bets-job`
- Schedule: `*/10 * * * *` (every 10 minutes)
- Active: `true`

### 4. Manual Testing

To manually trigger the auto-monitor process:

```sql
SELECT trigger_auto_monitor();
```

Or call the edge function directly:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/auto-monitor-bets \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## Monitoring and Verification

### Check Cron Job Status

```sql
-- View cron job configuration
SELECT * FROM cron_job_status;

-- View cron job execution history
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-monitor-bets-job')
ORDER BY start_time DESC
LIMIT 10;
```

### Check Recent Score Updates

```sql
-- View recently updated scores
SELECT event_id, league, home_team, away_team, home_score, away_score, game_status, last_updated
FROM sports_scores
WHERE last_updated > NOW() - INTERVAL '1 hour'
ORDER BY last_updated DESC;
```

### Check Recent Bet Settlements

```sql
-- View recently settled bets
SELECT id, user_id, description, amount, odds, outcome, actual_return, settled_at
FROM bets
WHERE settled_at > NOW() - INTERVAL '1 hour'
ORDER BY settled_at DESC;
```

### Check User Bankroll History

```sql
-- View a user's bankroll changes (requires custom tracking table)
SELECT bankroll, updated_at
FROM profiles
WHERE id = 'user-id-here';
```

### View User CRM Statistics

```sql
-- View comprehensive CRM stats for a user
SELECT
  id,
  email,
  bankroll,
  total_bets_placed,
  total_bets_won,
  total_bets_lost,
  win_rate,
  roi,
  total_profit,
  current_streak,
  pending_bet_count,
  last_sync_at
FROM profiles
WHERE id = 'user-id-here';
```

## Troubleshooting

### Cron Job Not Running

**Issue**: Cron job doesn't seem to be executing

**Solutions**:
1. Check if pg_cron extension is enabled:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. Verify cron job is active:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'auto-monitor-bets-job';
   ```

3. Check cron job logs for errors:
   ```sql
   SELECT * FROM cron.job_run_details
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-monitor-bets-job')
   ORDER BY start_time DESC;
   ```

### Bets Not Settling

**Issue**: Games are finished but bets remain pending

**Solutions**:
1. Check if scores are being updated:
   ```sql
   SELECT * FROM sports_scores WHERE game_status = 'STATUS_FINAL' ORDER BY last_updated DESC LIMIT 10;
   ```

2. Manually trigger settlement:
   ```sql
   SELECT trigger_auto_monitor();
   ```

3. Check bet event_id matches score event_id:
   ```sql
   SELECT b.id, b.event_id, b.team_bet_on, s.event_id, s.home_team, s.away_team, s.game_status
   FROM bets b
   LEFT JOIN sports_scores s ON b.event_id = s.event_id
   WHERE b.outcome = 'pending'
   LIMIT 10;
   ```

### Bankroll Not Updating

**Issue**: Bets are settling but bankroll isn't changing

**Solutions**:
1. Check if the bet was actually settled:
   ```sql
   SELECT id, outcome, actual_return, settled_at FROM bets WHERE id = 'bet-id-here';
   ```

2. Verify the settle-bets function was called:
   - Check edge function logs in Supabase dashboard

3. Manually sync the profile:
   ```sql
   SELECT sync_user_betting_profile('user-id-here');
   ```

### CRM Stats Not Syncing

**Issue**: Bet statistics in profile are outdated

**Solutions**:
1. Check if triggers are enabled:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname LIKE 'trigger_sync_profile%';
   ```

2. Manually sync:
   ```sql
   SELECT sync_user_betting_profile('user-id-here');
   ```

3. Check for errors in function:
   ```sql
   SELECT * FROM sync_user_betting_profile('user-id-here');
   ```

## Alternative Setup (Without pg_cron)

If `pg_cron` is not available in your Supabase project, you can use external cron services:

### Option 1: GitHub Actions

Create `.github/workflows/auto-settle-bets.yml`:

```yaml
name: Auto Settle Bets
on:
  schedule:
    - cron: '*/10 * * * *'  # Every 10 minutes
  workflow_dispatch:  # Allow manual triggers

jobs:
  settle-bets:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Auto Monitor
        run: |
          curl -X POST ${{ secrets.SUPABASE_URL }}/functions/v1/auto-monitor-bets \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
```

### Option 2: Vercel Cron Jobs

Create `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/auto-settle",
    "schedule": "*/10 * * * *"
  }]
}
```

Create `pages/api/auto-settle.ts`:

```typescript
export default async function handler(req, res) {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/functions/v1/auto-monitor-bets`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  );
  const data = await response.json();
  res.json(data);
}
```

### Option 3: cron-job.org (Free Service)

1. Go to https://cron-job.org
2. Create a new cron job
3. Set URL: `https://your-project.supabase.co/functions/v1/auto-monitor-bets`
4. Set schedule: Every 10 minutes
5. Add header: `Authorization: Bearer YOUR_ANON_KEY`

## Performance Considerations

- **Cron Frequency**: 10 minutes is a good balance between real-time updates and API rate limits
- **API Limits**: ESPN API has rate limits; adjust frequency if you hit limits
- **Database Load**: Each run queries pending bets and scores; ensure indexes are in place
- **Timeout**: Edge functions have a 60-second timeout; large bet volumes may need optimization

## Security

- Edge functions use `verify_jwt = false` to allow cron job access
- Service role key is required for cron job invocation
- Database functions use `SECURITY DEFINER` to run with elevated permissions
- All user-facing operations use Row Level Security (RLS)

## Future Enhancements

- [ ] Add support for more sports (NBA, MLB, NHL, etc.)
- [ ] Implement bankroll change history tracking
- [ ] Add email notifications for settled bets
- [ ] Create dashboard for monitoring system health
- [ ] Add circuit breaker for API failures
- [ ] Implement bet settlement retry logic for edge cases
- [ ] Add support for complex bet types (parlays, teasers)

## Summary

The bankroll CRM is now fully integrated with the betting profile through:

1. ✅ **Automatic score fetching** - Every 10 minutes
2. ✅ **Automatic bet settlement** - When games complete
3. ✅ **Automatic bankroll updates** - When bets settle
4. ✅ **Automatic CRM sync** - Via database triggers
5. ✅ **Real-time UI updates** - Via Supabase realtime subscriptions

Users can now track their bets and see their bankroll update automatically as games finish, with comprehensive statistics and analytics updated in real-time.
