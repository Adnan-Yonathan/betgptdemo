# Live Ticker Database Schema Documentation

## Overview

The Live Ticker schema provides a comprehensive database structure for displaying real-time sports scores in a ticker format. It's optimized for fast updates, user customization, and efficient display of live game data across multiple sports.

## Architecture

```
┌─────────────────────┐
│ live_score_cache    │ ← Existing table (populated by cron jobs)
└──────────┬──────────┘
           │
           │ sync_scores_to_ticker() - Every minute
           ▼
┌─────────────────────┐
│ live_ticker_games   │ ← Enhanced ticker-optimized game data
└──────────┬──────────┘
           │
           ├──────────────────┐
           │                  │
           ▼                  ▼
┌─────────────────┐   ┌──────────────────┐
│ticker_events    │   │ticker_queue      │
│(highlights)     │   │(display order)   │
└─────────────────┘   └──────────────────┘
           │                  │
           │                  │
           ▼                  ▼
┌────────────────────────────────┐
│   Live Ticker UI Display       │
└────────────────────────────────┘
```

## Database Tables

### 1. `live_ticker_games`

**Purpose**: Enhanced live game data specifically optimized for ticker display.

**Key Features**:
- Real-time score updates
- Game status tracking (scheduled, in_progress, halftime, final)
- Ticker priority system (0-100)
- Close game detection
- Featured/trending game flags
- Momentum tracking

**Important Columns**:
```sql
ticker_priority INTEGER       -- 0-100, higher = more important
is_featured BOOLEAN          -- Highlighted in ticker
is_close_game BOOLEAN        -- Auto-calculated close games
is_trending BOOLEAN          -- High interest games
last_scoring_play JSONB      -- Most recent score
momentum_team TEXT           -- Team with momentum
```

**Example Query**:
```sql
-- Get all active games sorted by priority
SELECT *
FROM live_ticker_games
WHERE game_status IN ('in_progress', 'halftime')
ORDER BY ticker_priority DESC, scheduled_start_time ASC;
```

### 2. `live_ticker_events`

**Purpose**: Key moments and highlights to display in the ticker (touchdowns, big plays, etc.)

**Key Features**:
- Event type categorization
- Importance scoring (1-10)
- Display tracking
- Auto-expiration
- Short descriptions for ticker

**Event Types**:
- `touchdown`, `field_goal` (NFL)
- `three_pointer`, `basket` (NBA)
- `goal` (NHL, MLS)
- `home_run` (MLB)

**Example Query**:
```sql
-- Get recent high-importance events for ticker
SELECT
  title,
  short_description,
  team,
  importance
FROM live_ticker_events
WHERE event_time > now() - interval '15 minutes'
  AND importance >= 7
  AND (display_until IS NULL OR display_until > now())
ORDER BY importance DESC, event_time DESC
LIMIT 10;
```

### 3. `user_ticker_preferences`

**Purpose**: User customization for personalized ticker experience.

**Customization Options**:
- Favorite sports/leagues/teams
- Display preferences (show scores, odds, only live games)
- Ticker behavior (auto-scroll, speed)
- Notification settings
- Sort order preferences

**Example Query**:
```sql
-- Get or create user preferences
INSERT INTO user_ticker_preferences (user_id)
VALUES (auth.uid())
ON CONFLICT (user_id) DO NOTHING;

-- Update preferences
UPDATE user_ticker_preferences
SET
  favorite_teams = ARRAY['Lakers', 'Patriots', 'Yankees'],
  show_only_live = true,
  highlight_user_bets = true,
  scroll_speed = 4
WHERE user_id = auth.uid();
```

### 4. `ticker_display_queue`

**Purpose**: Optimized queue for rotating through games in the ticker UI.

**Key Features**:
- Display order management
- Priority calculation (base + user factors)
- User-specific and global queues
- Automatic priority boosting for:
  - User bets (+20)
  - Favorite teams (+15)
  - Close games (+10)

**Example Query**:
```sql
-- Get next games to display in ticker
SELECT
  g.game_id,
  g.home_team,
  g.away_team,
  g.home_score,
  g.away_score,
  q.calculated_priority
FROM ticker_display_queue q
JOIN live_ticker_games g ON q.game_id = g.game_id
WHERE q.user_id = auth.uid() OR q.user_id IS NULL
ORDER BY q.calculated_priority DESC, q.display_order ASC
LIMIT 10;
```

### 5. `ticker_stats`

**Purpose**: Track ticker usage and performance metrics.

**Metrics Tracked**:
- Total games/events displayed
- Unique users viewing
- Average session duration
- Performance metrics (load time, errors)
- Popular content

## Pre-built Views

### `ticker_active_games`

Shows currently active and recently completed games with adjusted priority.

```sql
SELECT * FROM ticker_active_games
ORDER BY adjusted_priority DESC
LIMIT 20;
```

### `ticker_events_feed`

Recent important events from live games (last 15 minutes, importance ≥ 6).

```sql
SELECT * FROM ticker_events_feed
ORDER BY importance DESC, event_time DESC;
```

### `ticker_user_feed`

Personalized game feed based on user preferences.

```sql
SELECT * FROM ticker_user_feed
WHERE user_show_scores = true
  AND (is_user_favorite = true OR user_has_active_bet = true)
ORDER BY ticker_priority DESC;
```

## Key Functions

### `sync_scores_to_ticker()`

Syncs data from `live_score_cache` to ticker tables.

**Runs**: Every minute (via cron job)

**What it does**:
1. Copies/updates games from live_score_cache
2. Updates close game flags
3. Recalculates ticker priorities

```sql
-- Manually trigger sync
SELECT sync_scores_to_ticker();
```

### `update_close_game_flags()`

Updates `is_close_game` flag based on sport-specific thresholds.

**Thresholds**:
- NFL/NCAAF: ≤ 7 points
- NBA/WNBA: ≤ 8 points
- MLB: ≤ 2 runs
- NHL/MLS: ≤ 1 goal

### `update_ticker_priority()`

Calculates ticker priority based on:
- Base priority: 50
- Live game: +30
- Featured: +15
- Close game: +20
- Trending: +10
- Final game: -decay over time

## Automatic Features

### 1. Score Change Events

When a score changes in `live_ticker_games`, a trigger automatically creates an event in `live_ticker_events`:

```sql
-- Trigger: trigger_ticker_event_on_score
-- Creates events like:
-- "Lakers scores 3" (NBA three-pointer)
-- "Patriots scores 6" (NFL touchdown)
```

### 2. Close Game Detection

Games are automatically flagged as close based on score differential and sport type.

### 3. Priority Decay

Final games have their priority automatically decreased over time (30 points decaying over 60 minutes).

## Cron Jobs

All cron jobs are defined in `20251103120001_live_ticker_cron.sql`:

| Job | Frequency | Purpose |
|-----|-----------|---------|
| `sync-ticker-scores` | Every minute | Sync scores from cache to ticker |
| `cleanup-ticker-events` | Every hour | Remove old displayed events |
| `update-ticker-stats` | Every hour | Update usage statistics |
| `refresh-ticker-queue` | Every 2 minutes | Update display queue |
| `archive-ticker-games` | Daily at 4 AM | Archive completed games |

## Usage Examples

### Frontend: Display Live Ticker

```typescript
import { supabase } from '@/integrations/supabase/client';

// Get active games for ticker
const { data: games } = await supabase
  .from('ticker_active_games')
  .select('*')
  .order('adjusted_priority', { ascending: false })
  .limit(10);

// Get recent events
const { data: events } = await supabase
  .from('ticker_events_feed')
  .select('*')
  .order('event_time', { ascending: false })
  .limit(5);

// Subscribe to real-time updates
const channel = supabase
  .channel('ticker-updates')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'live_ticker_games'
    },
    (payload) => {
      console.log('Game updated:', payload);
      // Update UI
    }
  )
  .subscribe();
```

### Frontend: User Preferences

```typescript
// Get user preferences
const { data: prefs } = await supabase
  .from('user_ticker_preferences')
  .select('*')
  .eq('user_id', user.id)
  .single();

// Update preferences
await supabase
  .from('user_ticker_preferences')
  .upsert({
    user_id: user.id,
    favorite_teams: ['Lakers', 'Patriots'],
    show_only_live: true,
    highlight_close_games: true,
    scroll_speed: 3
  });
```

### Backend: Create Custom Event

```typescript
// Manually create a ticker event
await supabase
  .from('live_ticker_events')
  .insert({
    game_id: 'nba-lakers-vs-celtics-2025-01-15',
    event_type: 'milestone',
    event_category: 'achievement',
    importance: 9,
    title: 'LeBron James 40,000th career point',
    short_description: 'LeBron 40K milestone',
    team: 'Lakers',
    player_name: 'LeBron James',
    display_until: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
  });
```

### Backend: Update Game Status

```typescript
// Update game (triggers automatic event creation if score changes)
await supabase
  .from('live_ticker_games')
  .update({
    home_score: 84,
    away_score: 79,
    period: 'Q4',
    time_remaining: '5:23',
    game_status: 'in_progress'
  })
  .eq('game_id', 'nba-lakers-vs-celtics-2025-01-15');
```

## Performance Optimization

### Indexes

All tables have optimized indexes for common queries:
- Game status filtering
- Priority sorting
- Time-based queries
- User-specific data

### Efficient Queries

Use the pre-built views instead of complex joins:

❌ **Avoid**:
```sql
SELECT g.*, p.* FROM live_ticker_games g
JOIN user_ticker_preferences p ON ...
WHERE ...
```

✅ **Use**:
```sql
SELECT * FROM ticker_active_games;
SELECT * FROM ticker_user_feed;
```

## Integration with Existing System

The ticker schema integrates seamlessly with existing tables:

### Connection to Bets
```sql
-- Show games where user has active bets
SELECT
  g.*,
  COUNT(b.id) as user_bet_count,
  SUM(b.amount) as total_wagered
FROM live_ticker_games g
JOIN bets b ON g.game_id = b.game_id
WHERE b.user_id = auth.uid()
  AND b.status NOT IN ('settled', 'void')
  AND g.game_status IN ('in_progress', 'halftime')
GROUP BY g.id;
```

### Connection to Live Bet Tracking
```sql
-- Show ticker games with live bet tracking
SELECT
  g.*,
  lbt.bet_status,
  lbt.points_needed_to_cover,
  lbt.win_prob_change
FROM live_ticker_games g
JOIN live_bet_tracking lbt ON g.game_id = lbt.game_id
WHERE lbt.user_id = auth.uid()
  AND lbt.is_active = true;
```

## Security (RLS)

Row Level Security is enabled on all tables:

### Public Tables
- `live_ticker_games`: Read-only for all users
- `live_ticker_events`: Read-only for all users
- `ticker_stats`: Read-only for all users

### User-specific Tables
- `user_ticker_preferences`: Users can only access their own
- `ticker_display_queue`: Users see their own + global queue

### Service Role
All tables allow full access to service role for automation.

## Monitoring

### Check Sync Status
```sql
-- See when games were last updated
SELECT
  league,
  COUNT(*) as games,
  MAX(last_updated) as most_recent_update,
  MIN(last_updated) as oldest_update
FROM live_ticker_games
WHERE game_status IN ('in_progress', 'halftime')
GROUP BY league;
```

### View Cron Job Status
```sql
-- Check if cron jobs are running
SELECT * FROM cron.job
WHERE jobname LIKE '%ticker%';

-- View recent job runs
SELECT * FROM cron.job_run_details
WHERE jobname LIKE '%ticker%'
ORDER BY start_time DESC
LIMIT 10;
```

## Troubleshooting

### Games not appearing in ticker

1. Check if sync is running:
```sql
SELECT sync_scores_to_ticker();
```

2. Verify games exist in cache:
```sql
SELECT * FROM live_score_cache
WHERE game_status IN ('in_progress', 'halftime');
```

3. Check ticker games:
```sql
SELECT * FROM live_ticker_games
WHERE game_status IN ('in_progress', 'halftime');
```

### Events not being created

1. Check trigger exists:
```sql
SELECT * FROM pg_trigger
WHERE tgname = 'trigger_ticker_event_on_score';
```

2. Manually test event creation:
```sql
UPDATE live_ticker_games
SET home_score = home_score + 3
WHERE game_id = 'your-game-id';
```

### Preferences not working

1. Ensure preferences exist:
```sql
SELECT * FROM user_ticker_preferences
WHERE user_id = auth.uid();
```

2. Create default preferences:
```sql
INSERT INTO user_ticker_preferences (user_id)
VALUES (auth.uid())
ON CONFLICT (user_id) DO NOTHING;
```

## Best Practices

1. **Use Views**: Always use the pre-built views for common queries
2. **Real-time Updates**: Subscribe to PostgreSQL changes for live updates
3. **Batch Updates**: Use the sync function rather than individual updates
4. **Cache Frontend**: Cache ticker data on frontend with 30-60 second refresh
5. **User Preferences**: Always check user preferences before displaying content
6. **Event Cleanup**: Let the cron job handle old event cleanup
7. **Priority System**: Trust the automatic priority calculation

## Future Enhancements

Potential additions to the schema:

- [ ] Trending topics/hashtags from social media
- [ ] Player tracking (individual player highlights)
- [ ] Video highlights integration
- [ ] Audio commentary/play-by-play
- [ ] Multi-language support
- [ ] Custom ticker themes/branding
- [ ] Ticker embed codes for external sites
- [ ] Advanced analytics (user engagement metrics)

## Support

For issues or questions:
- Check the migration files: `20251103120000_live_ticker_schema.sql`
- Review cron jobs: `20251103120001_live_ticker_cron.sql`
- Examine the existing live score system in earlier migrations

## Schema Version

**Version**: 1.0
**Created**: 2025-11-03
**Migration**: `20251103120000_live_ticker_schema.sql`
**Cron Jobs**: `20251103120001_live_ticker_cron.sql`
