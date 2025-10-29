# API Integration Documentation

## Overview

BetGPT uses premium APIs to provide accurate, real-time sports betting data and analysis.

## Data Sources

### 1. The Odds API
**Purpose**: Real-time betting lines and odds

**What we fetch**:
- Moneyline odds (h2h markets)
- Point spreads
- Totals (over/under)
- Multiple bookmaker prices for comparison
- Live line movement data

**Implementation**: `supabase/functions/fetch-betting-odds/index.ts`

**Cache Duration**: 30 minutes (configurable)

**API Key Required**: Yes - Set `THE_RUNDOWN_API` in environment variables

**Supported Sports**:
- NFL (`americanfootball_nfl`)
- NBA (`basketball_nba`)
- MLB (`baseball_mlb`)
- NHL (`icehockey_nhl`)
- Soccer/MLS (`soccer_usa_mls`)
- And more...

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
    └─→ Betting Query → fetch-betting-odds → The Odds API → Database
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

# The Rundown API Key
THE_RUNDOWN_API=...

# Supabase (already configured)
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Cache Strategy

### The Odds API
- **Cache Duration**: 30 minutes
- **Reason**: Betting lines change frequently but API has rate limits
- **Strategy**: Check database first, fetch if stale

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

### The Odds API
- Free tier: 500 requests/month
- Paid tiers available for higher volume
- Each fetch counts as 1 request per sport

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
