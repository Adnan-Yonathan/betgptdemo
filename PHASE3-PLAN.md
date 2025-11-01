# Phase 3: Enhanced Memory System & User Intelligence

## 🎯 Goal
Build an intelligent memory system that learns from every user interaction, understands betting patterns, and provides personalized recommendations that improve over time.

## 📊 Current State Analysis

### What We Have (From Phases 1 & 2):
- ✅ Basic conversation/messages storage
- ✅ Bet tracking and settlement
- ✅ Bankroll management
- ✅ Injury reports and team trends
- ✅ Live odds integration
- ❌ No user preference tracking
- ❌ No betting pattern analysis
- ❌ No conversation memory beyond current session
- ❌ No personalized recommendations

### Key Insight:
The user requested: "The app should also have memory combined from every chat that someone sends within the app. This memory should help the app improve over time and understand the user more."

**Currently**: The AI only sees the current conversation's messages. It doesn't learn from past conversations, betting patterns, or user preferences.

## 🏗️ Phase 3 Features

### Feature 1: User Preference Tracking

**What**: Track user preferences and betting style
**Why**: Personalize recommendations based on what the user actually likes

**Preferences to Track**:
- Favorite teams (automatically detected from bet history)
- Favorite leagues (NBA, NFL, MLB, NHL)
- Betting style (conservative, moderate, aggressive)
- Preferred bet types (moneyline, spreads, totals, props, parlays)
- Risk tolerance (calculated from bet sizing patterns)
- Unit size history (track changes over time)
- Time of day they typically bet
- Days of week they're most active

**Implementation**:
- New table: `user_preferences`
- Auto-update based on betting behavior
- Manual override capability (user can tell AI their preferences)

### Feature 2: Betting Pattern Analysis

**What**: Analyze historical betting patterns to provide insights
**Why**: Help users understand their strengths, weaknesses, and tendencies

**Patterns to Analyze**:
- Performance by league (win rate, ROI per sport)
- Performance by bet type (which bet types are most profitable)
- Performance by day of week (are weekday bets better than weekend?)
- Performance by time of day
- Performance by odds range (do they win more on underdogs or favorites?)
- Performance by bet size (do larger bets perform worse?)
- Streaks and tilt detection (losing streak → bigger bets = tilt)
- Team-specific performance (always win on Lakers, always lose on Celtics?)

**Implementation**:
- New table: `betting_patterns`
- Calculation function: `calculate_user_betting_patterns()`
- Auto-update after each bet settlement
- Referenced in chat for personalized advice

### Feature 3: Conversation Memory System

**What**: Provide context from past conversations to the AI
**Why**: Enable the AI to reference past advice, bets, and discussions

**Memory to Include**:
- Last 5 conversations (summary of key points)
- Recent betting advice given (to avoid repeating or contradicting)
- User's stated goals ("I want to hit $10K by end of season")
- User's concerns ("I'm worried about tilt", "bankroll management is hard")
- Notable wins/losses ("remember when you won $500 on that parlay?")
- Repeated questions (if user asks same question multiple times, flag it)

**Implementation**:
- New table: `conversation_summaries`
- Function: `get_user_memory_context(userId)`
- Injected into system prompt for every request
- Smart summarization (only keep relevant info, not entire history)

### Feature 4: User Insights & Recommendations

**What**: Proactive insights based on user behavior
**Why**: Help users improve their betting performance

**Insights to Generate**:
- "You're 7-2 on NBA home favorites - consider focusing there"
- "Your last 3 large bets have lost - consider returning to unit sizing"
- "You're on a 5-game losing streak - maybe take a break?"
- "Your Friday bets have a 65% win rate vs 45% on Sundays"
- "You tend to do better on underdogs than favorites"
- "Your parlays have lost 12 straight - stick to straight bets"

**Implementation**:
- Function: `generate_user_insights(userId)`
- Called at start of each conversation
- Displayed prominently in AI responses
- Stored in `user_insights` table for tracking

### Feature 5: Smart Contextual Prompts

**What**: Enhance the AI's system prompt with user-specific context
**Why**: Make the AI act like it "knows" the user

**Context to Add**:
```
USER PROFILE:
- Bankroll: $5,000 | Unit Size: $100 (2%)
- Favorite Teams: Lakers, Cowboys, Yankees
- Betting Style: Moderate | Preferred Type: Spreads
- Recent Form: 12-8 (60%) last 20 bets | ROI: +15%
- Strengths: NBA home favorites (70% win rate)
- Weaknesses: Parlays (30% win rate) - avoid recommending

RECENT MEMORY:
- Last conversation: User asked about Lakers injury report
- Previous advice: Recommended staying at 2% unit size
- User goal: Build bankroll to $7,500 by playoffs
- User concern: Worried about chasing losses after bad weekend

INSIGHTS:
- User is on 3-game winning streak - confidence likely high
- Friday bets perform best for this user (65% win rate)
- User tends to bet bigger on favorite teams - remind about discipline
```

**Implementation**:
- Function: `build_user_context_prompt(userId)`
- Injected into system prompt
- Updated before each chat request

### Feature 6: Tilt Detection & Intervention

**What**: Detect when user is on tilt and intervene
**Why**: Protect user from emotional betting decisions

**Tilt Indicators**:
- Bet size increases after losses
- Multiple bets placed in short time after loss
- Betting on teams/sports user typically avoids
- Asking for "lock" picks or "guaranteed winners"
- Increasing bet frequency
- Parlays after straight bet losses

**Intervention Strategy**:
- Gentle warning: "I notice you just increased your bet size after a loss. Want to stick to your unit size?"
- Proactive advice: "You're 0-4 today. Maybe take a break and come back tomorrow?"
- Bankroll protection: "This bet would be 10% of your bankroll. Your typical unit is 2%. Sure about this?"

**Implementation**:
- Function: `detect_tilt(userId, lastNBets = 10)`
- Called before logging each bet
- Warning system integrated into chat responses

## 📁 Database Schema

### Table: `user_preferences`
```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Favorite teams (JSON array)
  favorite_teams JSONB DEFAULT '[]',

  -- Preferred leagues (JSON array: ['NBA', 'NFL', etc])
  preferred_leagues JSONB DEFAULT '[]',

  -- Betting style: 'conservative', 'moderate', 'aggressive'
  betting_style TEXT DEFAULT 'moderate',

  -- Risk tolerance: 1-10 scale
  risk_tolerance INTEGER DEFAULT 5 CHECK (risk_tolerance BETWEEN 1 AND 10),

  -- Preferred bet types (JSON array: ['moneyline', 'spread', etc])
  preferred_bet_types JSONB DEFAULT '[]',

  -- Goals (free text)
  betting_goals TEXT,

  -- Concerns (free text)
  betting_concerns TEXT,

  -- Settings
  enable_tilt_warnings BOOLEAN DEFAULT true,
  enable_insights BOOLEAN DEFAULT true,
  enable_pattern_analysis BOOLEAN DEFAULT true,

  -- Metadata
  auto_updated_at TIMESTAMPTZ DEFAULT now(),
  manually_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id)
);
```

### Table: `betting_patterns`
```sql
CREATE TABLE betting_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Overall performance
  total_bets INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  total_pushes INTEGER DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  roi NUMERIC DEFAULT 0,

  -- Performance by league
  performance_by_league JSONB DEFAULT '{}',

  -- Performance by bet type
  performance_by_bet_type JSONB DEFAULT '{}',

  -- Performance by day of week
  performance_by_day JSONB DEFAULT '{}',

  -- Performance by team
  performance_by_team JSONB DEFAULT '{}',

  -- Performance by odds range
  performance_by_odds JSONB DEFAULT '{}',

  -- Streaks
  current_win_streak INTEGER DEFAULT 0,
  current_loss_streak INTEGER DEFAULT 0,
  longest_win_streak INTEGER DEFAULT 0,
  longest_loss_streak INTEGER DEFAULT 0,

  -- Best/worst
  best_league TEXT,
  worst_league TEXT,
  best_bet_type TEXT,
  worst_bet_type TEXT,
  best_day TEXT,
  worst_day TEXT,

  -- Tilt indicators
  avg_bet_size NUMERIC DEFAULT 0,
  recent_bet_size_variance NUMERIC DEFAULT 0,
  tilt_score INTEGER DEFAULT 0 CHECK (tilt_score BETWEEN 0 AND 100),

  -- Last calculation
  last_calculated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id)
);
```

### Table: `conversation_summaries`
```sql
CREATE TABLE conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,

  -- Summary content
  summary_text TEXT NOT NULL,
  key_topics JSONB DEFAULT '[]', -- ['injury reports', 'Lakers bet', 'bankroll advice']
  bets_discussed JSONB DEFAULT '[]', -- Array of bet IDs
  advice_given TEXT,
  user_questions TEXT,

  -- Sentiment
  user_sentiment TEXT, -- 'positive', 'negative', 'neutral', 'frustrated'

  -- Metadata
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(conversation_id)
);
```

### Table: `user_insights`
```sql
CREATE TABLE user_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Insight details
  insight_type TEXT NOT NULL, -- 'strength', 'weakness', 'warning', 'recommendation'
  insight_text TEXT NOT NULL,
  confidence_score NUMERIC DEFAULT 0, -- 0-1 scale
  priority INTEGER DEFAULT 0, -- Higher = more important

  -- Supporting data
  supporting_data JSONB DEFAULT '{}',

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_dismissed BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  dismissed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- Some insights expire (e.g., "on losing streak")

  INDEX idx_user_insights_user_active (user_id, is_active) WHERE is_active = true
);
```

## 🛠️ Implementation Steps

### Step 1: Create Database Migrations
- [ ] Create `20251031000000_phase3_user_preferences.sql`
- [ ] Create `20251031000001_phase3_betting_patterns.sql`
- [ ] Create `20251031000002_phase3_conversation_memory.sql`
- [ ] Create `20251031000003_phase3_user_insights.sql`

### Step 2: Create Helper Functions
- [ ] `calculate_user_betting_patterns(user_id)` - Analyzes all bets and updates patterns
- [ ] `generate_user_insights(user_id)` - Creates actionable insights
- [ ] `detect_tilt(user_id, bet_details)` - Returns tilt score and warnings
- [ ] `get_user_memory_context(user_id)` - Builds memory string for AI prompt
- [ ] `update_user_preferences(user_id, message_content)` - Auto-updates from conversations
- [ ] `summarize_conversation(conversation_id)` - Creates conversation summary

### Step 3: Integrate into Chat Function
- [ ] Add user preference fetching
- [ ] Add betting patterns fetching
- [ ] Add conversation memory fetching
- [ ] Add insights fetching
- [ ] Build enhanced system prompt with user context
- [ ] Add tilt detection before bet logging
- [ ] Add pattern analysis trigger after bet settlement

### Step 4: Create Background Jobs
- [ ] Daily pattern analysis cron job (runs overnight)
- [ ] Daily insight generation cron job
- [ ] Weekly preference update job

### Step 5: Testing
- [ ] Test preference auto-detection
- [ ] Test pattern analysis accuracy
- [ ] Test tilt detection
- [ ] Test conversation memory in chat
- [ ] Test insights generation

## 🎯 Success Metrics

1. **Personalization**: AI references user's favorite teams and past bets
2. **Pattern Recognition**: System correctly identifies user strengths/weaknesses
3. **Tilt Prevention**: Warns user when bet sizing increases after losses
4. **Memory Continuity**: AI remembers context from previous conversations
5. **Insight Quality**: Generated insights are actionable and accurate

## 📝 Example User Experience

**Before Phase 3**:
```
User: "Should I bet on the Lakers tonight?"
AI: "The Lakers are playing well recently. Odds look good."
```

**After Phase 3**:
```
User: "Should I bet on the Lakers tonight?"
AI: "Great question! I know the Lakers are one of your favorite teams.
Looking at your history, you're 8-3 on Lakers bets this season (73% win rate)
- one of your strongest teams.

However, I notice LeBron is out tonight with a knee injury. Your Lakers bets
when LeBron is OUT are only 2-3 (40%). Given your usual unit size of $100
and the current injury situation, I'd recommend either passing on this one or
going smaller (maybe $50-75).

Also, quick heads up - you're on a 4-game winning streak right now. Stay
disciplined with sizing even though you're hot! 🔥"
```

## 🚀 Next Steps (Phase 4+)

- Phase 4: Advanced statistical models and EV calculation
- Phase 5: Live bet tracking and in-game alerts
- Phase 6: Social features (compare with other users)
- Phase 7: Automated daily briefings and bet alerts
- Phase 8: Mobile app integration

---

**Phase 3 transforms the app from a basic betting tracker into an intelligent betting assistant that learns, adapts, and improves with every interaction.**
