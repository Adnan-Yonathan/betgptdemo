# BetGPT API Architecture Overview

**Date:** October 24, 2025
**Version:** 2.0 (with BALLDONTLIE)

---

## Quick Reference

### Data Sources at a Glance

| Source | Purpose | Cost | Rate Limit | Status |
|--------|---------|------|------------|--------|
| **BALLDONTLIE** | Player stats, games, teams | Free | 60 req/min | 🌟 PRIMARY |
| **The Rundown API** | Betting lines, 15+ bookmakers | Paid | Via RapidAPI | 🎯 BETTING |
| **ESPN API** | Player stats (backup) | Free | Unknown | 🔄 FALLBACK |
| **OpenAI** | Score analysis | Pay-per-use | N/A | 🧠 ANALYSIS |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│  (React Components: PlayerStatsCard, BettingDashboard, etc.)    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   UNIFIED STATS SERVICE                         │
│         /src/utils/unifiedStatsService.ts                       │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │         Smart Routing Logic                               │ │
│  │  • Check cache first (statsCache.ts)                      │ │
│  │  • Route to appropriate source                            │ │
│  │  • Auto-fallback on errors                                │ │
│  │  • Log all requests                                       │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────┬────────────┬────────────┬────────────┬────────────────┘
         │            │            │            │
         ▼            ▼            ▼            ▼
    ┌────────┐  ┌──────────┐  ┌────────┐  ┌─────────┐
    │  BDL   │  │ Rundown  │  │  ESPN  │  │ OpenAI  │
    │  API   │  │   API    │  │   API  │  │   API   │
    └────────┘  └──────────┘  └────────┘  └─────────┘
         │            │            │            │
         ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────┐
│                 SUPABASE EDGE FUNCTIONS                         │
│                                                                 │
│  • fetch-balldontlie-stats    • fetch-betting-odds             │
│  • sync-balldontlie-daily     • fetch-espn-stats (fallback)    │
│  • fetch-openai-scores        • detect-sharp-money             │
│                                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Tables:                                                 │  │
│  │  • player_performance_history (stats from BDL/ESPN)      │  │
│  │  • betting_odds (from Rundown API)                       │  │
│  │  • sports_scores (from OpenAI/BDL)                       │  │
│  │  • api_source_log (monitoring)                           │  │
│  │  • betting_odds_fetch_log (Rundown API automation)       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Cron Jobs:                                              │  │
│  │  • auto-fetch-betting-odds (every 30 min) ✅             │  │
│  │  • balldontlie-daily-sync (daily at 3 AM) 🆕            │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Examples

### Example 1: User Requests Player Stats

```
User: "Show me LeBron James stats"
    │
    ▼
Unified Stats Service
    │
    ├─→ Check cache
    │   └─→ Not found or stale
    │
    ├─→ Try BALLDONTLIE
    │   ├─→ Search for "LeBron James"
    │   ├─→ Get player ID
    │   ├─→ Fetch recent stats
    │   └─→ ✅ Success! (200ms)
    │
    ├─→ Convert to standard format
    │
    ├─→ Cache result (15 min TTL)
    │
    ├─→ Store in database
    │   └─→ player_performance_history
    │       (data_source = 'balldontlie')
    │
    └─→ Return to user
        └─→ Display in PlayerStatsCard
```

### Example 2: BALLDONTLIE Fails, ESPN Fallback

```
User: "Show me today's game stats"
    │
    ▼
Unified Stats Service
    │
    ├─→ Check cache
    │   └─→ Not found
    │
    ├─→ Try BALLDONTLIE
    │   ├─→ Request to api.balldontlie.io
    │   └─→ ❌ Error 503 (API down)
    │
    ├─→ Log error to api_source_log
    │
    ├─→ Automatic fallback to ESPN
    │   ├─→ Request to ESPN API
    │   └─→ ✅ Success! (450ms)
    │
    ├─→ Convert ESPN format
    │
    ├─→ Cache result
    │
    ├─→ Store in database
    │   └─→ player_performance_history
    │       (data_source = 'espn')
    │
    └─→ Return to user
        └─→ User sees data (doesn't know about fallback)
```

### Example 3: Betting Lines Request

```
User: "What are the odds for Lakers vs Celtics?"
    │
    ▼
Chat Function (detects betting query)
    │
    ├─→ Extract teams: Lakers, Celtics
    │
    ├─→ Check database (betting_odds table)
    │   ├─→ Find recent data (<30 min old)
    │   └─→ ✅ Return cached odds
    │
    ├─→ Aggregate odds
    │   └─→ The Rundown API (15+ bookmakers via affiliate_id)
    │       ├─→ DraftKings, FanDuel, BetMGM
    │       ├─→ Pinnacle, Bovada, PointsBet
    │       └─→ And 9 more sportsbooks
    │
    ├─→ Find best lines
    │   ├─→ Best moneyline: DraftKings -110
    │   ├─→ Best spread: FanDuel LAL -3.5 (-108)
    │   └─→ Best total: BetMGM O220.5 (-105)
    │
    ├─→ Detect sharp money
    │   └─→ Use detect-sharp-money function
    │
    └─→ Return comprehensive odds + analysis
```

### Example 4: Automated Daily Sync

```
Cron Job: 3:00 AM ET
    │
    ▼
invoke_balldontlie_sync()
    │
    ├─→ Determine yesterday's date
    │
    ├─→ Fetch completed games
    │   └─→ GET /v1/games?dates[]=2024-10-23
    │
    ├─→ For each game:
    │   ├─→ Fetch player stats
    │   │   └─→ GET /v1/stats?dates[]=2024-10-23&game_ids[]=12345
    │   │
    │   ├─→ Convert to standard format
    │   │
    │   └─→ Upsert to database
    │       └─→ player_performance_history
    │
    ├─→ Log results
    │   └─→ betting_odds_fetch_log
    │
    └─→ Send notification (if errors)
```

---

## Request Routing Logic

### Decision Tree

```
getPlayerStats(params)
    │
    ▼
┌─────────────────┐
│ Check cache?    │
└────┬────────────┘
     │ No / Stale
     ▼
┌─────────────────┐
│ User preference?│
└────┬────────────┘
     │ Auto (default)
     ▼
┌─────────────────┐
│ BALLDONTLIE?    │ ← Primary
└────┬────────────┘
     │ Error / No data
     ▼
┌─────────────────┐
│ ESPN API?       │ ← Fallback
└────┬────────────┘
     │ Error
     ▼
┌─────────────────┐
│ Return error    │
│ + cached data   │
└─────────────────┘
```

### Source Selection Rules

| Request Type | Primary | Secondary | Tertiary |
|-------------|---------|-----------|----------|
| Player stats | BALLDONTLIE | ESPN | Cache |
| Game scores | BALLDONTLIE | ESPN | OpenAI |
| Betting lines | The Odds API | BALLDONTLIE | N/A |
| Team info | BALLDONTLIE | Cache | N/A |
| Season averages | BALLDONTLIE | Calculated | N/A |
| Historical data | BALLDONTLIE | ESPN | N/A |

---

## Caching Strategy

### Cache Layers

```
┌─────────────────────────────────────────────┐
│         Layer 1: In-Memory Cache            │
│         (statsCache.ts)                     │
│         TTL: 2-30 minutes                   │
│         Storage: Map<string, CacheEntry>    │
└──────────────────┬──────────────────────────┘
                   │ Miss
                   ▼
┌─────────────────────────────────────────────┐
│      Layer 2: Database Cache                │
│      (player_performance_history)           │
│      TTL: Check last_updated timestamp      │
│      Storage: Supabase PostgreSQL           │
└──────────────────┬──────────────────────────┘
                   │ Miss / Stale
                   ▼
┌─────────────────────────────────────────────┐
│       Layer 3: API Fetch                    │
│       (BALLDONTLIE → ESPN fallback)         │
│       Storage: External APIs                │
└─────────────────────────────────────────────┘
```

### TTL (Time To Live) Settings

| Data Type | Cache Duration | Reasoning |
|-----------|---------------|-----------|
| Teams | 24 hours | Rarely changes |
| Players | 4 hours | Trades/updates infrequent |
| Live games | 2 minutes | Need fresh scores |
| Completed games | 24 hours | Never changes |
| Betting lines | 5 minutes | Lines move frequently |
| Season averages | 24 hours | Updates once daily |
| Historical stats | 7 days | Never changes |

---

## Error Handling

### Retry Logic

```typescript
async function fetchWithRetry(
  fetchFn: () => Promise<any>,
  maxRetries = 3,
  backoffMs = 1000
): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delay = backoffMs * Math.pow(2, attempt - 1);
      console.log(`Retry ${attempt}/${maxRetries} after ${delay}ms`);
      await sleep(delay);
    }
  }
}
```

### Fallback Chain

```
BALLDONTLIE
    │ Error
    ├─→ Log to api_source_log
    ├─→ Increment error counter
    │
    ▼
ESPN API
    │ Error
    ├─→ Log to api_source_log
    ├─→ Alert if critical
    │
    ▼
Cached Data (if available)
    │ No cache
    │
    ▼
User-friendly error message
```

---

## Monitoring & Alerts

### Health Check Endpoints

```typescript
// GET /api/health
{
  "status": "healthy",
  "sources": {
    "balldontlie": {
      "status": "up",
      "responseTime": 245,
      "successRate": 99.2,
      "lastError": null
    },
    "oddsApi": {
      "status": "up",
      "responseTime": 180,
      "successRate": 100,
      "quotaRemaining": 423
    },
    "espn": {
      "status": "up",
      "responseTime": 450,
      "successRate": 98.5,
      "usedAsFallback": 12
    }
  },
  "cache": {
    "hitRate": 72.3,
    "size": 1284,
    "evictions": 45
  },
  "database": {
    "status": "healthy",
    "responseTime": 45,
    "connections": 8
  }
}
```

### Alert Triggers

| Condition | Severity | Action |
|-----------|----------|--------|
| BALLDONTLIE error rate >5% | Warning | Log, continue with ESPN |
| BALLDONTLIE down >5 min | Critical | Alert team, use ESPN |
| ESPN fallback >10 times/hour | Warning | Check BALLDONTLIE health |
| Database lag >500ms | Warning | Check query performance |
| Cache hit rate <50% | Info | Review caching strategy |
| API quota >80% | Warning | Consider upgrade |

---

## Database Schema

### Key Tables

#### player_performance_history
```sql
CREATE TABLE player_performance_history (
  id UUID PRIMARY KEY,
  player_name TEXT NOT NULL,
  team TEXT NOT NULL,
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  game_date TIMESTAMPTZ NOT NULL,
  opponent TEXT NOT NULL,
  home_away TEXT CHECK (home_away IN ('home', 'away')),
  stats JSONB NOT NULL,
  points INTEGER,
  minutes_played TEXT,
  data_source TEXT DEFAULT 'espn', -- NEW: tracks source
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_name, game_date, team)
);

CREATE INDEX idx_player_perf_name_date ON player_performance_history(player_name, game_date DESC);
CREATE INDEX idx_player_perf_source ON player_performance_history(data_source);
```

#### api_source_log
```sql
CREATE TABLE api_source_log (
  id UUID PRIMARY KEY,
  source TEXT NOT NULL, -- 'balldontlie', 'espn', 'rundown-api', 'openai'
  endpoint TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  error_message TEXT,
  request_params JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_log_source_date ON api_source_log(source, created_at DESC);
```

#### betting_odds (existing)
```sql
CREATE TABLE betting_odds (
  event_id TEXT NOT NULL,
  sport_key TEXT NOT NULL,
  sport_title TEXT,
  commence_time TIMESTAMPTZ NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  bookmaker TEXT NOT NULL,
  market_key TEXT NOT NULL,
  outcome_name TEXT,
  outcome_price INTEGER,
  outcome_point DECIMAL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_id, bookmaker, market_key, outcome_name)
);
```

---

## API Rate Limits & Quotas

### BALLDONTLIE
- **Free Tier:** 60 requests/minute
- **Current Usage:** ~4 requests/minute average
- **Headroom:** 93% (plenty of capacity)
- **Upgrade Path:** ALL-ACCESS tier ($89.99/month) if needed

### The Odds API
- **Free Tier:** 500 requests/month
- **Current Usage:** ~240 requests/month (automated + manual)
- **Headroom:** 52%
- **Usage Pattern:** 30-min cron (48 requests/day)

### ESPN API
- **Rate Limit:** Unknown (unofficial API)
- **Usage:** Fallback only (minimal)
- **Cost:** Free

### OpenAI
- **Rate Limit:** Pay-per-use
- **Current Usage:** ~$5-10/month
- **Pattern:** Score analysis on demand

---

## Environment Variables

### Required Setup

```bash
# BALLDONTLIE (NEW)
BALLDONTLIE_API_KEY=your_api_key_here        # ✅ Already configured
VITE_ENABLE_BALLDONTLIE=true                  # Feature flag
VITE_BALLDONTLIE_ROLLOUT=100                  # Rollout percentage (0-100)

# The Rundown API (EXISTING)
THE_ODDS_API_KEY=your_the_odds_api_key        # ✅ Primary odds provider
X_RAPID_APIKEY=your_rapidapi_key              # ✅ Fallback (legacy THE_RUNDOWN_API)

# OpenAI (EXISTING)
OPENAI_API_KEY=sk-...                         # ✅ Already configured

# Supabase (EXISTING)
SUPABASE_URL=https://...                      # ✅ Already configured
SUPABASE_SERVICE_ROLE_KEY=...                 # ✅ Already configured
VITE_SUPABASE_URL=https://...                 # ✅ Already configured
VITE_SUPABASE_PUBLISHABLE_KEY=...             # ✅ Already configured
```

---

## Quick Start Guide

### For Developers

#### Testing BALLDONTLIE Integration

```bash
# 1. Verify API key
echo $BALLDONTLIE_API_KEY

# 2. Test API access
curl -H "Authorization: $BALLDONTLIE_API_KEY" \
  "https://api.balldontlie.io/v1/teams" | jq

# 3. Run unit tests
npm run test src/utils/balldontlieApi.test.ts

# 4. Test edge function locally
supabase functions serve fetch-balldontlie-stats
curl -X POST http://localhost:54321/functions/v1/fetch-balldontlie-stats \
  -H "Content-Type: application/json" \
  -d '{"date": "2024-10-23", "store_data": false}'

# 5. Check database
npm run db:query "SELECT * FROM player_performance_history WHERE data_source = 'balldontlie' LIMIT 5"
```

#### Using Unified Stats Service

```typescript
// Import
import { getPlayerStats, getGames, getTeams } from '@/utils/unifiedStatsService';

// Fetch player stats (auto-routes to BALLDONTLIE → ESPN fallback)
const stats = await getPlayerStats({
  playerName: 'LeBron James',
  date: '2024-10-23'
});

// Fetch today's games
const games = await getGames({
  date: new Date().toISOString().split('T')[0],
  sport: 'basketball_nba'
});

// Fetch teams (cached 24h)
const teams = await getTeams();
```

---

## Performance Benchmarks

### Expected Response Times

| Operation | Target | Acceptable | Action Required |
|-----------|--------|------------|-----------------|
| Cache hit | <10ms | <50ms | - |
| BALLDONTLIE API | <300ms | <500ms | Log if >500ms |
| ESPN API | <400ms | <600ms | Log if >600ms |
| The Odds API | <200ms | <400ms | Log if >400ms |
| Database query | <50ms | <100ms | Optimize if >100ms |

### Throughput

| Metric | Target | Current Capacity |
|--------|--------|------------------|
| Requests/minute | 100 | 60 (BALLDONTLIE limit) |
| Concurrent users | 50 | 100+ (with caching) |
| Database writes/min | 500 | 1000+ |

---

## Troubleshooting

### Common Issues

#### BALLDONTLIE Returns No Data
```typescript
// Check if API key is valid
const response = await fetch('https://api.balldontlie.io/v1/teams', {
  headers: { 'Authorization': BALLDONTLIE_API_KEY }
});

if (response.status === 401) {
  console.error('Invalid API key');
} else if (response.status === 429) {
  console.error('Rate limit exceeded');
}
```

#### Fallback Not Working
```typescript
// Verify fallback is enabled
console.log('Fallback enabled:', !DISABLE_ESPN_FALLBACK);

// Check error logs
SELECT * FROM api_source_log
WHERE source = 'balldontlie'
  AND success = false
ORDER BY created_at DESC
LIMIT 10;
```

#### Cache Not Updating
```typescript
// Clear cache
statsCache.clear();

// Or clear specific key
statsCache.delete('player-stats-lebron-james-2024-10-23');
```

---

## Migration Checklist

### Pre-Migration
- [ ] Verify BALLDONTLIE API key in all environments
- [ ] Run API health check
- [ ] Backup database
- [ ] Review rollback plan

### Week 1
- [ ] Deploy utilities to production
- [ ] Deploy edge functions
- [ ] Test with 10% traffic
- [ ] Monitor error rates

### Week 2
- [ ] Increase to 50% traffic
- [ ] Add cron job
- [ ] Enable caching
- [ ] Monitor performance

### Week 3
- [ ] Full rollout (100%)
- [ ] Deprecate direct ESPN calls
- [ ] Update documentation
- [ ] Team training

---

**Document Version:** 2.0
**Last Updated:** October 24, 2025
**Maintained By:** Development Team
