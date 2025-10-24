# ESPN API Integration for Player Statistics

This document describes the ESPN API integration for enhanced player statistics analysis in the Quantara betting platform.

## Overview

The ESPN API integration provides real-time, detailed player statistics from ESPN's unofficial API endpoints. This data enhances the existing player prop prediction system with more accurate and comprehensive player performance data.

## Architecture

### Backend Components

#### 1. `fetch-espn-stats` (Supabase Edge Function)

**Location:** `/supabase/functions/fetch-espn-stats/index.ts`

Fetches detailed player statistics for a specific NBA game from ESPN's API.

**Endpoint:** `POST /functions/v1/fetch-espn-stats`

**Request Body:**
```json
{
  "event_id": "400878160",
  "store_data": true
}
```

**Response:**
```json
{
  "success": true,
  "event_id": "400878160",
  "game_date": "2024-10-24T00:00:00Z",
  "home_team": "Lakers",
  "away_team": "Warriors",
  "home_score": 112,
  "away_score": 108,
  "status": "Final",
  "players_count": 28,
  "stored_count": 28,
  "players": [
    {
      "name": "LeBron James",
      "team": "Lakers",
      "position": "F",
      "stats": {
        "points": 28,
        "rebounds": 8,
        "assists": 11,
        "steals": 2,
        "blocks": 1,
        "turnovers": 3,
        "fieldGoalsMade": 10,
        "fieldGoalsAttempted": 18,
        "threePointsMade": 3,
        "threePointsAttempted": 7,
        "freeThrowsMade": 5,
        "freeThrowsAttempted": 6,
        "minutes": "36:24",
        "plusMinus": "+12"
      },
      "starter": true
    }
  ],
  "source": "ESPN"
}
```

**Features:**
- Parses ESPN's complex box score data structure
- Extracts comprehensive player statistics (points, rebounds, assists, shooting percentages, etc.)
- Automatically stores data in `player_performance_history` table
- Handles both starters and bench players
- Captures game context (home/away, opponent, date)

#### 2. `sync-espn-player-stats` (Supabase Edge Function)

**Location:** `/supabase/functions/sync-espn-player-stats/index.ts`

Syncs player statistics for multiple games from ESPN's scoreboard.

**Endpoint:** `POST /functions/v1/sync-espn-player-stats`

**Request Body:**
```json
{
  "sync_completed_only": true,
  "specific_event_ids": ["400878160", "400878161"]
}
```

**Response:**
```json
{
  "success": true,
  "total_games": 12,
  "successful_syncs": 11,
  "failed_syncs": 1,
  "results": [
    {
      "event_id": "400878160",
      "game": "Lakers @ Warriors",
      "status": "Final",
      "success": true,
      "players_synced": 28
    }
  ]
}
```

**Features:**
- Fetches today's games from ESPN scoreboard
- Optionally filters to completed games only
- Supports syncing specific game IDs
- Rate limiting protection (500ms delay between games)
- Bulk sync with detailed results

#### 3. Enhanced `predict-player-props`

**Location:** `/supabase/functions/predict-player-props/index.ts`

**Improvements:**
- **Home/Away Splits:** Accurately calculates performance differences based on game location
- **Opponent-Specific Stats:** Uses actual historical performance vs specific opponents
- **Consistency Metrics:** Calculates variance to measure player consistency
- **Enhanced Confidence Scoring:** Better confidence calculations based on sample size and consistency
- **Weighted Predictions:** Includes opponent and home/away factors in predictions

**New Calculation Weights:**
```typescript
{
  last5: 0.4,      // Recent form (last 5 games)
  last10: 0.25,    // Medium-term form
  season: 0.15,    // Season baseline
  vsOpponent: 0.15, // Historical vs opponent
  homeAway: 0.05   // Home/away adjustment
}
```

### Frontend Components

#### 1. `PlayerStatsCard` Component

**Location:** `/src/components/PlayerStatsCard.tsx`

A comprehensive React component for displaying player statistics and predictions.

**Features:**
- Player information with position and team
- Home/away indicator
- Trend visualization (improving/declining/neutral)
- Prop prediction with line, predicted value, and edge
- Confidence meter
- Historical averages (last 5, last 10, season, vs opponent)
- Home/away split visualization
- Consistency rating
- Recent game box score (points, rebounds, assists, shooting percentages, etc.)
- Minutes played and plus/minus

**Usage Example:**
```tsx
import PlayerStatsCard from '@/components/PlayerStatsCard';

<PlayerStatsCard
  playerName="LeBron James"
  team="Lakers"
  position="F"
  opponent="Warriors"
  isHome={true}
  recentStats={{
    points: 28,
    rebounds: 8,
    assists: 11,
    // ... other stats
  }}
  history={{
    seasonAvg: 25.4,
    last5Avg: 28.2,
    last10Avg: 26.8,
    vsOpponentAvg: 29.1,
    homeAwaySplit: 1.15,
    trend: 'improving',
    consistency: 0.82,
    sampleSize: 24
  }}
  propType="points"
  propLine={26.5}
  predictedValue={28.3}
  confidence={87}
  edge={4.2}
  recommendedSide="over"
/>
```

#### 2. ESPN API Utility Functions

**Location:** `/src/utils/espnApi.ts`

Helper functions for interacting with ESPN data from the frontend.

**Available Functions:**

```typescript
// Fetch game stats for a specific event
fetchESPNGameStats(eventId: string, storeData?: boolean): Promise<ESPNGameData>

// Sync player stats for today's games
syncESPNPlayerStats(completedOnly?: boolean, specificEventIds?: string[]): Promise<any>

// Get player performance history from database
getPlayerPerformanceHistory(playerName: string, limit?: number): Promise<any[]>

// Calculate player statistics and trends
calculatePlayerHistory(playerName: string, propType: string, opponent?: string): Promise<PlayerHistory>

// Get player prop predictions
getPlayerPropPredictions(eventId?: string, playerName?: string): Promise<any[]>

// Get today's NBA games
getTodaysGames(): Promise<any[]>
```

**Usage Example:**
```typescript
import {
  syncESPNPlayerStats,
  calculatePlayerHistory,
  getPlayerPropPredictions
} from '@/utils/espnApi';

// Sync all completed games
const syncResult = await syncESPNPlayerStats(true);

// Get player statistics
const playerHistory = await calculatePlayerHistory(
  'LeBron James',
  'points',
  'Warriors'
);

// Get predictions
const predictions = await getPlayerPropPredictions('400878160');
```

## Database Schema

### `player_performance_history` Table

Enhanced to store ESPN data:

```sql
CREATE TABLE player_performance_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_name TEXT NOT NULL,
  team TEXT NOT NULL,
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  game_date TIMESTAMPTZ NOT NULL,
  opponent TEXT NOT NULL,
  home_away TEXT NOT NULL, -- 'home' or 'away'
  stats JSONB NOT NULL,     -- Full stats object from ESPN
  points INTEGER,
  minutes_played TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_name, game_date, team)
);
```

**Stats JSONB Structure:**
```json
{
  "points": 28,
  "rebounds": 8,
  "assists": 11,
  "steals": 2,
  "blocks": 1,
  "turnovers": 3,
  "fieldGoalsMade": 10,
  "fieldGoalsAttempted": 18,
  "threePointsMade": 3,
  "threePointsAttempted": 7,
  "freeThrowsMade": 5,
  "freeThrowsAttempted": 6,
  "minutes": "36:24",
  "plusMinus": "+12"
}
```

## ESPN API Endpoints Used

### 1. NBA Summary Endpoint
```
https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/summary
?region=us&lang=en&contentorigin=espn&event={event_id}
```

**Returns:** Detailed game summary including box scores and player statistics

### 2. NBA Scoreboard Endpoint
```
https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard
```

**Returns:** List of today's games with event IDs, scores, and status

## Usage Guide

### 1. Syncing Today's Games

```typescript
import { syncESPNPlayerStats } from '@/utils/espnApi';

// Sync all games (including in-progress)
await syncESPNPlayerStats(false);

// Sync only completed games
await syncESPNPlayerStats(true);

// Sync specific games
await syncESPNPlayerStats(false, ['400878160', '400878161']);
```

### 2. Fetching Individual Game Stats

```typescript
import { fetchESPNGameStats } from '@/utils/espnApi';

const gameData = await fetchESPNGameStats('400878160');
console.log(`Found stats for ${gameData.players.length} players`);
```

### 3. Getting Player Analysis

```typescript
import { calculatePlayerHistory } from '@/utils/espnApi';

const analysis = await calculatePlayerHistory(
  'LeBron James',
  'points',
  'Warriors'  // opponent
);

console.log(`Season avg: ${analysis.seasonAvg}`);
console.log(`Last 5 avg: ${analysis.last5Avg}`);
console.log(`Vs Warriors: ${analysis.vsOpponentAvg}`);
console.log(`Home/Away split: ${analysis.homeAwaySplit}`);
console.log(`Trend: ${analysis.trend}`);
console.log(`Consistency: ${analysis.consistency}`);
```

### 4. Automated Daily Sync

You can set up a cron job to automatically sync player stats daily:

```typescript
// In your scheduler or cron job
import { syncESPNPlayerStats } from '@/utils/espnApi';

// Run every hour to catch completed games
const syncCompletedGames = async () => {
  const result = await syncESPNPlayerStats(true);
  console.log(`Synced ${result.successful_syncs} games`);
};

// Schedule with your preferred scheduler
```

## Advantages Over OpenAI Approach

1. **Real-time Data:** Direct API access provides instant updates
2. **Detailed Statistics:** Full box scores with shooting percentages, advanced stats
3. **Structured Data:** Consistent, predictable data format
4. **Cost Effective:** No OpenAI API costs for data fetching
5. **Reliability:** ESPN's data is authoritative and accurate
6. **Historical Depth:** Access to season-long player statistics
7. **Granular Insights:** Home/away splits, opponent-specific performance

## Enhanced Prediction Features

### 1. Home/Away Adjustments
The system now accurately adjusts predictions based on whether a player performs better at home or on the road.

### 2. Opponent-Specific Analysis
Historical performance against specific opponents is factored into predictions.

### 3. Consistency Scoring
Players with more consistent performance receive higher confidence scores.

### 4. Trend Detection
Identifies if a player is improving, declining, or maintaining their performance level.

### 5. Sample Size Weighting
Predictions from larger sample sizes receive higher confidence ratings.

## Rate Limiting and Best Practices

1. **Avoid Excessive Requests:** ESPN's API is unofficial and may have rate limits
2. **Cache Data:** Store fetched data in the database to minimize API calls
3. **Batch Operations:** Use the sync function instead of individual fetches
4. **Delay Between Requests:** The sync function includes 500ms delays
5. **Monitor for Changes:** ESPN may update their API structure

## Error Handling

All functions include comprehensive error handling:

```typescript
try {
  const gameData = await fetchESPNGameStats('400878160');
  if (!gameData) {
    console.error('Failed to fetch game data');
    // Handle error
  }
} catch (error) {
  console.error('Exception:', error);
  // Handle exception
}
```

## Future Enhancements

1. **Multi-Sport Support:** Extend to NFL, MLB, NHL
2. **Live Game Updates:** Real-time stats during games
3. **Advanced Analytics:** PER, True Shooting %, Usage Rate
4. **Lineup Impact:** How player performs with/without teammates
5. **Rest Days Analysis:** Performance based on days of rest
6. **Injury Correlation:** Link ESPN injury reports with predictions
7. **Weather Integration:** For outdoor sports

## Support and Troubleshooting

### Common Issues

**Issue:** 403 Error when fetching from ESPN
- **Solution:** ESPN may block certain user agents. Ensure proper headers are set.

**Issue:** Missing player data
- **Solution:** Not all players may have stats if they didn't play. Check for null values.

**Issue:** Inconsistent team names
- **Solution:** ESPN may use different team name formats. Implement name normalization.

### Getting Help

For issues or questions about the ESPN API integration:
1. Check the console logs for detailed error messages
2. Verify the event ID is correct
3. Ensure the game has been played (for historical data)
4. Check Supabase function logs for backend errors

## License and Legal

**Important:** ESPN's API is unofficial and not documented publicly. This integration is for educational and research purposes. Be mindful of ESPN's terms of service and use the API responsibly.
