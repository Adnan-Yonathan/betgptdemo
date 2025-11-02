# Odds Discrepancy Analysis Solution

## Problem

When users requested detailed betting odds discrepancy analysis across multiple games and bookmakers, the AI responses would get cut off mid-calculation due to hitting the OpenAI token limit (16,384 tokens). The analysis involved calculating implied probabilities for each bookmaker's odds and comparing them, which resulted in very lengthy responses.

## Solution Overview

Instead of calculating odds discrepancies inline during chat responses, we now:

1. **Pre-compute** discrepancy analysis every 15 minutes via a scheduled cron job
2. **Store** the results in a dedicated database table
3. **Retrieve** and summarize the pre-computed data when users ask about discrepancies
4. **Prevent** token limit issues by using concise, pre-analyzed data

## Components

### 1. Database Table: `odds_discrepancies`

**Migration**: `supabase/migrations/20251102120000_add_odds_discrepancies.sql`

Stores pre-computed odds discrepancies with the following key fields:

- `event_id`, `sport`, `home_team`, `away_team`, `game_time`
- `market_key` (h2h, spreads, totals)
- `outcome_name` (team name, Over, Under)
- `bookmaker_low` / `odds_low` / `probability_low` (lowest implied probability)
- `bookmaker_high` / `odds_high` / `probability_high` (highest implied probability)
- `probability_difference` (high - low)
- `percentage_difference` ((difference / low) * 100)
- `num_bookmakers` (number of bookmakers offering this line)
- `bookmakers_data` (JSONB with all bookmaker odds for reference)
- `data_freshness_minutes` (age of the odds data)

**Indexes**:
- Fast lookups by event, sport, game time
- Optimized for finding biggest discrepancies (`probability_difference DESC`)

**RLS Policies**:
- Public read access
- Only service role can insert/update

### 2. Edge Function: `analyze-odds-discrepancies`

**File**: `supabase/functions/analyze-odds-discrepancies/index.ts`

**What it does**:
- Fetches recent betting odds (last 2 hours) from `betting_odds` table
- Groups odds by event, market, and outcome
- Calculates implied probabilities using American odds conversion:
  - Favorite (negative): `abs(odds) / (abs(odds) + 100)`
  - Underdog (positive): `100 / (odds + 100)`
- Identifies min and max probabilities for each outcome
- Stores significant discrepancies (> 0.5% probability difference)
- Returns top 10 biggest discrepancies

**Parameters**:
- `sport` (optional): Filter by specific sport
- `min_bookmakers` (default: 2): Minimum bookmakers required for comparison

**Example Response**:
```json
{
  "message": "Odds discrepancy analysis completed successfully",
  "discrepancies_found": 47,
  "top_discrepancies": [
    {
      "game": "Washington Commanders @ Seattle Seahawks",
      "market": "h2h",
      "outcome": "Seattle Seahawks",
      "probability_difference": "0.94%",
      "bookmaker_low": "BetOnline.ag (62.70%)",
      "bookmaker_high": "BetMGM (63.64%)"
    }
  ]
}
```

### 3. Cron Job

**Migration**: `supabase/migrations/20251102120001_setup_odds_discrepancy_cron.sql`

**Schedules**:
1. **Analysis**: Every 15 minutes
   - Calls `analyze-odds-discrepancies` function
   - Ensures fresh discrepancy data is always available

2. **Cleanup**: Every 6 hours
   - Deletes discrepancies older than 24 hours
   - Prevents table bloat

### 4. Chat Function Integration

**File**: `supabase/functions/chat/index.ts`

**New Function**: `fetchOddsDiscrepancies(query: string, limit: number = 20)`
- Fetches pre-computed discrepancies from database
- Filters by sport based on query keywords
- Returns last hour of analysis
- Formats data for AI consumption

**New Function**: `formatDiscrepanciesData(discrepancies: any[], query: string)`
- Groups discrepancies by game
- Sorts by probability difference (biggest first)
- Highlights the single largest discrepancy
- Adds educational notes about what discrepancies mean

**Keyword Detection**:
Added `discrepancyKeywords` array to detect when users ask about:
- "discrepancy", "differences", "biggest difference"
- "compare odds", "odds comparison", "bookmaker difference"
- "probability difference", "market inefficiency"
- "arbitrage", "soft lines"

**Data Fetching Priority**:
1. Score requests
2. Lineup requests
3. Matchup requests
4. **Discrepancy requests** ← NEW
5. General betting data

**System Prompt Enhancement**:
When `contextType === 'discrepancy'`, the AI receives special instructions:
- Focus on LARGEST probability discrepancies
- Explain why bookmakers disagree
- Highlight value opportunities with caution
- Discuss possible reasons (sharp action, news, injuries)
- **DO NOT recalculate** - use pre-computed data
- Keep explanations concise
- Recommend verification before betting

## Example User Flow

### Before (❌ Response Cutoff):

**User**: "Analyze betting odds discrepancies for all NFL games tonight"

**AI**:
```
Let me analyze the odds across bookmakers for tonight's NFL games...

1. Washington Commanders vs Seattle Seahawks

   Moneyline (Washington Commanders):
       Bovada: +145 (Implied Probability: 40.82%)
       BetMGM: +145 (Implied Probability: 40.82%)
       BetOnline.ag: +148 (Implied Probability: 40.32%)
       Max Probability Spread (Commanders ML): 0.50%

   Moneyline (Seattle Seahawks):
       Bovada: -170 (Implied Probability: 62.96%)
       BetMGM: -175 (Implied Probability: 63.64%)
       BetOnline.ag: -168 (Implied Probability: 62.70%)
       [Response cut off - hit 16,384 token limit]
```

### After (✅ Complete Response):

**User**: "Analyze betting odds discrepancies for all NFL games tonight"

**AI**:
```
I've analyzed the pre-computed odds discrepancies for tonight's NFL games. Here are the biggest differences:

🔥 LARGEST DISCREPANCY:
Seattle Seahawks Moneyline
• BetOnline.ag: -168 (62.70% implied)
• BetMGM: -175 (63.64% implied)
• Difference: 0.94%

This means BetMGM prices the Seahawks significantly higher than BetOnline.
Potential reasons:
- Sharp action on Seattle at BetMGM
- Different risk management strategies
- Recent injury news impacting lines differently

Other Notable Discrepancies:
📊 Commanders @ Seahawks Spread (+3.5)
• BetMGM: -120 (54.55%) vs BetOnline: -122 (54.95%)
• 0.40% difference

Always verify current lines before betting, as these numbers are 12 minutes old.
```

## Benefits

✅ **No More Cutoffs**: Responses stay well under token limits
✅ **Faster Responses**: No inline calculation needed
✅ **Consistent Format**: Pre-formatted, easy-to-read summaries
✅ **Scalable**: Can handle 100+ games without issues
✅ **Automatic Updates**: Fresh data every 15 minutes
✅ **Better UX**: Users get immediate, complete answers

## Testing

### Manual Test

1. Deploy migrations:
   ```bash
   supabase db push
   ```

2. Deploy edge function:
   ```bash
   supabase functions deploy analyze-odds-discrepancies
   ```

3. Manually trigger analysis:
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/analyze-odds-discrepancies \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"sport": "americanfootball_nfl"}'
   ```

4. Verify data in database:
   ```sql
   SELECT * FROM odds_discrepancies ORDER BY probability_difference DESC LIMIT 10;
   ```

5. Test chat query:
   - Ask: "What are the biggest odds discrepancies for NFL games?"
   - Verify: Response includes pre-computed analysis without cutoff

### Automated Test

```typescript
// Test discrepancy calculation
const testOdds = [
  { bookmaker: 'BetMGM', odds: -175 },
  { bookmaker: 'BetOnline', odds: -168 }
];

// Expected implied probabilities:
// BetMGM: 175 / (175 + 100) = 63.64%
// BetOnline: 168 / (168 + 100) = 62.69%
// Difference: 0.95%

// Verify difference > 0.5% threshold → should be stored
```

## Monitoring

### Key Metrics

1. **Discrepancies Found**: Check cron job logs
   ```sql
   SELECT COUNT(*) as total,
          AVG(probability_difference) as avg_diff,
          MAX(probability_difference) as max_diff
   FROM odds_discrepancies
   WHERE calculated_at > NOW() - INTERVAL '1 hour';
   ```

2. **Data Freshness**: Verify cron is running
   ```sql
   SELECT MAX(calculated_at) as last_analysis
   FROM odds_discrepancies;
   ```

3. **Chat Usage**: Monitor context type
   ```sql
   -- Check chat logs for "Discrepancy data fetch result"
   ```

## Future Enhancements

1. **Multi-Way Arbitrage Detection**: Identify 3+ way arbitrage opportunities
2. **Historical Tracking**: Track how discrepancies change over time
3. **Alert System**: Notify users when large discrepancies appear
4. **Bookmaker Rankings**: Identify consistently "sharp" vs "soft" books
5. **Line Movement Correlation**: Link discrepancies to line movement signals

## Technical Notes

- American odds conversion handles both favorites (negative) and underdogs (positive)
- Only stores discrepancies > 0.5% to reduce noise
- Uses JSONB to store all bookmaker data for future drill-down
- Indexes optimized for common query patterns (sport, game time, biggest difference)
- RLS ensures public can read but only service role can write
- Cron uses vault secrets for secure API calls
