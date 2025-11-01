# Phase 5: Live Bet Tracking & In-Game Alerts - Testing Guide

## Overview
Phase 5 implements real-time monitoring of active bets during games with intelligent alerts for critical moments.

## Features Implemented
- ✅ Live bet tracking system (database tables)
- ✅ Live score caching from The Rundown API
- ✅ Intelligent alerts system (8 alert types)
- ✅ User alert settings and preferences
- ✅ Background monitoring edge function
- ✅ Chat integration for live status

## Database Structure

### Tables Created
1. **live_bet_tracking** - Tracks active bets in real-time
2. **live_score_cache** - Caches live scores (60-second refresh)
3. **bet_alerts** - Stores generated alerts
4. **user_alert_settings** - User notification preferences

### Key Functions
- `start_live_tracking(bet_id)` - Initialize tracking for a bet
- `update_bet_tracking_from_scores(bet_id)` - Update bet status from live scores
- `check_all_alerts_for_bet(tracking_id)` - Check and create alerts
- `get_user_active_bets_live(user_id)` - Get all active tracked bets
- `get_user_unread_alerts(user_id)` - Get unread alerts

## Testing Steps

### 1. Database Setup

```sql
-- Verify migrations were applied
SELECT table_name
FROM information_schema.tables
WHERE table_name IN (
  'live_bet_tracking',
  'live_score_cache',
  'bet_alerts',
  'user_alert_settings'
);

-- Should return all 4 tables
```

### 2. Initialize User Alert Settings

```sql
-- Check your alert settings were created
SELECT * FROM user_alert_settings
WHERE user_id = '<your-user-id>';

-- Modify settings (optional)
UPDATE user_alert_settings
SET
  alert_close_finish = true,
  alert_momentum_shift = true,
  win_prob_change_threshold = 0.15,
  momentum_points_threshold = 8
WHERE user_id = '<your-user-id>';
```

### 3. Start Tracking a Test Bet

First, place a bet in the app on an upcoming game, then:

```sql
-- Start tracking the bet
SELECT start_live_tracking('<bet-id>');

-- Verify tracking was initialized
SELECT * FROM live_bet_tracking
WHERE bet_id = '<bet-id>';

-- Expected: Row with bet details, is_active = true
```

### 4. Simulate Live Score Update

```sql
-- Manually insert a live score (for testing)
INSERT INTO live_score_cache (
  game_id,
  league,
  home_team,
  away_team,
  home_score,
  away_score,
  period,
  time_remaining,
  game_status,
  game_date,
  last_5min_home_points,
  last_5min_away_points
) VALUES (
  'test-game-123',
  'NBA',
  'Lakers',
  'Celtics',
  98,
  95,
  'Q4',
  '2:34',
  'in_progress',
  now(),
  8,
  2
);

-- Update bet tracking from this score
SELECT update_bet_tracking_from_scores('<bet-id>');

-- Check updated tracking
SELECT
  bet_status,
  current_home_score,
  current_away_score,
  time_remaining,
  points_needed_to_cover,
  last_5min_home_points,
  last_5min_away_points
FROM live_bet_tracking
WHERE bet_id = '<bet-id>';

-- Expected: bet_status should reflect current game state
```

### 5. Test Alert Generation

```sql
-- Check for close finish alert
SELECT check_close_finish_alert(tracking_id)
FROM live_bet_tracking
WHERE bet_id = '<bet-id>';

-- Check for momentum shift alert
SELECT check_momentum_shift_alert(tracking_id)
FROM live_bet_tracking
WHERE bet_id = '<bet-id>';

-- Check all alert conditions
SELECT check_all_alerts_for_bet(tracking_id)
FROM live_bet_tracking
WHERE bet_id = '<bet-id>';

-- View generated alerts
SELECT * FROM bet_alerts
WHERE bet_id = '<bet-id>'
ORDER BY created_at DESC;
```

### 6. Test Unread Alerts Query

```sql
-- Get unread alerts
SELECT * FROM get_user_unread_alerts('<user-id>');

-- Mark an alert as read
SELECT mark_alert_as_read('<alert-id>', '<user-id>');
```

### 7. Test Background Monitoring Function

Deploy and test the monitor-live-bets edge function:

```bash
# Deploy the function (requires Supabase CLI)
supabase functions deploy monitor-live-bets

# Test the function manually
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/monitor-live-bets' \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json"

# Expected response:
# {
#   "success": true,
#   "activeTracking": 3,
#   "updatedBets": 3,
#   "alertsCreated": 2,
#   "liveScoresFetched": 5
# }
```

### 8. Set Up Cron Job (Background Monitoring)

In Supabase Dashboard:
1. Go to Database → Cron Jobs
2. Create new job:
   - **Name**: monitor-live-bets
   - **Schedule**: `*/1 * * * *` (every minute)
   - **Command**:
     ```sql
     SELECT net.http_post(
       url := '<your-supabase-url>/functions/v1/monitor-live-bets',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer <service-role-key>'
       ),
       body := jsonb_build_object()
     );
     ```

### 9. Test Chat Integration

In the app, send messages to test Phase 5 features:

**Test 1: View live bets**
```
User: "What's the status of my active bets?"
```
Expected: AI should mention any live tracked bets with current scores and status.

**Test 2: Check alerts**
```
User: "Any alerts for my bets?"
```
Expected: AI should list unread alerts if any exist.

**Test 3: Start tracking**
```
User: "Start tracking my Lakers bet"
```
Expected: System should initialize live tracking (requires implementation in bet logging).

### 10. End-to-End Test Scenario

**Full workflow test:**

1. **Place a bet** on an upcoming NBA game
   ```
   User: "I want to bet $100 on Lakers -5.5"
   ```

2. **Wait for game to start** (or simulate live score)

3. **Check live status in chat**
   ```
   User: "How's my Lakers bet doing?"
   ```
   Expected: AI shows current score, bet status (winning/losing), time remaining

4. **Simulate momentum shift** (update scores manually)
   ```sql
   -- Lakers go on a run
   UPDATE live_score_cache
   SET
     home_score = 88,
     away_score = 75,
     last_5min_home_points = 15,
     last_5min_away_points = 3,
     time_remaining = '5:30',
     period = 'Q3'
   WHERE game_id = '<game-id>';
   ```

5. **Trigger alert check**
   ```sql
   SELECT check_all_alerts_for_bet(tracking_id)
   FROM live_bet_tracking
   WHERE game_id = '<game-id>';
   ```

6. **View alert in chat**
   ```
   User: "Any updates?"
   ```
   Expected: AI mentions the momentum shift alert

7. **Game ends**
   ```sql
   UPDATE live_score_cache
   SET game_status = 'final'
   WHERE game_id = '<game-id>';

   -- Update tracking
   SELECT update_bet_tracking_from_scores('<bet-id>');
   ```

8. **Verify tracking ended**
   ```sql
   SELECT is_active, tracking_ended_at
   FROM live_bet_tracking
   WHERE bet_id = '<bet-id>';
   ```
   Expected: `is_active = false`, `tracking_ended_at` is set

## Expected Behavior

### Live Bet Status

When a game is live, the tracking system should:
- ✅ Update scores every 60 seconds
- ✅ Calculate bet status (winning/losing/push)
- ✅ Track points needed to cover
- ✅ Monitor momentum (last 5 min scoring)
- ✅ Check alert conditions

### Alert Types

The system generates these alerts:

1. **game_starting** - 10 min before game (NOT YET IMPLEMENTED)
2. **close_finish** - Close game in final 5 minutes (within 6 points)
3. **momentum_shift** - Team on 8+ point run in last 5 min
4. **critical_moment** - Under 2 min, close game (NOT YET IMPLEMENTED)
5. **hedge_opportunity** - Profitable hedge available (NOT YET IMPLEMENTED)
6. **win_prob_change** - Win probability changed 15%+ (REQUIRES PHASE 4)
7. **line_movement** - Live line moved significantly (NOT YET IMPLEMENTED)
8. **injury_update** - Key player injured (NOT YET IMPLEMENTED)

### Chat Integration

When Phase 5 is active, the AI should:
- Proactively mention live bets when user asks for updates
- Show current score, time remaining, bet status
- Alert user to unread notifications
- Provide context on critical moments

## Troubleshooting

### Problem: No live scores fetching

**Solution:**
1. Check RUNDOWN_API_KEY is set in edge function secrets
2. Verify The Rundown API is accessible
3. Check edge function logs: `supabase functions logs monitor-live-bets`

### Problem: Alerts not generating

**Solution:**
1. Verify alert conditions are met (check thresholds)
2. Check user_alert_settings - alerts might be disabled
3. Test alert functions manually in SQL
4. Check if alert was already sent (prevents duplicates)

### Problem: Tracking not updating

**Solution:**
1. Verify cron job is running (Database → Cron Jobs)
2. Check edge function is deployed and accessible
3. Verify game_id matches between bets and live_score_cache
4. Check RLS policies allow service_role to update

### Problem: High database load

**Solution:**
1. Reduce cron frequency (every 2-3 minutes instead of 1)
2. Add indexes on frequently queried columns (already done)
3. Limit number of tracked bets per user
4. Archive old tracking records

## Performance Considerations

### Database Query Optimization
- All critical columns have indexes
- RLS policies are optimized for service_role
- Parallel fetching in chat integration

### API Rate Limits
- The Rundown API: ~300 requests/day on free tier
- Monitor calls per minute: ~1 call × number of active leagues
- Consider caching scores longer (2-3 min) if hitting limits

### Edge Function Timeouts
- Default timeout: 60 seconds
- Typical execution: 2-5 seconds
- Use parallel Promise.all() for multiple leagues

## Next Steps (Phase 5 Part 2)

### Frontend Components Needed
- [ ] Live bet tracking dashboard
- [ ] Alert notifications component
- [ ] Game watching mode (real-time updates)
- [ ] Alert settings page
- [ ] Live score ticker

### Additional Features
- [ ] Hedge calculator integration
- [ ] Win probability live updates (requires Phase 4 models)
- [ ] Push notifications (web push API)
- [ ] SMS alerts (Twilio integration)
- [ ] Game starting alerts (10-min warning)

### Testing Requirements
- [ ] Load testing with 100+ active bets
- [ ] Alert spam prevention
- [ ] Real game monitoring (not simulation)
- [ ] Multi-league simultaneous tracking
- [ ] Network failure resilience

## Success Criteria

Phase 5 is successful when:
- ✅ Bets can be tracked in real-time during games
- ✅ Alerts generate for critical moments
- ✅ User can view live status in chat
- ✅ Background monitoring runs without errors
- ✅ System handles multiple simultaneous games
- ✅ Alerts respect user preferences (quiet hours, thresholds)
- ✅ No duplicate alerts
- ✅ Tracking auto-stops when games end

## Notes

- Phase 5 Part 1 is **backend-complete** but **frontend-incomplete**
- Real-time updates require Supabase Realtime subscriptions (not yet implemented)
- Hedge calculator requires live odds API (The Rundown) integration
- Win probability updates require Phase 4 Elo models to be trained
- Game starting alerts require pre-game monitoring (separate edge function)

---

**Phase 5 transforms the app from a betting tracker into a live game monitor that keeps users informed of critical moments affecting their bets in real-time.**
