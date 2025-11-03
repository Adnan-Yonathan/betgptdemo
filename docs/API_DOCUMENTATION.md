# API Documentation - Value-Based Betting Platform

**Version:** 2.0 (Post-Prediction Removal)
**Last Updated:** 2025-11-02

---

## Overview

This API provides value-based betting insights by comparing odds across 15+ sportsbooks, tracking line movement, detecting sharp action, and identifying market discrepancies. **This API does NOT provide predictions or win probabilities.**

**Base URL:** `https://your-project.supabase.co/functions/v1`

**Authentication:** All endpoints require a Supabase Auth token in the `Authorization` header.

```bash
Authorization: Bearer YOUR_SUPABASE_TOKEN
```

---

## Core Principles

### What This API Does ✅
- Compares odds across 15+ sportsbooks to find best available lines
- Tracks line movement from opening to current
- Detects sharp money indicators (reverse line movement, steam moves)
- Identifies market discrepancies (probability differences between books)
- Provides team performance trends (W/L, ATS, scoring)

### What This API Does NOT Do ❌
- ❌ Predict game winners
- ❌ Provide win probabilities
- ❌ Generate expected scores
- ❌ Make betting recommendations based on AI predictions
- ❌ Calculate "confidence levels" for outcomes

---

## Endpoints

### 1. Generate Value Insights

**Purpose:** Analyze a specific game to identify value betting opportunities.

**Endpoint:** `POST /generate-value-insights`

**Request Body:**
```json
{
  "eventId": "string (required)"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "eventId": "abc123",
  "opportunities": [
    {
      "type": "best_line",
      "recommendation": "Saints +14.5 at FanDuel",
      "reasoning": "Most books have Saints at +13.5. You're getting 1 point better value at FanDuel.",
      "comparison": "FanDuel: +14.5 | DK: +13.5 | MGM: +13.5 | Caesars: +13",
      "value_rating": 4.5,
      "details": {
        "bestBook": "FanDuel",
        "bestLine": 14.5,
        "consensusLine": 13.5,
        "pointsAdvantage": 1.0
      }
    },
    {
      "type": "sharp_action",
      "recommendation": "Away Team - Sharp action detected",
      "reasoning": "Reverse line movement detected. Public betting one way but line moved opposite direction.",
      "value_rating": 4.0,
      "details": {
        "signalType": "reverse_line_movement",
        "strength": "strong",
        "confidence": 85.0,
        "sharpSide": "away",
        "detectedAt": "2025-11-02T14:30:00Z"
      }
    }
  ],
  "totalOpportunities": 2
}
```

**Opportunity Types:**
- `best_line` - Better spread/total at one book vs consensus
- `sharp_action` - Professional money indicators
- `line_movement` - Significant movement from opening line
- `market_discrepancy` - Probability differences between books

**Value Rating Scale:** 0-5 (higher = more value)

**Error Responses:**
```json
{
  "error": "eventId is required"
}
```

---

### 2. Get Team Trends

**Purpose:** Retrieve historical performance data for a team (NO predictions).

**Endpoint:** `POST /get-team-trends`

**Request Body:**
```json
{
  "team": "string (required)",
  "league": "string (required)",
  "limit": "number (optional, default: 10)"
}
```

**Example:**
```json
{
  "team": "Lakers",
  "league": "NBA",
  "limit": 10
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "team": "Lakers",
  "league": "NBA",
  "trends": {
    "lastGames": {
      "wins": 7,
      "losses": 3,
      "record": "7-3"
    },
    "atsRecord": {
      "covers": 6,
      "fails": 4,
      "pushes": 0,
      "record": "6-4",
      "percentage": 60.0
    },
    "homeAway": {
      "homeRecord": "4-1",
      "awayRecord": "3-2"
    },
    "recentForm": {
      "lastFiveResults": ["W", "W", "L", "W", "W"],
      "trend": "hot"
    },
    "scoringTrends": {
      "avgPointsScored": 118.5,
      "avgPointsAllowed": 112.3,
      "last5AvgScored": 121.2,
      "last5AvgAllowed": 110.8
    },
    "restDays": 2
  },
  "gamesAnalyzed": 10
}
```

**Trend Values:**
- `hot` - 4+ wins in last 5 games
- `cold` - 1 or fewer wins in last 5 games
- `average` - Everything else

**Error Responses:**
```json
{
  "error": "team and league are required"
}
```

---

### 3. Analyze Odds Discrepancies

**Purpose:** Find probability differences across sportsbooks to identify value.

**Endpoint:** `POST /analyze-odds-discrepancies`

**Request Body (Optional):**
```json
{
  "sport": "string (optional)",
  "min_bookmakers": "number (optional, default: 2)"
}
```

**Example:**
```json
{
  "sport": "americanfootball_nfl",
  "min_bookmakers": 3
}
```

**Response (200 OK):**
```json
{
  "message": "Odds discrepancy analysis completed successfully",
  "discrepancies_found": 15,
  "top_discrepancies": [
    {
      "game": "Washington @ Seattle",
      "market": "h2h",
      "outcome": "Seattle",
      "probability_difference": "2.45%",
      "bookmaker_low": "BetOnline.ag (62.70%)",
      "bookmaker_high": "BetMGM (65.15%)"
    }
  ]
}
```

**Notes:**
- Only stores discrepancies >0.5% probability difference
- Analyzes odds from last 2 hours
- Results stored in `odds_discrepancies` table
- Includes contextual reasoning:
  - Sharp book advantages explained
  - Recreational book soft lines identified
  - Value opportunity sizing

---

### 4. Get Game Insights

**Purpose:** Retrieve value-based insights for a specific game.

**Endpoint:** `GET /get-game-insights?eventId={eventId}`

**Query Parameters:**
- `eventId` (required) - The game event ID

**Response (200 OK):**
```json
{
  "insights": {
    "lineMovement": {
      "opening": -3.5,
      "current": -4.5,
      "direction": "down",
      "magnitude": 1.0
    },
    "sharpMoneyIndicators": {
      "hasSharpAction": true,
      "sharpSide": "away",
      "signalType": "reverse_line_movement",
      "strength": "strong"
    },
    "oddsComparison": {
      "bestSpread": {
        "bookmaker": "FanDuel",
        "point": -4.0,
        "odds": -110
      },
      "worstSpread": {
        "bookmaker": "BetRivers",
        "point": -4.5,
        "odds": -110
      },
      "spreadRange": 0.5
    },
    "discrepancies": [
      {
        "market": "spreads",
        "outcome": "Home Team",
        "probabilityDiff": 1.25,
        "bestBook": "Pinnacle",
        "worstBook": "DraftKings"
      }
    ],
    "injuries": [
      {
        "player": "John Doe",
        "status": "Questionable",
        "team": "Lakers"
      }
    ]
  },
  "lastUpdated": "2025-11-02T14:30:00Z"
}
```

**Important:** This endpoint does NOT return predictions, win probabilities, or confidence scores.

---

### 5. Detect Alerts

**Purpose:** Generate value-based alerts for line movement, sharp action, and best lines.

**Endpoint:** `POST /detect-alerts`

**Request Body:** None required

**Response (200 OK):**
```json
{
  "success": true,
  "alerts": {
    "lineMovement": [
      {
        "event_id": "abc123",
        "sport": "NBA",
        "home_team": "Lakers",
        "away_team": "Celtics",
        "game_date": "2025-11-02T19:00:00Z",
        "alert_type": "line_movement",
        "priority": "high",
        "title": "Line Move: Celtics @ Lakers",
        "message": "Spread moved 2 points from -3 to -5",
        "data": {
          "lineMove": 2.0,
          "earlySpread": -3,
          "lateSpread": -5
        }
      }
    ],
    "steamMoves": [],
    "injuries": [],
    "bestLine": []
  },
  "totalAlerts": 1,
  "executionTime": 1250
}
```

**Alert Types Generated:**
- `line_movement` - 1+ point spread movement
- `steam_move` - 3+ books moving in 10 minutes
- `best_line` - 0.5+ point difference across books
- `injury` - Key players out/doubtful

**Removed Alert Types (No Longer Generated):**
- ❌ `ev_discrepancy` (was based on model predictions)
- ❌ `closing_line` (was based on model predictions)
- ❌ `high_probability` (was prediction-based)

---

### 6. Detect Sharp Money

**Purpose:** Identify professional betting activity through line movement analysis.

**Endpoint:** `POST /detect-sharp-money`

**Request Body:** None required

**Response (200 OK):**
```json
{
  "success": true,
  "signals": [
    {
      "event_id": "abc123",
      "sport": "NFL",
      "home_team": "Chiefs",
      "away_team": "Raiders",
      "signal_type": "reverse_line_movement",
      "strength": "strong",
      "sharp_side": "away",
      "confidence_score": 85.5,
      "data": {
        "publicPercentage": 65,
        "lineMovement": -1.5,
        "booksInvolved": ["Pinnacle", "CRIS", "5Dimes"]
      },
      "detected_at": "2025-11-02T14:30:00Z"
    }
  ],
  "totalSignals": 1
}
```

**Signal Types:**
- `reverse_line_movement` - Line moves opposite to public betting
- `steam_move` - Rapid coordinated line movement
- `consensus_sharp` - Sharp books agree on same line

**Strength Levels:**
- `very_strong` - Very high confidence (>90)
- `strong` - High confidence (70-90)
- `moderate` - Medium confidence (50-70)
- `weak` - Low confidence (<50)

---

## Database Tables (Public Schema)

### Value-Based Tables (Active)

**`betting_odds`**
- Current odds from 15+ sportsbooks
- Updated every 30 minutes via cron
- Fields: event_id, bookmaker, market_key, outcome_price, outcome_point

**`odds_discrepancies`**
- Pre-calculated probability differences
- Updated every 15 minutes
- Fields: probability_difference, bookmaker_low, bookmaker_high

**`sharp_money_signals`**
- Detected professional betting indicators
- Fields: signal_type, strength, confidence_score, sharp_side

**`line_movement_history`**
- Historical line changes over time
- Fields: event_id, bookmaker, line_value, recorded_at

**`opening_closing_lines`**
- Opening vs closing line tracking
- Fields: opening_spread, closing_spread, opened_at, closed_at

**`smart_alerts`**
- User-specific value alerts
- Fields: alert_type, priority, title, message, user_id

### Deprecated Tables (Removed)

These tables have been dropped and should NOT be queried:
- ❌ `model_predictions`
- ❌ `player_prop_predictions`
- ❌ `prediction_feedback`
- ❌ `prediction_models`
- ❌ `team_ratings`
- ❌ `game_predictions`
- ❌ `player_props`

---

## Sportsbooks Tracked

The API tracks odds from these 15 bookmakers:

**Sharp Books (Professional Market Makers):**
- Pinnacle
- CRIS
- Circa Sports
- 5Dimes
- Bookmaker

**Recreational Books (Public-Facing):**
- FanDuel
- DraftKings
- BetMGM
- Caesars
- BetRivers
- PointsBet
- BetOnline
- Sportsbetting.ag
- Unibet
- Bodog

**Note:** Sharp book lines often indicate market efficiency, while recreational books may have "softer" lines with more value opportunities.

---

## Rate Limits

**Current Limits:**
- No explicit rate limits on authenticated requests
- Cron jobs run on schedule (every 15-30 minutes)
- Recommended: Cache responses for 5-15 minutes

**Best Practices:**
- Don't poll endpoints more than once per minute
- Use database queries directly for real-time data
- Subscribe to Supabase realtime for live updates

---

## Error Codes

**400 Bad Request**
```json
{
  "error": "Missing required parameter: eventId"
}
```

**401 Unauthorized**
```json
{
  "error": "Invalid or missing authorization token"
}
```

**404 Not Found**
```json
{
  "success": false,
  "message": "No recent game data found for Lakers"
}
```

**500 Internal Server Error**
```json
{
  "error": "Internal server error message"
}
```

---

## Migration Guide (v1 to v2)

### Removed Endpoints

These prediction endpoints no longer exist:
- ❌ `POST /predict-nfl`
- ❌ `POST /predict-nba`
- ❌ `POST /predict-mlb`
- ❌ `POST /predict-player-props`
- ❌ `POST /run-daily-predictions`
- ❌ `POST /feedback-analytics`

### Replacement Workflows

**Old: Get game prediction**
```bash
# Don't do this anymore
POST /predict-nfl
{"homeTeam": "Chiefs", "awayTeam": "Raiders"}
```

**New: Get value insights**
```bash
# Do this instead
POST /generate-value-insights
{"eventId": "abc123"}

# Returns odds comparison, line movement, sharp action
```

**Old: Get win probability**
```bash
# This no longer exists
GET /model-predictions?eventId=abc123
# Response: {"homeWinProbability": 0.65}
```

**New: Get team trends and odds**
```bash
# Get historical performance instead
POST /get-team-trends
{"team": "Chiefs", "league": "NFL"}

# Then compare odds across books
GET /get-game-insights?eventId=abc123
```

---

## Code Examples

### JavaScript/TypeScript

```typescript
// Generate value insights
const generateValueInsights = async (eventId: string) => {
  const response = await fetch(
    'https://your-project.supabase.co/functions/v1/generate-value-insights',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ eventId }),
    }
  );

  const data = await response.json();

  // Use value opportunities
  data.opportunities.forEach(opp => {
    if (opp.value_rating >= 4.0) {
      console.log(`High value: ${opp.recommendation}`);
      console.log(`Reasoning: ${opp.reasoning}`);
    }
  });
};

// Get team trends
const getTeamTrends = async (team: string, league: string) => {
  const response = await fetch(
    'https://your-project.supabase.co/functions/v1/get-team-trends',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ team, league, limit: 10 }),
    }
  );

  const data = await response.json();

  console.log(`${team} last 10: ${data.trends.lastGames.record}`);
  console.log(`ATS: ${data.trends.atsRecord.record} (${data.trends.atsRecord.percentage}%)`);
  console.log(`Form: ${data.trends.recentForm.trend}`);
};
```

### Python

```python
import requests

SUPABASE_URL = "https://your-project.supabase.co"
SUPABASE_TOKEN = "your_token_here"

def generate_value_insights(event_id):
    response = requests.post(
        f"{SUPABASE_URL}/functions/v1/generate-value-insights",
        headers={
            "Authorization": f"Bearer {SUPABASE_TOKEN}",
            "Content-Type": "application/json",
        },
        json={"eventId": event_id}
    )

    data = response.json()

    for opportunity in data["opportunities"]:
        if opportunity["value_rating"] >= 4.0:
            print(f"High value: {opportunity['recommendation']}")
            print(f"Reasoning: {opportunity['reasoning']}")

def get_team_trends(team, league):
    response = requests.post(
        f"{SUPABASE_URL}/functions/v1/get-team-trends",
        headers={
            "Authorization": f"Bearer {SUPABASE_TOKEN}",
            "Content-Type": "application/json",
        },
        json={"team": team, "league": league, "limit": 10}
    )

    data = response.json()
    trends = data["trends"]

    print(f"{team} last 10: {trends['lastGames']['record']}")
    print(f"ATS: {trends['atsRecord']['record']} ({trends['atsRecord']['percentage']}%)")
    print(f"Form: {trends['recentForm']['trend']}")
```

---

## Support

**Questions or Issues:**
- Check this documentation first
- Review `VALIDATION_REPORT.md` for testing info
- Check Supabase Edge Function logs for errors
- Review database schema for table structures

**Contributing:**
- All endpoints should focus on value identification, not predictions
- New features must compare odds across multiple sportsbooks
- Never add win probability or prediction endpoints

---

**API Version:** 2.0
**Last Updated:** 2025-11-02
**Breaking Changes from v1:** All prediction endpoints removed
**Backward Compatibility:** None - v1 prediction endpoints deprecated
