# Phase 4: Advanced Statistical Models & Expected Value Analysis

## 🎯 Goal
Build sophisticated statistical models that calculate Expected Value (EV), detect market inefficiencies, track Closing Line Value (CLV), and provide quantitative edges for betting decisions.

## 📊 Current State Analysis

### What We Have (From Phases 1-3):
- ✅ Live odds from The Rundown API
- ✅ Injury reports and team trends
- ✅ User betting patterns and performance tracking
- ✅ Conversational bet tracking
- ❌ No EV calculation system
- ❌ No statistical models for predictions
- ❌ No CLV tracking
- ❌ No market inefficiency detection
- ❌ No quantitative edge analysis

### Key Insight:
The user requested: "Give a full statistical analysis to find an edge in games for the user."

**Currently**: The AI provides betting analysis but doesn't calculate mathematical edges, expected value, or track whether users are beating the closing line (the ultimate measure of betting skill).

## 🏗️ Phase 4 Features

### Feature 1: Expected Value (EV) Calculator

**What**: Calculate the mathematical expected value of every bet
**Why**: EV is the foundation of profitable betting - only +EV bets are worth making

**EV Formula**:
```
EV = (Win Probability × Profit if Win) - (Loss Probability × Stake)
EV% = (EV / Stake) × 100
```

**Example**:
- Bet: $100 on Lakers -110 odds
- Your Win Probability: 58%
- Implied Probability (from odds): 52.4%
- Profit if Win: $90.91
- EV = (0.58 × $90.91) - (0.42 × $100) = $52.73 - $42 = **+$10.73**
- EV% = **+10.73%**

**Implementation**:
- Function: `calculate_ev(win_probability, odds, stake)`
- Store in `bet_ev_analysis` table
- Display in AI responses
- Track cumulative EV vs actual results

### Feature 2: Win Probability Models

**What**: Statistical models that estimate true win probability
**Why**: Can't calculate EV without knowing true win probability

**Models to Implement**:

1. **Elo Rating Model**
   - Each team has an Elo rating (updated after each game)
   - Win probability based on rating difference
   - Adjusts for home court advantage
   - Formula: `P(A wins) = 1 / (1 + 10^((Elo_B - Elo_A) / 400))`

2. **Regression Model**
   - Based on team statistics (pace, efficiency, rest, etc.)
   - Recent form weighted higher
   - Injury adjustments
   - Situational factors (back-to-back, travel, etc.)

3. **Market-Based Model**
   - Uses market odds as baseline
   - Adjusts based on sharp money indicators
   - Line movement analysis
   - Steam move detection

4. **Ensemble Model**
   - Combines all models with weights
   - More robust than single model
   - Adjusts weights based on historical accuracy

**Implementation**:
- Store team ratings in `team_ratings` table
- Store model predictions in `game_predictions` table
- Update ratings after each game
- Track model accuracy over time

### Feature 3: Closing Line Value (CLV) Tracking

**What**: Track how user's bets compare to the closing line
**Why**: CLV is the #1 predictor of long-term betting success

**Why CLV Matters**:
- The closing line is the sharpest price (incorporates all information)
- Beating the closing line = finding value
- Studies show CLV correlates 0.7+ with long-term profit
- Even losing bets with +CLV are "good bets"

**Example**:
- User bets Lakers -4.5 at -110
- Game closes at Lakers -6.5
- CLV = +2 points = **Excellent value bet**
- Even if bet loses, it was still +EV

**Implementation**:
- Store opening and closing lines in `line_history` table
- Calculate CLV for every settled bet
- Track user's average CLV
- Display CLV in bet history
- Generate insights: "Your average CLV is +1.2 points - you're beating the market!"

### Feature 4: Market Inefficiency Detection

**What**: Identify games where the market may be mispriced
**Why**: These are the best betting opportunities

**Inefficiencies to Detect**:

1. **Line Movement Discrepancies**
   - Line moving against the money (reverse line movement)
   - Indicates sharp money on one side
   - Example: 80% of bets on Lakers, line moves from -4 to -3.5 (sharps on opponent)

2. **Model Disagreement**
   - Your model predicts 62% win probability
   - Market implies 52% win probability
   - **Edge = 10%** = major opportunity

3. **Recency Bias**
   - Market overreacts to recent results
   - Example: Team loses 3 straight, odds inflate
   - Historical data shows regression to mean

4. **Injury Overreaction**
   - Market overvalues star players
   - Replacement players sometimes perform well
   - Historical replacement impact data

5. **Public Bias**
   - Market favors popular teams (Lakers, Cowboys, etc.)
   - Creates value on unpopular opponents
   - Track public betting percentages vs line movement

**Implementation**:
- Function: `detect_market_inefficiencies(game_id)`
- Store in `market_inefficiencies` table
- Alert users to high-value opportunities
- Track success rate of flagged inefficiencies

### Feature 5: Statistical Edge Calculation

**What**: Quantify the edge on every betting opportunity
**Why**: Users need to know if a bet is worth making

**Edge Formula**:
```
Edge = Your Win Probability - Market Implied Probability
```

**Example**:
- Your Model: 58% win probability
- Market Odds: -110 (implies 52.4%)
- **Edge = +5.6%**

**Bet Recommendation Based on Edge**:
- Edge < 0%: **Never bet** (negative EV)
- Edge 0-2%: **Pass** (edge too small, variance eats it)
- Edge 2-5%: **Small bet** (slight edge, bet 0.5-1% of bankroll)
- Edge 5-10%: **Standard bet** (solid edge, bet 1-3% of bankroll)
- Edge 10%+: **Strong bet** (major edge, bet 3-5% of bankroll)

**Implementation**:
- Calculate for every game with available odds
- Store in `betting_edges` table
- Display in AI responses with confidence intervals
- Track realized edge vs estimated edge

### Feature 6: Kelly Criterion Bet Sizing

**What**: Optimal bet sizing based on edge and bankroll
**Why**: Maximizes long-term growth while managing risk

**Full Kelly Formula**:
```
Kelly % = (Edge × Odds) / (Odds - 1)
```

**Example**:
- Edge: 5.6%
- Odds: -110 (1.909 in decimal)
- Kelly = (0.056 × 1.909) / (1.909 - 1) = 0.107 / 0.909 = **11.8%**
- **Full Kelly = 11.8% of bankroll**
- **Quarter Kelly (recommended) = 2.95% of bankroll**

**Why Fractional Kelly**:
- Full Kelly is mathematically optimal but volatile
- Quarter Kelly (0.25x) reduces variance
- Half Kelly (0.5x) is middle ground
- Accounts for model uncertainty

**Implementation**:
- Function: `calculate_kelly(edge, odds, bankroll, fraction = 0.25)`
- Display in AI recommendations
- Warn when user bets >5% of bankroll
- Track Kelly adherence vs performance

### Feature 7: Line Shopping & Arbitrage Detection

**What**: Compare odds across multiple sportsbooks
**Why**: Getting the best line adds significant long-term value

**Best Line Value**:
- Same bet, different odds = different EV
- Example: Lakers -4.5 at -110 vs -4.5 at -105
- -105 is better (requires less to win same amount)
- 5 cent improvement = ~2.5% better EV

**Arbitrage Opportunities**:
- Rare but profitable
- Example: Lakers -4.5 at +105, Opponent +4.5 at +100
- Bet both sides = guaranteed profit
- Must account for vig and timing

**Implementation**:
- Store odds from all available sportsbooks
- Highlight best available line
- Alert to arbitrage opportunities
- Track line shopping savings

### Feature 8: Historical Performance Metrics

**What**: Track advanced metrics over time
**Why**: Measure betting skill beyond win rate

**Metrics to Track**:

1. **ROI (Return on Investment)**
   - Most important metric
   - Formula: (Total Profit / Total Wagered) × 100
   - Good: 5%+, Great: 10%+, Elite: 15%+

2. **CLV (Closing Line Value)**
   - Average points/price improvement vs closing
   - Strongest predictor of long-term success
   - Target: +1.5 points or better

3. **Yield**
   - Similar to ROI but accounts for pushes
   - Formula: Net Profit / (Total Wagered - Push Stakes)

4. **Sharpe Ratio**
   - Risk-adjusted returns
   - Formula: (Average Return - Risk-Free Rate) / Standard Deviation
   - Accounts for volatility

5. **Kelly Efficiency**
   - How closely user follows Kelly sizing
   - Overbet = increased variance, underbet = slower growth

6. **Hit Rate by Odds Range**
   - Performance on favorites vs underdogs
   - Identifies where user has edge

**Implementation**:
- Calculate automatically after each bet
- Store in `advanced_metrics` table
- Display in dashboard
- Compare to benchmarks

## 📁 Database Schema

### Table: `team_ratings`
```sql
CREATE TABLE team_ratings (
  id UUID PRIMARY KEY,
  team_name TEXT NOT NULL,
  league TEXT NOT NULL,
  elo_rating NUMERIC DEFAULT 1500,
  offensive_rating NUMERIC,
  defensive_rating NUMERIC,
  pace_rating NUMERIC,
  last_updated TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_name, league)
);
```

### Table: `game_predictions`
```sql
CREATE TABLE game_predictions (
  id UUID PRIMARY KEY,
  game_id TEXT,
  league TEXT,
  home_team TEXT,
  away_team TEXT,
  game_date TIMESTAMPTZ,

  -- Model predictions (0-1 probability)
  elo_model_prob NUMERIC,
  regression_model_prob NUMERIC,
  market_model_prob NUMERIC,
  ensemble_model_prob NUMERIC,

  -- Confidence intervals
  confidence_lower NUMERIC,
  confidence_upper NUMERIC,

  -- Actual result
  home_team_won BOOLEAN,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Table: `bet_ev_analysis`
```sql
CREATE TABLE bet_ev_analysis (
  id UUID PRIMARY KEY,
  bet_id UUID REFERENCES bets(id),
  user_id UUID REFERENCES auth.users(id),

  -- EV Calculation
  estimated_win_prob NUMERIC, -- 0-1
  market_implied_prob NUMERIC, -- 0-1
  edge_percentage NUMERIC, -- estimated - implied
  expected_value_dollars NUMERIC,
  expected_value_percentage NUMERIC,

  -- Kelly Criterion
  kelly_full_percentage NUMERIC,
  kelly_quarter_percentage NUMERIC,
  recommended_bet_size NUMERIC,
  actual_bet_size NUMERIC,
  kelly_efficiency NUMERIC, -- actual / recommended

  -- CLV (filled after game closes)
  opening_odds NUMERIC,
  closing_odds NUMERIC,
  clv_points NUMERIC,
  clv_dollars NUMERIC,
  beat_closing_line BOOLEAN,

  -- Actual outcome (filled after settlement)
  actual_outcome TEXT, -- 'win', 'loss', 'push'
  actual_profit_loss NUMERIC,
  ev_realization_error NUMERIC, -- actual - expected

  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Table: `market_inefficiencies`
```sql
CREATE TABLE market_inefficiencies (
  id UUID PRIMARY KEY,
  game_id TEXT,
  league TEXT,
  home_team TEXT,
  away_team TEXT,
  game_date TIMESTAMPTZ,

  -- Inefficiency details
  inefficiency_type TEXT, -- 'model_disagreement', 'reverse_line_movement', 'recency_bias', etc.
  severity TEXT, -- 'low', 'medium', 'high'
  edge_percentage NUMERIC,

  -- Supporting data
  model_probability NUMERIC,
  market_probability NUMERIC,
  line_movement_data JSONB,
  public_betting_percentage NUMERIC,
  sharp_money_indicator BOOLEAN,

  -- Recommendation
  recommended_side TEXT, -- 'home', 'away', 'over', 'under'
  confidence_score NUMERIC, -- 0-1

  -- Outcome tracking
  was_correct BOOLEAN,

  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Table: `line_history`
```sql
CREATE TABLE line_history (
  id UUID PRIMARY KEY,
  game_id TEXT NOT NULL,
  league TEXT,
  home_team TEXT,
  away_team TEXT,
  game_date TIMESTAMPTZ,

  -- Line data
  market_type TEXT, -- 'spreads', 'totals', 'h2h'
  line_value NUMERIC, -- spread value or total
  odds_value NUMERIC, -- American odds
  sportsbook TEXT,

  -- Timing
  timestamp TIMESTAMPTZ DEFAULT now(),
  minutes_to_game INTEGER,
  is_opening_line BOOLEAN DEFAULT false,
  is_closing_line BOOLEAN DEFAULT false,

  -- Movement
  movement_from_open NUMERIC,

  INDEX idx_line_history_game_market (game_id, market_type)
);
```

### Table: `advanced_metrics`
```sql
CREATE TABLE advanced_metrics (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE,

  -- Overall metrics
  total_bets INTEGER DEFAULT 0,
  total_wagered NUMERIC DEFAULT 0,
  total_profit_loss NUMERIC DEFAULT 0,
  roi_percentage NUMERIC DEFAULT 0,
  yield_percentage NUMERIC DEFAULT 0,
  sharpe_ratio NUMERIC DEFAULT 0,

  -- CLV metrics
  avg_clv_points NUMERIC DEFAULT 0,
  avg_clv_dollars NUMERIC DEFAULT 0,
  pct_beat_closing_line NUMERIC DEFAULT 0,

  -- Kelly metrics
  avg_kelly_efficiency NUMERIC DEFAULT 0,
  pct_overbets INTEGER DEFAULT 0,
  pct_underbets INTEGER DEFAULT 0,

  -- EV metrics
  estimated_total_ev NUMERIC DEFAULT 0,
  actual_vs_estimated_ev NUMERIC DEFAULT 0, -- How accurate were EV estimates

  -- Hit rates by odds
  favorite_hit_rate NUMERIC DEFAULT 0, -- odds < -150
  slight_favorite_hit_rate NUMERIC DEFAULT 0, -- -150 to -110
  slight_underdog_hit_rate NUMERIC DEFAULT 0, -- +110 to +150
  underdog_hit_rate NUMERIC DEFAULT 0, -- > +150

  -- Time analysis
  best_day_of_week TEXT,
  worst_day_of_week TEXT,
  best_time_of_day TEXT,

  last_calculated TIMESTAMPTZ DEFAULT now()
);
```

## 🛠️ Implementation Steps

### Step 1: Create Database Migrations
- [ ] `20251031100000_phase4_team_ratings.sql`
- [ ] `20251031100001_phase4_game_predictions.sql`
- [ ] `20251031100002_phase4_ev_analysis.sql`
- [ ] `20251031100003_phase4_market_inefficiencies.sql`
- [ ] `20251031100004_phase4_line_history.sql`
- [ ] `20251031100005_phase4_advanced_metrics.sql`

### Step 2: Create Calculation Functions
- [ ] `calculate_ev(win_prob, odds, stake)` - EV calculation
- [ ] `calculate_kelly(edge, odds, bankroll, fraction)` - Kelly sizing
- [ ] `calculate_implied_probability(odds)` - Odds to probability
- [ ] `calculate_edge(win_prob, market_prob)` - Edge calculation
- [ ] `calculate_clv(opening_odds, closing_odds, side)` - CLV
- [ ] `update_elo_ratings(game_id, result)` - Elo rating updates
- [ ] `predict_game_outcome(game_id)` - Ensemble prediction

### Step 3: Create Analysis Functions
- [ ] `analyze_bet_ev(bet_id)` - Full EV analysis for a bet
- [ ] `detect_market_inefficiencies(date)` - Find value opportunities
- [ ] `calculate_advanced_metrics(user_id)` - Update all metrics
- [ ] `track_line_movement(game_id)` - Monitor line changes
- [ ] `calculate_clv_for_settled_bets()` - CLV for completed bets

### Step 4: Integrate into Chat Function
- [ ] Fetch game predictions before AI response
- [ ] Calculate EV for discussed bets
- [ ] Display edge and recommended sizing
- [ ] Show CLV stats in user context
- [ ] Alert to high-value opportunities

### Step 5: Background Jobs
- [ ] Hourly: Track line movements
- [ ] Hourly: Detect market inefficiencies
- [ ] Daily: Update Elo ratings
- [ ] Daily: Generate game predictions
- [ ] Weekly: Calculate advanced metrics

## 🎯 Success Metrics

1. **EV Accuracy**: Estimated EV vs actual results correlation > 0.6
2. **CLV Tracking**: 100% of bets have CLV calculated
3. **Model Performance**: Ensemble model hit rate > 55%
4. **User Value**: Users with +CLV have higher actual ROI
5. **Edge Detection**: Flagged opportunities have >3% edge

## 📝 Example User Experience

**Before Phase 4**:
```
User: "Should I bet on Lakers -4.5?"
AI: "The Lakers are playing well. They're 8-2 at home. I'd lean Lakers."
```

**After Phase 4**:
```
User: "Should I bet on Lakers -4.5 at -110?"
AI: "Excellent question! Let me break down the statistical analysis:

📊 EXPECTED VALUE ANALYSIS:
- My Model Win Probability: 58.5% (confidence interval: 54-63%)
- Market Implied Probability: 52.4% (from -110 odds)
- Statistical Edge: +6.1% ✅
- Expected Value: +$11.23 per $100 wagered (+11.2% EV)

💰 BET SIZING RECOMMENDATION:
- Kelly Criterion: Full Kelly suggests 3.8% of bankroll
- Quarter Kelly (recommended): 0.95% of bankroll
- For your $5,000 bankroll: **Bet $47.50** (I'll round to $50)
- This is conservative sizing given the solid edge

📈 SUPPORTING ANALYSIS:
- Lakers Elo Rating: 1620 vs Opponent: 1480 (140 point advantage)
- Lakers 8-2 at home this season (80% home win rate)
- Historical model accuracy: 57% on similar matchups
- Line opened at -4, now -4.5 (sharp money on Lakers)

⚠️ RISK FACTORS:
- Confidence interval is ±4%, so variance exists
- Lakers on 2nd night of back-to-back (fatigue factor)
- LeBron questionable (90% chance to play per injury report)

🎯 CLOSING LINE VALUE PROJECTION:
- Line likely to close around -5 or -5.5
- Getting -4.5 now = potential +0.5 to +1 point of CLV
- Beating the closing line = long-term indicator of +EV betting

📊 YOUR HISTORICAL PERFORMANCE:
- You're 8-3 on Lakers bets (73% win rate, +18% ROI)
- Your average CLV on NBA bets: +1.2 points (excellent!)
- You're currently on a 4-game win streak

✅ RECOMMENDATION: **STRONG BET**
Bet $50 on Lakers -4.5 at -110. This is a +6.1% edge with solid supporting data.
The line may move to -5, so acting now locks in value."
```

## 🚀 Next Steps (Phase 5+)

- Phase 5: Live bet tracking & in-game alerts
- Phase 6: Automated daily briefings
- Phase 7: Social features & leaderboards
- Phase 8: Mobile app integration

---

**Phase 4 transforms betting from guesswork into quantitative science with mathematical edges, optimal sizing, and professional-grade analytics.**
