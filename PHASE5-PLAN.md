# Phase 5: Live Bet Tracking & In-Game Alerts

## 🎯 Goal
Build a real-time tracking system that monitors active bets during games, provides live updates on bet status, detects scoring plays that affect bets, and sends intelligent alerts for critical moments.

## 📊 Current State Analysis

### What We Have (From Phases 1-4):
- ✅ Bet placement and settlement
- ✅ Live odds from The Rundown API
- ✅ EV and Kelly calculations
- ✅ CLV tracking
- ✅ User preferences and patterns
- ❌ No live score monitoring during games
- ❌ No in-game bet tracking
- ❌ No real-time alerts
- ❌ No win probability updates
- ❌ No live line movement alerts

## 🏗️ Phase 5 Features

### Feature 1: Live Bet Tracking

**What**: Monitor all active (pending) bets in real-time during games
**Why**: Users want to know how their bets are performing live

**Tracking Elements**:
- Current score vs bet requirements
- Current status: Winning, Losing, or Push territory
- Points needed to cover spread
- Points needed for over/under
- Time remaining in game
- Live win probability (updated throughout game)

**Example**:
```
User bet: Lakers -4.5 at -110
Current score: Lakers 95 - Celtics 88 (3:24 remaining Q4)
Current spread: Lakers by 7
Status: ✅ WINNING (need to maintain 4.5+ lead)
Live win probability: 87% (up from 58% pre-game)
```

### Feature 2: Intelligent Alerts System

**What**: Send alerts for critical moments in games affecting bets
**Why**: Users can't watch every game - alerts keep them informed

**Alert Types**:

1. **Game Starting Alert**
   - "Your Lakers -4.5 bet is about to start!"
   - Includes: Opening score, starting lineups, any late scratches

2. **Momentum Shift Alert**
   - "Lakers have lost the lead! Your spread bet is now in danger"
   - Triggers: Lead change, big run against bet

3. **Critical Moment Alert**
   - "Lakers up 5 with 2 minutes left - your -4.5 bet looking good!"
   - Triggers: Close game in final minutes, bet on the edge

4. **Hedge Opportunity Alert**
   - "Lakers up 10 at halftime - consider hedging your -4.5 bet"
   - Shows live odds for opposite side, calculates guaranteed profit

5. **Bad Beat Prevention Alert**
   - "Lakers up 4.5 with 30 seconds left - SWEAT TIME!"
   - Alerts when bet could be lost by late score

6. **Bet Won Alert**
   - "🎉 Your Lakers -4.5 bet WON! +$90.91"
   - Immediate notification when bet outcome is certain

7. **Line Movement Alert**
   - "Lakers line moved from -4.5 to -6! You have +1.5 CLV"
   - Tracks when you got better line than current

**Alert Urgency Levels**:
- 🔴 **CRITICAL**: Final minutes, bet on edge
- 🟡 **IMPORTANT**: Momentum shift, lead change
- 🟢 **INFO**: Game starting, hedge opportunity
- 🔵 **OUTCOME**: Bet won/lost

### Feature 3: Live Score Monitoring

**What**: Poll The Rundown API for live scores every 60 seconds
**Why**: Keep bet statuses up-to-date in real-time

**Implementation**:
- Background job runs every 60 seconds
- Fetches live scores for all games with active bets
- Updates bet status (winning/losing/push)
- Calculates current win probability
- Triggers alerts based on score changes

**Score Data Tracked**:
- Current score (home/away)
- Quarter/period and time remaining
- Game status (in_progress, halftime, final)
- Last scoring play (who scored last)
- Scoring runs (e.g., "Lakers on 12-2 run")

### Feature 4: Live Win Probability Model

**What**: Update win probability throughout the game
**Why**: Shows how likely bet is to cash based on current situation

**Model Inputs**:
- Current score and time remaining
- Team Elo ratings
- Pace of game (possessions remaining)
- Recent momentum (last 5 minutes scoring)
- Historical comeback data

**Example**:
```
Pre-game: Lakers 58% to win
Halftime (Lakers up 8): 72% to win
Q4 5:00 (Lakers up 4): 65% to win
Q4 1:00 (Lakers up 3): 61% to win
Final (Lakers win by 6): 100%
```

**Formula (Simplified)**:
```
Win Prob = f(Score Differential, Time Remaining, Team Ratings, Possessions Left)
```

### Feature 5: Hedge Calculator

**What**: Calculate optimal hedge opportunities mid-game
**Why**: Lock in profit or minimize loss when situation changes

**Hedge Scenarios**:

1. **Profit Lock**
   - User bet Lakers -4.5 at -110 ($100)
   - Lakers up 15 at halftime
   - Celtics now +10.5 at -110
   - Hedge with $50 on Celtics +10.5
   - Guaranteed profit of ~$35 regardless of outcome

2. **Loss Minimization**
   - User bet Lakers -4.5 at -110 ($100)
   - Lakers down 8 at halftime
   - Lakers now +3.5 at -110
   - Hedge to reduce loss from $100 to $30

**Implementation**:
- Function: `calculate_hedge(original_bet, current_odds)`
- Shows: Hedge amount, guaranteed profit/loss, recommendation
- Real-time odds from The Rundown API

### Feature 6: Live Dashboard

**What**: Real-time dashboard showing all active bets
**Why**: Users can see all bets at a glance

**Dashboard Elements**:
- Active bets list with live status
- Currently winning bets (green)
- Currently losing bets (red)
- Close bets needing attention (yellow)
- Total exposure (total $ at risk)
- Live P/L (projected profit/loss based on current status)

**Real-Time Updates**:
- WebSocket or polling updates every 60 seconds
- Color-coded status indicators
- Progress bars for spread coverage
- Time remaining countdown

### Feature 7: Game Watching Mode

**What**: Dedicated view for following a specific game
**Why**: Deep dive into one game affecting multiple bets

**Features**:
- Live score updates every 15-30 seconds
- Play-by-play feed (when available)
- Momentum tracker (last 5 min scoring)
- Win probability chart (updates over time)
- All user bets on this game
- Hedge opportunities
- Live line movement graph

### Feature 8: Smart Notification Settings

**What**: Customizable alert preferences
**Why**: Not all users want all alerts

**Settings**:
```javascript
{
  game_starting: true,           // Always notify when game starts
  momentum_shifts: true,          // Alert on big runs
  critical_moments: true,         // Final 5 minutes alerts
  hedge_opportunities: false,     // Don't spam hedge suggestions
  bad_beat_warnings: true,        // Alert when bet on edge late
  bet_outcomes: true,             // Always notify win/loss
  line_movements: false,          // Don't need CLV alerts during game
  min_bet_amount: 50,             // Only alert for bets $50+
  quiet_hours: {                  // No alerts during sleep
    enabled: true,
    start: "23:00",
    end: "08:00"
  }
}
```

## 📁 Database Schema

### Table: `live_bet_tracking`
```sql
CREATE TABLE live_bet_tracking (
  id UUID PRIMARY KEY,
  bet_id UUID REFERENCES bets(id),
  user_id UUID REFERENCES auth.users(id),
  game_id TEXT NOT NULL,

  -- Current game state
  current_home_score INTEGER,
  current_away_score INTEGER,
  current_period TEXT, -- 'Q1', 'Q2', 'Q3', 'Q4', 'OT', 'Final'
  time_remaining TEXT, -- '5:24', '2:00', etc.
  game_status TEXT, -- 'scheduled', 'in_progress', 'halftime', 'final'

  -- Bet status
  bet_status TEXT, -- 'winning', 'losing', 'push', 'uncertain'
  points_needed_to_cover NUMERIC, -- For spreads
  points_from_total NUMERIC, -- For totals (current total - line)

  -- Win probability
  pre_game_win_prob NUMERIC,
  current_win_prob NUMERIC,
  win_prob_change NUMERIC, -- current - pre_game

  -- Momentum
  last_5min_home_points INTEGER,
  last_5min_away_points INTEGER,
  momentum_team TEXT, -- 'home', 'away', 'neutral'

  -- Alerts sent
  alerts_sent JSONB DEFAULT '[]', -- Array of alert types already sent

  -- Last update
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Table: `bet_alerts`
```sql
CREATE TABLE bet_alerts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  bet_id UUID REFERENCES bets(id),

  -- Alert details
  alert_type TEXT NOT NULL, -- 'game_starting', 'momentum_shift', 'critical_moment', etc.
  urgency TEXT NOT NULL, -- 'critical', 'important', 'info', 'outcome'
  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Context
  game_id TEXT,
  current_score TEXT,
  time_remaining TEXT,

  -- Hedge info (if applicable)
  hedge_opportunity JSONB,

  -- Status
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ,

  -- Delivery
  delivery_method TEXT, -- 'push', 'in_app', 'email'
  delivered_at TIMESTAMPTZ,

  INDEX idx_bet_alerts_user_unread (user_id, is_read) WHERE is_read = false
);
```

### Table: `user_alert_settings`
```sql
CREATE TABLE user_alert_settings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE,

  -- Alert toggles
  enable_game_starting BOOLEAN DEFAULT true,
  enable_momentum_shifts BOOLEAN DEFAULT true,
  enable_critical_moments BOOLEAN DEFAULT true,
  enable_hedge_opportunities BOOLEAN DEFAULT false,
  enable_bad_beat_warnings BOOLEAN DEFAULT true,
  enable_bet_outcomes BOOLEAN DEFAULT true,
  enable_line_movements BOOLEAN DEFAULT false,

  -- Filters
  min_bet_amount NUMERIC DEFAULT 0, -- Only alert for bets above this amount

  -- Quiet hours
  enable_quiet_hours BOOLEAN DEFAULT false,
  quiet_hours_start TIME, -- e.g., '23:00'
  quiet_hours_end TIME, -- e.g., '08:00'

  -- Delivery preferences
  prefer_push_notifications BOOLEAN DEFAULT true,
  prefer_email BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Table: `live_score_cache`
```sql
CREATE TABLE live_score_cache (
  id UUID PRIMARY KEY,
  game_id TEXT NOT NULL UNIQUE,
  league TEXT NOT NULL,

  -- Teams
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,

  -- Current score
  home_score INTEGER,
  away_score INTEGER,

  -- Game state
  period TEXT, -- 'Q1', 'Q2', etc.
  time_remaining TEXT,
  game_status TEXT,

  -- Last scoring play
  last_score_team TEXT,
  last_score_points INTEGER,
  last_score_time TEXT,

  -- Momentum (last 5 minutes)
  last_5min_home_points INTEGER DEFAULT 0,
  last_5min_away_points INTEGER DEFAULT 0,

  -- Metadata
  game_date TIMESTAMPTZ,
  last_updated TIMESTAMPTZ DEFAULT now(),

  INDEX idx_live_score_game_id (game_id),
  INDEX idx_live_score_status (game_status) WHERE game_status = 'in_progress'
);
```

## 🛠️ Implementation Steps

### Step 1: Create Database Migrations
- [ ] `20251031120000_phase5_live_tracking.sql` - Live bet tracking
- [ ] `20251031120001_phase5_alerts_system.sql` - Alerts and notifications
- [ ] `20251031120002_phase5_live_scores.sql` - Live score caching

### Step 2: Create Core Functions
- [ ] `update_live_bet_tracking(bet_id)` - Updates bet status from live scores
- [ ] `calculate_live_win_probability(game_id, bet_id)` - Real-time win prob
- [ ] `detect_alert_conditions(bet_id)` - Determines if alert should be sent
- [ ] `send_bet_alert(user_id, bet_id, alert_type, message)` - Sends alert
- [ ] `calculate_hedge_opportunity(bet_id, current_odds)` - Hedge calculator
- [ ] `fetch_and_cache_live_scores()` - Fetches from Rundown API

### Step 3: Create Background Jobs
- [ ] **Every 60 seconds**: Fetch live scores for all active games
- [ ] **Every 60 seconds**: Update bet tracking for all pending bets
- [ ] **Every 60 seconds**: Check alert conditions and send alerts
- [ ] **Every 5 minutes**: Clean up old alerts and tracking data

### Step 4: Create Edge Functions
- [ ] `monitor-live-bets` - Main orchestration function
- [ ] `send-bet-alert` - Alert sending function
- [ ] `get-active-bets-status` - API for dashboard

### Step 5: Frontend Components
- [ ] Live bet tracking dashboard component
- [ ] Alert notifications component
- [ ] Game watching mode component
- [ ] Alert settings page

### Step 6: Real-Time Updates
- [ ] Set up Supabase Realtime for live updates
- [ ] Subscribe to `live_bet_tracking` changes
- [ ] Subscribe to `bet_alerts` for new alerts
- [ ] Update dashboard in real-time

## 📝 Example User Flows

### Flow 1: Game Day Experience
```
1. User places bet: Lakers -4.5 at -110 ($100)
2. 15 min before game: "Your Lakers -4.5 bet starts soon!"
3. Game starts: Live tracking activated
4. Q1 7:24 - Lakers up 12: Status shows "WINNING"
5. Q2 3:45 - Celtics on 14-2 run: "⚠️ Momentum shift! Celtics cutting into lead"
6. Halftime - Lakers up 5: "✅ Covering by 0.5 points. Win probability: 63%"
7. Q4 2:30 - Lakers up 3: "🔴 CRITICAL: Need 1.5 more points to cover!"
8. Q4 0:05 - Lakers up 6: "🎉 Your bet WON! +$90.91"
9. Final: Bet settled automatically, CLV calculated
```

### Flow 2: Hedge Opportunity
```
1. User bet: Lakers -4.5 at -110 ($100 to win $90.91)
2. Halftime: Lakers up 15
3. Alert: "Lakers dominating! Celtics now +10.5 at -110"
4. Show hedge: "Bet $55 on Celtics +10.5 to guarantee $35 profit"
5. User decides: Take hedge or let original bet ride
```

### Flow 3: Bad Beat Alert
```
1. User bet: Lakers -4.5 at -110
2. Q4 1:00 - Lakers up 8: "✅ Looking good!"
3. Q4 0:30 - Lakers up 5: "⚠️ Still safe but don't relax"
4. Q4 0:10 - Lakers up 4: "🔴 SWEAT TIME! Need to hold for 0.5"
5. Q4 0:02 - Celtics score: Lakers only up 2
6. Final: "❌ Bad beat - Lakers won but didn't cover"
```

## 🎯 Success Metrics

1. **Alert Accuracy**: >95% of alerts are relevant
2. **Response Time**: Alerts sent within 60 seconds of trigger
3. **Engagement**: 70%+ of alerts are read
4. **Hedge Success**: 50%+ of hedge opportunities are profitable
5. **User Satisfaction**: Reduces anxiety, increases engagement

## 📊 Technical Considerations

### Rate Limiting
- The Rundown API: Respect rate limits (likely 100-500 requests/min)
- Batch score fetches by league
- Cache scores for 60 seconds minimum

### Database Load
- Live tracking generates lots of writes
- Use indexes on frequently queried columns
- Archive old tracking data after games complete
- Use materialized views for dashboards

### Alert Spam Prevention
- Debounce alerts (don't send same type twice in 5 min)
- Track alerts sent in `alerts_sent` JSONB array
- Respect quiet hours
- Min bet amount filter
- Max N alerts per game

### Real-Time Architecture
```
The Rundown API (live scores)
          ↓
Supabase Edge Function (fetch-live-scores)
          ↓
live_score_cache table
          ↓
Supabase Edge Function (monitor-live-bets)
          ↓
live_bet_tracking table
          ↓
Supabase Realtime Subscriptions
          ↓
User's Dashboard (React components)
```

## 🚀 Future Enhancements (Phase 5.5)

- **Push Notifications**: Mobile push via Firebase/OneSignal
- **SMS Alerts**: Twilio integration for critical moments
- **Voice Alerts**: "Your Lakers bet is about to lose"
- **Live Chat**: Discuss bets with other users during game
- **Live Streaming**: Embedded game streams (if possible)
- **AI Commentary**: GPT generates play-by-play commentary
- **Bet Builder**: Create live bets during game based on momentum

---

**Phase 5 transforms the app from a tracker into a live betting companion that keeps users informed and helps them make smart decisions during games.**
