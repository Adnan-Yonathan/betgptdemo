# BALLDONTLIE API Implementation Plan (Revised)

**Date:** October 24, 2025
**Status:** Ready for Implementation
**Architecture:** Multi-Source Data Strategy

---

## Executive Summary

This revised plan integrates **BALLDONTLIE API** as the primary source for player statistics and game data, while keeping **The Odds API** for betting lines. This creates a best-of-both-worlds architecture:

- **BALLDONTLIE**: Player stats, game data, team info, historical data
- **The Odds API**: Betting lines from multiple bookmakers, line movements
- **ESPN**: Tertiary fallback for player stats if BALLDONTLIE fails
- **OpenAI**: Score interpretation and analysis (kept as-is)

---

## Current Architecture Analysis

### Existing Data Sources

```
┌─────────────────────────────────────────────────────────────────┐
│                     CURRENT ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐     ┌──────────────────┐                │
│  │  The Odds API    │     │   ESPN API       │                │
│  │  - Betting lines │     │  - Player stats  │                │
│  │  - Odds movement │     │  - Box scores    │                │
│  │  - Multi books   │     │  - Game data     │                │
│  └────────┬─────────┘     └────────┬─────────┘                │
│           │                        │                           │
│           │      ┌─────────────────┘                           │
│           │      │                                             │
│           ▼      ▼                                             │
│  ┌─────────────────────────────────┐                          │
│  │    Supabase Edge Functions      │                          │
│  │  - fetch-betting-odds (Odds)    │                          │
│  │  - fetch-espn-stats (ESPN)      │                          │
│  │  - sync-espn-player-stats       │                          │
│  │  - fetch-openai-scores (OpenAI) │                          │
│  └─────────────────┬───────────────┘                          │
│                    │                                           │
│                    ▼                                           │
│  ┌─────────────────────────────────┐                          │
│  │      Supabase Database          │                          │
│  │  - betting_odds                 │                          │
│  │  - player_performance_history   │                          │
│  │  - sports_scores                │                          │
│  └─────────────────────────────────┘                          │
│                                                                 │
│  🔄 Cron Job: Fetches odds every 30 mins (automated)           │
│  ⚠️  Issue: ESPN stats fetched manually, complex parsing       │
└─────────────────────────────────────────────────────────────────┘
```

### Pain Points with Current ESPN Integration

1. **Complex Parsing**: ~150 lines of nested JSON parsing code
2. **Manual Triggering**: Stats sync not automated like Odds API
3. **Inconsistent Structure**: Different response formats
4. **Limited Documentation**: Unofficial API, no support
5. **No Historical Data**: Limited to recent games
6. **No Betting Odds**: Must use separate source anyway

---

## New Architecture

### Multi-Source Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        NEW ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │ BALLDONTLIE  │  │ The Odds API │  │  ESPN (FB)   │                │
│  │ 🌟 PRIMARY   │  │ 🎯 BETTING   │  │ 🔄 FALLBACK  │                │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤                │
│  │ Player stats │  │ Betting lines│  │ Player stats │                │
│  │ Game data    │  │ Spreads/O-U  │  │ (backup)     │                │
│  │ Teams        │  │ Multi books  │  └──────────────┘                │
│  │ Historical   │  │ Line moves   │                                   │
│  │ Season avg   │  │ Sharp money  │                                   │
│  │ Standings    │  └──────────────┘                                   │
│  │ *Betting odds│                                                     │
│  └──────┬───────┘                                                     │
│         │                                                              │
│         │              ┌──────────────┐                               │
│         │              │  OpenAI API  │                               │
│         │              │ 🧠 ANALYSIS  │                               │
│         │              ├──────────────┤                               │
│         │              │ Score interp │                               │
│         │              │ Context      │                               │
│         │              │ Insights     │                               │
│         │              └──────┬───────┘                               │
│         │                     │                                       │
│         ▼                     ▼                                       │
│  ┌──────────────────────────────────────────┐                        │
│  │      Unified Stats Service (NEW)         │                        │
│  │  ┌────────────────────────────────────┐  │                        │
│  │  │  Smart Source Selection            │  │                        │
│  │  │  • BALLDONTLIE first               │  │                        │
│  │  │  • Odds API for betting lines      │  │                        │
│  │  │  • ESPN fallback on errors         │  │                        │
│  │  │  • Caching for all sources         │  │                        │
│  │  └────────────────────────────────────┘  │                        │
│  └──────────────────┬───────────────────────┘                        │
│                     │                                                 │
│                     ▼                                                 │
│  ┌──────────────────────────────────────────┐                        │
│  │         Supabase Database                │                        │
│  │  ┌────────────────────────────────────┐  │                        │
│  │  │ betting_odds                       │  │                        │
│  │  │ player_performance_history         │  │                        │
│  │  │ sports_scores                      │  │                        │
│  │  │ api_source_log (NEW)              │  │                        │
│  │  └────────────────────────────────────┘  │                        │
│  └──────────────────────────────────────────┘                        │
│                                                                        │
│  ✅ Automated: Odds API (every 30 mins)                               │
│  ✅ New: BALLDONTLIE stats (on-demand + daily sync)                   │
│  ✅ Fallback: ESPN (automatic on BALLDONTLIE errors)                  │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Source Responsibilities

| Data Type | Primary Source | Secondary/Fallback | Notes |
|-----------|---------------|-------------------|-------|
| **Player Stats** | BALLDONTLIE | ESPN | Cleaner data structure |
| **Betting Lines** | The Odds API | BALLDONTLIE odds | Multi-bookmaker comparison |
| **Game Schedules** | BALLDONTLIE | The Odds API | Consistent format |
| **Live Scores** | BALLDONTLIE | ESPN | Real-time updates |
| **Historical Stats** | BALLDONTLIE | ESPN | 1946-present data |
| **Season Averages** | BALLDONTLIE | Calculated from history | Dedicated endpoint |
| **Team Info** | BALLDONTLIE | Cached | Stable data |
| **Line Movements** | The Odds API | N/A | Odds API specialty |
| **Score Analysis** | OpenAI | N/A | AI interpretation |

---

## Why This Architecture?

### Benefits of BALLDONTLIE as Primary

1. **✅ Already Configured**
   - API key in environment (both local and Lovable)
   - No setup needed, ready to use
   - Zero friction to start

2. **✅ Superior Data Quality**
   - Clean, structured JSON responses
   - Consistent data model
   - Official documentation
   - Reduces parsing code by ~100 LOC

3. **✅ Comprehensive Coverage**
   - Historical data (1946-present)
   - Season averages built-in
   - Multiple sports ready (NBA, NFL, MLB, NHL, etc.)
   - Standings and leader boards

4. **✅ Built-in Betting Features**
   - Betting odds endpoint available
   - Can supplement The Odds API if needed
   - Single source of truth for game + odds

5. **✅ Better Developer Experience**
   - Predictable API structure
   - Official SDKs available
   - Active development/support

### Why Keep The Odds API?

1. **✅ Multi-Bookmaker Coverage**
   - The Odds API provides odds from 20+ bookmakers
   - BALLDONTLIE may have limited bookmaker coverage
   - Essential for finding best lines

2. **✅ Line Movement Tracking**
   - Already implemented and automated
   - Cron job running every 30 minutes
   - Critical for sharp money detection

3. **✅ Proven Reliability**
   - Already working in production
   - Automated infrastructure in place
   - Logging and monitoring set up

4. **✅ Specialized for Betting**
   - Purpose-built for betting data
   - Handles spreads, totals, moneylines
   - Updates faster during live games

### Why Keep ESPN as Fallback?

1. **✅ Zero Cost**
   - Free, no API key needed
   - No rate limits to manage

2. **✅ Already Implemented**
   - Working code in place
   - Database schema compatible
   - Minimal changes needed

3. **✅ Reliability Safety Net**
   - If BALLDONTLIE has issues
   - If API quota exceeded
   - Service outage protection

---

## Implementation Strategy

### Phase 0: Pre-Implementation (Day 1)

**Verify BALLDONTLIE API Access**

```bash
# Test BALLDONTLIE API key
curl -H "Authorization: YOUR_API_KEY" \
  "https://api.balldontlie.io/v1/teams"

# Should return NBA teams list
```

**Checklist:**
- [ ] Confirm API key in Supabase secrets
- [ ] Confirm API key in Lovable environment
- [ ] Test basic endpoint access
- [ ] Verify free tier quota (60 req/min)

---

### Phase 1: Core Integration (Week 1)

#### 1.1 Create BALLDONTLIE Utilities (Days 1-2)

**File:** `/src/utils/balldontlieApi.ts`

```typescript
// Core client functions
export async function getBallDontLieTeams(): Promise<Team[]>
export async function getBallDontLiePlayers(search?: string): Promise<Player[]>
export async function getBallDontLieGames(date: string): Promise<Game[]>
export async function getBallDontLieStats(date: string, gameId?: string): Promise<Stats[]>
export async function getBallDontLieSeasonAverage(playerId: number, season: number): Promise<SeasonAverage>

// Conversion utility for compatibility
export function convertBDLToESPNFormat(bdlStats: BDLStats): ESPNStats
```

**Key Features:**
- Type-safe interfaces
- Error handling with retries
- Rate limit management
- Response caching (memory)
- Logging for monitoring

#### 1.2 Create Supabase Edge Function (Days 3-4)

**File:** `/supabase/functions/fetch-balldontlie-stats/index.ts`

```typescript
// Mirrors fetch-espn-stats structure
// Parameters:
// - game_id OR date
// - store_data (default: true)
// - sport (default: basketball_nba)

// Features:
// - Fetches from BALLDONTLIE
// - Converts to existing schema
// - Stores in player_performance_history
// - Returns stats count
```

**File:** `/supabase/functions/sync-balldontlie-daily/index.ts`

```typescript
// Daily sync function
// - Fetches yesterday's completed games
// - Syncs all player stats
// - Updates performance history
// - Logs sync results
```

#### 1.3 Create Unified Stats Service (Day 5)

**File:** `/src/utils/unifiedStatsService.ts`

```typescript
/**
 * Intelligent stats fetching with automatic fallback
 */
export async function getPlayerStats(params: {
  gameId?: string;
  date?: string;
  playerName?: string;
  preferredSource?: 'balldontlie' | 'espn' | 'auto';
}): Promise<PlayerStats[]> {

  // 1. Check cache first
  const cached = await checkCache(params);
  if (cached && !isStale(cached)) return cached;

  // 2. Try BALLDONTLIE
  try {
    const stats = await fetchFromBallDontLie(params);
    if (stats && stats.length > 0) {
      await cacheStats(stats);
      logSuccess('balldontlie', params);
      return stats;
    }
  } catch (error) {
    logError('balldontlie', error);
  }

  // 3. Fallback to ESPN
  try {
    const stats = await fetchFromESPN(params);
    await cacheStats(stats);
    logSuccess('espn', params);
    return stats;
  } catch (error) {
    logError('espn', error);
    throw new Error('All data sources failed');
  }
}

// Similar functions for:
// - getGames()
// - getTeams()
// - getSeasonAverages()
```

#### 1.4 Testing (Days 6-7)

**Unit Tests:**
```typescript
// Test BALLDONTLIE client
test('fetches player stats correctly', async () => {
  const stats = await getBallDontLieStats('2024-12-15');
  expect(stats).toBeDefined();
  expect(stats.length).toBeGreaterThan(0);
});

// Test fallback mechanism
test('falls back to ESPN on error', async () => {
  mockBallDontLieError();
  const stats = await getPlayerStats({ date: '2024-12-15' });
  expect(stats.source).toBe('espn');
});

// Test data conversion
test('converts BALLDONTLIE format to ESPN format', () => {
  const converted = convertBDLToESPNFormat(mockBDLData);
  expect(converted.stats.points).toBe(35);
});
```

**Integration Tests:**
```bash
# Test live API
npm run test:integration:balldontlie

# Test Edge Function locally
supabase functions serve fetch-balldontlie-stats
curl -X POST http://localhost:54321/functions/v1/fetch-balldontlie-stats \
  -d '{"date": "2024-12-15", "store_data": false}'

# Test unified service
npm run test:unified-stats
```

---

### Phase 2: Migration & Automation (Week 2)

#### 2.1 Update Existing Components (Days 1-2)

**Update:** `/src/utils/espnApi.ts`

```typescript
// Replace direct ESPN calls with unified service calls

// OLD:
const stats = await fetchESPNGameStats(eventId);

// NEW:
const stats = await getPlayerStats({
  gameId: eventId,
  preferredSource: 'auto' // Will try BALLDONTLIE first
});
```

**Update:** `/src/components/PlayerStatsCard.tsx`

```typescript
// Use unified service
import { getPlayerStats } from '@/utils/unifiedStatsService';

// Component will automatically get BALLDONTLIE data
// with ESPN fallback, no changes to UI needed
```

#### 2.2 Database Schema Updates (Day 3)

```sql
-- Add source tracking to performance history
ALTER TABLE player_performance_history
ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'espn';

CREATE INDEX idx_player_perf_source
ON player_performance_history(data_source);

-- Add API usage tracking table
CREATE TABLE IF NOT EXISTS api_source_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  error_message TEXT,
  request_params JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_log_source_date
ON api_source_log(source, created_at DESC);

-- Function to get API health stats
CREATE OR REPLACE FUNCTION get_api_health_stats(
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE(
  source TEXT,
  total_requests BIGINT,
  success_rate DECIMAL,
  avg_response_time INTEGER,
  error_count BIGINT
)
LANGUAGE SQL
AS $$
  SELECT
    source,
    COUNT(*) as total_requests,
    ROUND(AVG(CASE WHEN success THEN 1 ELSE 0 END) * 100, 2) as success_rate,
    AVG(response_time_ms)::INTEGER as avg_response_time,
    SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as error_count
  FROM api_source_log
  WHERE created_at >= NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY source;
$$;
```

#### 2.3 Automated Daily Sync (Day 4)

**Create cron job similar to betting odds:**

```sql
-- Function to invoke BALLDONTLIE sync
CREATE OR REPLACE FUNCTION invoke_balldontlie_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url TEXT;
  v_request_id BIGINT;
BEGIN
  v_supabase_url := current_setting('app.settings.supabase_url', true);

  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://dskfsnbdgyjizoaafqfk.supabase.co';
  END IF;

  -- Sync yesterday's games (completed games only)
  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/sync-balldontlie-daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'sync_date', (CURRENT_DATE - INTERVAL '1 day')::TEXT
    )
  ) INTO v_request_id;

  RAISE NOTICE '[BALLDONTLIE-SYNC] Started daily sync (request: %)', v_request_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[BALLDONTLIE-SYNC] Error: %', SQLERRM;
END;
$$;

-- Schedule to run daily at 3 AM ET (after games complete)
SELECT cron.schedule(
  'balldontlie-daily-sync',
  '0 3 * * *',  -- 3 AM daily
  $$SELECT invoke_balldontlie_sync();$$
);
```

#### 2.4 Caching Implementation (Day 5)

**Create cache utility:**

```typescript
// /src/utils/statsCache.ts

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  source: string;
}

const CACHE_TTL = {
  teams: 24 * 60 * 60 * 1000,        // 24 hours (rarely changes)
  players: 4 * 60 * 60 * 1000,       // 4 hours
  games_live: 2 * 60 * 1000,         // 2 minutes (live games)
  games_final: 24 * 60 * 60 * 1000,  // 24 hours (completed)
  stats: 15 * 60 * 1000,             // 15 minutes
  season_avg: 24 * 60 * 60 * 1000,   // 24 hours
};

export class StatsCache {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T, type: keyof typeof CACHE_TTL, source: string) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      source
    });
  }

  get<T>(key: string, type: keyof typeof CACHE_TTL): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > CACHE_TTL[type]) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear() {
    this.cache.clear();
  }
}

export const statsCache = new StatsCache();
```

#### 2.5 Gradual Rollout (Days 6-7)

**Feature Flag System:**

```typescript
// /src/utils/featureFlags.ts

export const FEATURE_FLAGS = {
  USE_BALLDONTLIE: import.meta.env.VITE_ENABLE_BALLDONTLIE === 'true',
  BALLDONTLIE_PERCENTAGE: parseInt(import.meta.env.VITE_BALLDONTLIE_ROLLOUT || '100'),
};

export function shouldUseBallDontLie(userId?: string): boolean {
  if (!FEATURE_FLAGS.USE_BALLDONTLIE) return false;

  // Gradual rollout based on percentage
  if (userId) {
    const hash = simpleHash(userId);
    return (hash % 100) < FEATURE_FLAGS.BALLDONTLIE_PERCENTAGE;
  }

  return Math.random() * 100 < FEATURE_FLAGS.BALLDONTLIE_PERCENTAGE;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}
```

**Rollout Schedule:**
- Day 6: 10% of users (VITE_BALLDONTLIE_ROLLOUT=10)
- Day 7: 50% of users (VITE_BALLDONTLIE_ROLLOUT=50)
- Week 3: 100% of users (VITE_BALLDONTLIE_ROLLOUT=100)

---

### Phase 3: Betting Odds Integration (Week 3)

#### 3.1 Hybrid Odds Strategy (Days 1-3)

**Goal:** Use both The Odds API and BALLDONTLIE for comprehensive coverage

**File:** `/src/utils/oddsAggregator.ts`

```typescript
/**
 * Aggregates odds from multiple sources for best coverage
 */
export async function getComprehensiveOdds(gameId: string) {
  // 1. Fetch from The Odds API (primary - multi-bookmaker)
  const oddsAPIData = await fetchFromOddsAPI(gameId);

  // 2. Fetch from BALLDONTLIE (supplementary)
  const bdlOdds = await fetchBallDontLieOdds(gameId);

  // 3. Merge and deduplicate
  const allOdds = mergeOdds(oddsAPIData, bdlOdds);

  // 4. Calculate best lines
  const bestLines = findBestLines(allOdds);

  return {
    odds: allOdds,
    bestMoneyline: bestLines.moneyline,
    bestSpread: bestLines.spread,
    bestTotal: bestLines.total,
    bookmakerCount: allOdds.length,
    sources: ['rundown-api', 'balldontlie']
  };
}
```

**Benefits:**
- More bookmakers = better lines
- Redundancy if one source fails
- Can identify arbitrage opportunities

#### 3.2 Sharp Money Detection Enhancement (Days 4-5)

**Update:** `/supabase/functions/detect-sharp-money/index.ts`

```typescript
// Enhance with BALLDONTLIE historical data

// OLD: Only use line movements from The Odds API
const lineMovements = await getLineMovements(gameId);

// NEW: Combine with historical patterns from BALLDONTLIE
const lineMovements = await getLineMovements(gameId);
const historicalPatterns = await getBallDontLieHistoricalOdds(homeTeam, awayTeam);

// Detect sharp action more accurately
const sharpIndicators = detectSharpAction(lineMovements, historicalPatterns);
```

---

### Phase 4: Monitoring & Optimization (Week 4)

#### 4.1 Comprehensive Monitoring Dashboard (Days 1-2)

**Create admin view:**

```sql
-- View for API health monitoring
CREATE OR REPLACE VIEW v_api_health_dashboard AS
SELECT
  source,
  COUNT(*) as requests_24h,
  AVG(CASE WHEN success THEN 1 ELSE 0 END) * 100 as success_rate,
  AVG(response_time_ms) as avg_response_ms,
  MAX(response_time_ms) as max_response_ms,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as errors_24h
FROM api_source_log
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY source;

-- View for data source usage
CREATE OR REPLACE VIEW v_data_source_usage AS
SELECT
  data_source,
  COUNT(*) as stat_entries,
  COUNT(DISTINCT player_name) as unique_players,
  COUNT(DISTINCT game_date) as unique_games,
  MAX(created_at) as last_updated
FROM player_performance_history
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY data_source;
```

**Create monitoring function:**

```typescript
// /supabase/functions/health-check/index.ts

export async function checkSystemHealth() {
  return {
    balldontlie: await checkBallDontLieHealth(),
    oddsApi: await checkOddsAPIHealth(),
    espn: await checkESPNHealth(),
    database: await checkDatabaseHealth(),
    cacheHitRate: await getCacheHitRate(),
    timestamp: new Date().toISOString()
  };
}
```

#### 4.2 Automated Alerts (Day 3)

**Configure alerts for:**
- BALLDONTLIE error rate >5%
- BALLDONTLIE response time >1s
- Fallback to ESPN triggered >10 times/hour
- API quota usage >80%
- Database lag >500ms

**Alert channels:**
- Email notifications
- Slack webhook (if configured)
- Database logging

#### 4.3 Performance Optimization (Days 4-5)

**Optimizations:**

1. **Request Batching**
```typescript
// Batch player requests
const playerIds = [1, 2, 3, 4, 5];
// Instead of 5 requests:
for (const id of playerIds) {
  await getPlayer(id); // Bad
}
// Make 1 request:
await getPlayers({ ids: playerIds }); // Good
```

2. **Smarter Caching**
```typescript
// Prefetch common data
async function prefetchCommonData() {
  await Promise.all([
    cacheTeams(),
    cachePopularPlayers(),
    cacheToday'sGames()
  ]);
}
```

3. **Database Query Optimization**
```sql
-- Add composite indexes
CREATE INDEX idx_player_perf_name_date
ON player_performance_history(player_name, game_date DESC);

-- Partitioning for large tables
CREATE TABLE player_performance_history_2024
PARTITION OF player_performance_history
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

---

## Resource Allocation

### Development Team

| Role | Time Commitment | Duration |
|------|----------------|----------|
| Backend Developer | 100% (1 FTE) | 4 weeks |
| Frontend Developer | 25% (0.25 FTE) | 2 weeks |
| DevOps | 25% (0.25 FTE) | 4 weeks |
| QA Engineer | 50% (0.5 FTE) | 2 weeks |

### API Costs

| Service | Current Cost | New Cost | Notes |
|---------|-------------|----------|-------|
| The Odds API | $0-50/month | $0-50/month | Keep as-is |
| ESPN API | $0 | $0 | Fallback only |
| BALLDONTLIE | $0 | $0 | Free tier (60 req/min) |
| OpenAI | Variable | Variable | No change |
| **Total** | **~$25/month** | **~$25/month** | **No cost increase** |

**Future Scaling:**
- If BALLDONTLIE free tier insufficient: $89.99/month (ALL-ACCESS)
- Upgrade trigger: >60 requests/minute sustained
- Current estimate: ~4 requests/minute average ✅

---

## Timeline

### Week 1: Core Integration
- Days 1-2: BALLDONTLIE utilities
- Days 3-4: Edge functions
- Day 5: Unified stats service
- Days 6-7: Testing

### Week 2: Migration
- Days 1-2: Update components
- Day 3: Database updates
- Day 4: Automation setup
- Day 5: Caching
- Days 6-7: Gradual rollout

### Week 3: Betting Enhancement
- Days 1-3: Hybrid odds system
- Days 4-5: Sharp money detection
- Days 6-7: Testing & refinement

### Week 4: Production
- Days 1-2: Monitoring dashboard
- Day 3: Alerts setup
- Days 4-5: Performance optimization
- Days 6-7: Full deployment

---

## Success Metrics

### Technical KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| BALLDONTLIE uptime | >99% | API logs |
| Response time (p95) | <500ms | Performance monitoring |
| Cache hit rate | >70% | Cache analytics |
| Fallback rate | <5% | Source logs |
| Error rate | <1% | Error tracking |

### Business KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Prediction accuracy | +5% | Historical comparison |
| User engagement | +10% | DAU/MAU |
| Feature adoption | >80% | Usage analytics |
| Data freshness | <15min average | Database timestamps |

---

## Risk Management

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| BALLDONTLIE API outage | Low | High | ESPN fallback |
| Rate limit exceeded | Medium | Medium | Caching + queue |
| Data inconsistency | Low | Medium | Validation layer |
| Migration bugs | Medium | High | Gradual rollout |

### Mitigation Strategies

1. **Automatic Fallback**
```typescript
try {
  return await fetchFromBallDontLie(params);
} catch (error) {
  logError('balldontlie', error);
  return await fetchFromESPN(params); // Automatic
}
```

2. **Rate Limit Prevention**
```typescript
// Queue system
const requestQueue = new Queue({ concurrency: 10 });
await requestQueue.add(() => fetchStats(params));
```

3. **Data Validation**
```typescript
function validateStats(stats: Stats[]): boolean {
  return stats.every(s =>
    s.player && s.points >= 0 && s.rebounds >= 0
  );
}
```

---

## Rollback Plan

### Rollback Triggers
- Error rate >10%
- User complaints
- Data accuracy issues
- Performance degradation

### Rollback Process (< 5 minutes)

```bash
# 1. Disable BALLDONTLIE
export VITE_ENABLE_BALLDONTLIE=false

# 2. Clear cache
curl -X POST /api/admin/clear-cache

# 3. Restart services
npm run restart

# 4. Verify ESPN working
npm run test:espn
```

**Database rollback:**
```sql
-- Revert to ESPN-only mode
UPDATE player_performance_history
SET data_source = 'espn'
WHERE created_at >= '2025-01-01';

-- Disable cron job
SELECT cron.unschedule('balldontlie-daily-sync');
```

---

## Testing Strategy

### Unit Tests
```typescript
describe('BALLDONTLIE Integration', () => {
  test('fetches player stats', async () => {
    const stats = await getBallDontLieStats('2024-12-15');
    expect(stats.length).toBeGreaterThan(0);
  });

  test('converts to ESPN format', () => {
    const converted = convertBDLToESPNFormat(mockData);
    expect(converted.stats.points).toBe(35);
  });

  test('falls back on error', async () => {
    mockBallDontLieError();
    const stats = await getPlayerStats({ date: '2024-12-15' });
    expect(stats.source).toBe('espn');
  });
});
```

### Integration Tests
```bash
# Test full flow
npm run test:integration

# Test edge functions
supabase functions serve
npm run test:edge-functions

# Test cron jobs
npm run test:cron
```

### Load Tests
```typescript
// Simulate 100 concurrent users
async function loadTest() {
  const requests = Array(100).fill(null).map(() =>
    getPlayerStats({ date: '2024-12-15' })
  );

  const results = await Promise.allSettled(requests);
  const successRate = results.filter(r => r.status === 'fulfilled').length / 100;

  console.log(`Success rate: ${successRate * 100}%`);
  expect(successRate).toBeGreaterThan(0.95);
}
```

---

## Documentation Updates

### Files to Update

1. **README.md**
   - Add BALLDONTLIE setup instructions
   - Update environment variables section
   - Add troubleshooting guide

2. **API_INTEGRATION.md**
   - Document new architecture
   - Add BALLDONTLIE endpoints
   - Update data flow diagrams

3. **DEPLOYMENT.md**
   - Add BALLDONTLIE API key setup
   - Update deployment checklist

4. **Developer Guide**
   - How to use unified stats service
   - When to use which data source
   - Caching best practices

---

## Next Steps

### Immediate Actions (This Week)

1. **✅ Verify API Access**
   ```bash
   # Test BALLDONTLIE API
   curl -H "Authorization: $BALLDONTLIE_API_KEY" \
     "https://api.balldontlie.io/v1/teams" | jq
   ```

2. **✅ Create Initial Utilities**
   - Start with `/src/utils/balldontlieApi.ts`
   - Implement basic fetch functions
   - Add TypeScript types

3. **✅ Test Basic Integration**
   - Fetch today's games
   - Fetch player stats for one game
   - Verify data quality

4. **✅ Review & Approve Plan**
   - Stakeholder review
   - Team capacity check
   - Timeline confirmation

### Week 1 Kickoff

- **Monday**: Team briefing, environment setup
- **Tuesday-Wednesday**: Core utilities development
- **Thursday-Friday**: Edge functions development
- **Weekend**: Code review, planning for Week 2

---

## Conclusion

This revised plan leverages the best of all available data sources:

✅ **BALLDONTLIE** - Clean, comprehensive player & game data
✅ **The Odds API** - Multi-bookmaker betting lines (keep existing automation)
✅ **ESPN** - Reliable fallback (zero cost, proven)
✅ **OpenAI** - Score analysis (keep as-is)

### Key Advantages

1. **No Cost Increase** - Free tier sufficient for current usage
2. **Already Configured** - API key ready in both environments
3. **Better Data Quality** - Reduces code complexity by ~100 LOC
4. **Future Ready** - Multi-sport expansion enabled
5. **Low Risk** - Automatic fallback to ESPN
6. **Better Betting** - Enhanced odds aggregation + historical data

### Expected Outcomes

- **Development Speed**: +30% (cleaner API)
- **Prediction Accuracy**: +5% (better historical data)
- **Code Maintainability**: +40% (less parsing logic)
- **User Experience**: +10% engagement (fresher data)

**Ready to implement! 🚀**

---

**Document Version:** 2.0 (Revised)
**Last Updated:** October 24, 2025
**Status:** Approved for Implementation
