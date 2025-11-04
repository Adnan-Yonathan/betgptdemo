# API Integration Documentation

## Overview

BetGPT uses premium APIs to provide accurate, real-time sports betting data and analysis.

## Data Sources

### 1. The Odds API (Primary) & The Rundown API (Fallback)
**Purpose**: Real-time betting lines and odds from 15+ sportsbooks

**What we fetch**:
- Moneyline odds (h2h markets)
- Point spreads
- Totals (over/under)
- Multiple bookmaker prices for comparison (DraftKings, FanDuel, BetMGM, Pinnacle, Bovada, etc.)
- Live line movement data

**Implementation**: `supabase/functions/fetch-betting-odds/index.ts`

**API Endpoints**:
- The Odds API (`https://api.the-odds-api.com/v4/...`) – primary source
- The Rundown API via RapidAPI (`therundown-therundown-v1.p.rapidapi.com`) – fallback when primary is unavailable

**Cache Duration**: 30 minutes (configurable via cron job)

**API Keys Required**:
- Primary: `THE_ODDS_API_KEY`
- Fallback: `X_RAPID_APIKEY` (or legacy `THE_RUNDOWN_API`)

**Supported Sports**:
- NFL (`americanfootball_nfl`, sport_id: 2)
- NBA (`basketball_nba`, sport_id: 4)
- MLB (`baseball_mlb`, sport_id: 3)
- NHL (`icehockey_nhl`, sport_id: 1)
- Soccer/EPL (`soccer_epl`, sport_id: 6)

**Supported Bookmakers** (via affiliate_id):
- DraftKings (5), FanDuel (6), BetMGM (4), Pinnacle (3), Bovada (2)
- PointsBet (7), BetOnline (8), Unibet (10), and 7 more

**Usage**:
```typescript
// Automatically called when user asks about betting lines
// Examples: "What are the odds for Lakers vs Celtics?"
//           "Show me NFL spreads for tonight"
```

### 2. OpenAI
**Purpose**: Live scores, game statistics, and advanced analytics

**What we fetch**:
- Real-time game scores
- Game status (scheduled, in progress, final)
- Advanced statistics:
  - Total yards, turnovers (football)
  - Shooting percentages (basketball)
  - Hits, runs, errors (baseball)
  - Shots on goal, power play stats (hockey)
- Key player performances
- Game context and trends

**Implementation**: `supabase/functions/fetch-openai-scores/index.ts`

**Cache Duration**: 2 hours (configurable)

**API Key Required**: Yes - Set `OPENAI_API_KEY` in environment variables

**Model Used**: `gpt-4o` with JSON response format

**Usage**:
```typescript
// Automatically called when user asks about scores
// Examples: "What's the score of the Lakers game?"
//           "Show me NFL scores today"
//           "Who won the Yankees game?"
```

## Data Flow

```
User Query
    ↓
Chat Function (chat/index.ts)
    ↓
Determines query type (score vs betting)
    ↓
    ├─→ Score Query → fetch-openai-scores → OpenAI API → Database
    └─→ Betting Query → fetch-betting-odds → The Odds API → Database (fallback: The Rundown API)
    ↓
Data formatted and returned to user
    ↓
AI analysis with real-time data
```

## Database Schema

### sports_scores table
```sql
- event_id: TEXT (primary key)
- sport: TEXT
- league: TEXT
- home_team: TEXT
- away_team: TEXT
- home_score: INTEGER
- away_score: INTEGER
- game_status: TEXT
- game_date: TIMESTAMP
- last_updated: TIMESTAMP
- advanced_stats: JSONB (NEW - stores detailed statistics)
```

### betting_odds table
```sql
- event_id: TEXT
- sport_key: TEXT
- sport_title: TEXT
- commence_time: TIMESTAMP
- home_team: TEXT
- away_team: TEXT
- bookmaker: TEXT
- market_key: TEXT (h2h, spreads, totals)
- outcome_name: TEXT
- outcome_price: INTEGER (American odds format)
- outcome_point: DECIMAL (for spreads/totals)
- last_updated: TIMESTAMP
```

## Environment Variables Required

```bash
# OpenAI API Key
OPENAI_API_KEY=sk-...

# Betting Odds API Keys
THE_ODDS_API_KEY=...
X_RAPID_APIKEY=...   # or THE_RUNDOWN_API for legacy setups

# Supabase (already configured)
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Cache Strategy

### The Rundown API (Betting Odds)
- **Cache Duration**: 30 minutes
- **Reason**: Betting lines change frequently but API has rate limits
- **Strategy**: Check database first, fetch if stale
- **Smart Caching**:
  - Fresh (<5 min): Use immediately
  - Recent (5-30 min): Use with staleness note
  - Stale (>30 min): Trigger fresh fetch with timeout fallback

### OpenAI Scores
- **Cache Duration**: 2 hours
- **Reason**: Balance between real-time updates and API costs
- **Strategy**: Check database first, fetch if stale

## Benefits of This Approach

1. **Accuracy**: Direct API access to authoritative sources
2. **Real-time Data**: Always current scores and odds
3. **Advanced Statistics**: Deep insights beyond basic scores
4. **Multiple Bookmakers**: Compare odds for best value
5. **Cost Efficiency**: Smart caching reduces API calls
6. **Scalability**: Can add more sports/markets easily

## API Cost Considerations

### The Rundown API (via RapidAPI)
- Pricing based on RapidAPI subscription tier
- Automated fetching: Every 30 minutes for active sports
- Estimated usage: ~720 requests/month (if all 5 sports active)
- Season-aware: Only fetches sports currently in season to minimize costs

### OpenAI API
- Pay per token usage
- GPT-4o costs: ~$2.50 per 1M input tokens
- Typical score fetch: ~500-1000 tokens
- Estimated cost: $0.001-0.003 per score fetch

## Future Enhancements

- [ ] Add player prop odds
- [ ] Include injury reports from verified sources
- [ ] Live in-game betting updates
- [ ] Historical odds tracking for value analysis
- [ ] Weather data integration for outdoor sports
- [ ] Public betting percentages
- [ ] Sharp money indicators
