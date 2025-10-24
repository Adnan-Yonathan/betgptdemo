# BALLDONTLIE API Implementation Plan

## Quick Reference

**Status:** Ready for Implementation
**Estimated Duration:** 6-7 weeks
**Complexity:** Medium
**Risk Level:** Low-Medium

---

## Phase 1: Foundation (Week 1-2)

### 1.1 Account Setup & Configuration
**Owner:** DevOps/Backend
**Duration:** 1 day

- [ ] Create account at https://www.balldontlie.io/
- [ ] Obtain API key
- [ ] Add to environment variables:
  ```bash
  # Supabase Secrets
  BALLDONTLIE_API_KEY=your_key_here
  BALLDONTLIE_BASE_URL=https://api.balldontlie.io/v1
  ENABLE_BALLDONTLIE=true
  ```
- [ ] Add to `.env.local` for local development
- [ ] Document key rotation process

### 1.2 Core Utilities
**Owner:** Backend
**Duration:** 3 days

**Create:** `/src/utils/balldontlieApi.ts`
```typescript
// Core functions needed:
- searchPlayers(query: string)
- getGameStats(date: string)
- getPlayerSeasonAverage(playerId: number, season: number)
- getGames(date: string)
- getBettingOdds(gameId: string) // Future
- convertToESPNFormat(bdlStats) // Compatibility layer
```

**Create:** `/src/types/balldontlie.ts`
```typescript
// Type definitions for BALLDONTLIE responses
- BallDontLiePlayer
- BallDontLieGame
- BallDontLieStats
- BallDontLieResponse<T>
```

### 1.3 Supabase Edge Functions
**Owner:** Backend
**Duration:** 4 days

**Create:** `/supabase/functions/fetch-balldontlie-stats/index.ts`
- Mirror existing `fetch-espn-stats` structure
- Add BALLDONTLIE-specific error handling
- Implement data transformation
- Store in `player_performance_history`

**Create:** `/supabase/functions/sync-balldontlie-player-stats/index.ts`
- Fetch today's games
- Sync stats for all games
- Rate limit management (60 req/min)
- Fallback to ESPN on errors

**Create:** `/supabase/functions/unified-stats-service/index.ts`
- Primary: BALLDONTLIE
- Fallback: ESPN
- Cache management
- Source selection logic

### 1.4 Testing
**Owner:** QA/Backend
**Duration:** 2 days

- [ ] Unit tests for API client
- [ ] Integration tests for Edge Functions
- [ ] Mock BALLDONTLIE responses
- [ ] Test error scenarios
- [ ] Verify data accuracy

**Test Coverage Target:** >80%

---

## Phase 2: Integration (Week 3-4)

### 2.1 Database Schema Updates
**Owner:** Backend/DBA
**Duration:** 2 days

```sql
-- New table: betting_odds
CREATE TABLE betting_odds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id TEXT NOT NULL,
  event_date TIMESTAMP NOT NULL,
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  bookmaker TEXT NOT NULL,
  odds_data JSONB NOT NULL,
  player_props JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(game_id, bookmaker)
);

CREATE INDEX idx_betting_odds_game_date ON betting_odds(event_date DESC);

-- New table: api_usage_log
CREATE TABLE api_usage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_source TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_usage_source ON api_usage_log(api_source, created_at);
```

### 2.2 Caching Layer
**Owner:** Backend
**Duration:** 3 days

**Create:** `/src/utils/statsCache.ts`
```typescript
// Cache strategy:
- Cache player stats: 15 minutes
- Cache game data: 5 minutes (live games), 24 hours (completed)
- Cache season averages: 24 hours
- Use Redis or Supabase for storage
```

**Implementation:**
- [ ] Set up caching infrastructure
- [ ] Implement cache invalidation
- [ ] Add cache hit/miss logging
- [ ] Configure TTL per data type

### 2.3 Rate Limit Management
**Owner:** Backend
**Duration:** 2 days

**Create:** `/src/utils/rateLimiter.ts`
```typescript
// Rate limiting:
- Track requests per minute
- Queue excess requests
- Implement exponential backoff
- Monitor quota consumption
```

**Features:**
- [ ] Request queue with priority
- [ ] Auto-throttling at 80% capacity
- [ ] Alert at 90% capacity
- [ ] Graceful degradation

### 2.4 Fallback Logic
**Owner:** Backend
**Duration:** 2 days

**Update:** `/src/utils/statsService.ts` (NEW)
```typescript
async function getPlayerStats(gameId: string, source?: 'auto' | 'balldontlie' | 'espn') {
  try {
    if (source === 'auto' && ENABLE_BALLDONTLIE) {
      return await fetchFromBallDontLie(gameId);
    }
  } catch (error) {
    logError(error);
    return await fetchFromESPN(gameId); // Fallback
  }
}
```

**Logic:**
1. Try BALLDONTLIE (if enabled)
2. On error, try ESPN
3. Log failure for monitoring
4. Return cached data if both fail

---

## Phase 3: Enhancement (Week 5-6)

### 3.1 Betting Odds Integration
**Owner:** Backend/Frontend
**Duration:** 4 days

**Create:** `/supabase/functions/fetch-betting-odds/index.ts`
- Fetch odds from BALLDONTLIE
- Store in `betting_odds` table
- Sync hourly for live games

**Update:** `/src/components/BettingDashboard.tsx`
- Display live odds
- Show odds movement
- Highlight value bets

### 3.2 Historical Data Backfill
**Owner:** Backend
**Duration:** 3 days

**Create:** `/supabase/functions/backfill-historical-data/index.ts`
```typescript
// Backfill process:
1. Identify top 50 players for betting
2. Fetch last 30 games for each
3. Store in player_performance_history
4. Rate-limited execution
```

**Scope:**
- Last 30 days of data
- Top 50 most-bet players
- Run overnight to avoid rate limits

### 3.3 Monitoring & Alerts
**Owner:** DevOps/Backend
**Duration:** 2 days

**Metrics to Track:**
```yaml
API Health:
  - Response time (p50, p95, p99)
  - Success rate
  - Error rate by type
  - Rate limit consumption

Data Quality:
  - Records fetched per day
  - Data completeness
  - Discrepancies vs ESPN

Business:
  - Prediction accuracy
  - User engagement
  - Feature usage
```

**Alerts:**
- Error rate >5%
- Response time >1s
- Rate limit >90%
- API downtime

**Tools:**
- Supabase dashboard
- Custom logging
- Email/Slack notifications

### 3.4 Performance Optimization
**Owner:** Backend
**Duration:** 2 days

**Optimizations:**
- [ ] Batch API requests where possible
- [ ] Optimize database queries
- [ ] Implement smart caching
- [ ] Reduce redundant calls
- [ ] Add request deduplication

**Targets:**
- API response time: <500ms
- Database query time: <100ms
- Cache hit rate: >70%

---

## Phase 4: Deployment (Week 7)

### 4.1 Staging Deployment
**Owner:** DevOps
**Duration:** 1 day

- [ ] Deploy to staging environment
- [ ] Run full test suite
- [ ] Performance testing
- [ ] Load testing (100 concurrent users)
- [ ] Verify monitoring dashboards

### 4.2 Production Rollout
**Owner:** DevOps/Product
**Duration:** 3 days

**Gradual Rollout Strategy:**

**Day 1: 10% Traffic**
- Enable for 10% of users
- Monitor error rates
- Check data quality
- Verify caching

**Day 2: 50% Traffic**
- Increase to 50% if metrics good
- Continue monitoring
- Gather user feedback

**Day 3: 100% Traffic**
- Full rollout if no issues
- Keep ESPN fallback active
- Monitor closely for 24 hours

### 4.3 Validation & Cleanup
**Owner:** Backend/QA
**Duration:** 2 days

**Validation:**
- [ ] Verify all stats accurate
- [ ] Check betting odds integration
- [ ] Test fallback mechanisms
- [ ] Validate caching behavior
- [ ] Review logs for errors

**Cleanup:**
- [ ] Remove debug logging
- [ ] Optimize code
- [ ] Update documentation
- [ ] Archive old ESPN-only code (keep for fallback)

---

## Rollback Plan

### Triggers for Rollback
- Error rate >10%
- Data accuracy issues
- Rate limit consistently exceeded
- API downtime >1 hour
- User complaints

### Rollback Process
1. Set `ENABLE_BALLDONTLIE=false`
2. Revert to ESPN-only mode
3. Investigate issues
4. Fix and redeploy

**Rollback Time:** <5 minutes

---

## Resource Requirements

### Team
- **Backend Developer:** 1 FTE × 6 weeks
- **Frontend Developer:** 0.5 FTE × 2 weeks
- **DevOps Engineer:** 0.25 FTE × 7 weeks
- **QA Engineer:** 0.5 FTE × 3 weeks

### Infrastructure
- BALLDONTLIE API key (Free tier initially)
- Additional Supabase Edge Function capacity
- Caching infrastructure (Redis or Supabase)
- Monitoring tools (existing)

### Budget
- **API Costs:** $0/month (free tier)
- **Infrastructure:** $0-50/month (caching)
- **Total:** $0-50/month initial

**Future Costs (if needed):**
- BALLDONTLIE ALL-ACCESS: $89.99/month
- Upgrade only if free tier insufficient

---

## Success Metrics

### Technical KPIs
| Metric | Target | Measurement |
|--------|--------|-------------|
| API Uptime | 99.5% | Monitoring dashboard |
| Response Time (p95) | <500ms | Performance logs |
| Error Rate | <1% | Error tracking |
| Cache Hit Rate | >70% | Cache analytics |
| Data Accuracy | >99% | Spot checks vs ESPN |

### Business KPIs
| Metric | Target | Measurement |
|--------|--------|-------------|
| Prediction Accuracy | +5% | Historical comparison |
| User Engagement | +10% | Analytics |
| Feature Adoption | >80% | Usage tracking |
| User Satisfaction | >4.5/5 | Surveys |

---

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| API key exposure | High | Low | Env vars, key rotation |
| Rate limit exceeded | Medium | Medium | Caching, queuing |
| Service downtime | High | Low | ESPN fallback |
| Cost escalation | Medium | Low | Monitor usage, alerts |
| Data inconsistency | Medium | Low | Validation, cross-checks |

---

## Dependencies

### External
- BALLDONTLIE API availability
- Stable internet connection
- Supabase platform stability

### Internal
- Existing ESPN integration (for fallback)
- Database schema flexibility
- Deployment pipeline readiness

---

## Communication Plan

### Stakeholder Updates
- **Weekly:** Status update to product team
- **Bi-weekly:** Demo to stakeholders
- **Phase completion:** Detailed report

### Documentation
- [ ] API client usage guide
- [ ] Edge Function documentation
- [ ] Deployment runbook
- [ ] Troubleshooting guide
- [ ] User-facing feature docs

### Training
- [ ] Developer training on new API
- [ ] Operations training on monitoring
- [ ] Support team briefing on changes

---

## Post-Launch

### Week 8: Monitoring & Optimization
- Review metrics daily
- Address any issues
- Gather user feedback
- Optimize based on usage patterns

### Week 9-10: Feature Enhancement
- Add advanced stats integration
- Implement ML model improvements
- Enhance betting recommendations
- Consider multi-sport expansion

### Week 11-12: Evaluation
- Conduct retrospective
- Measure against KPIs
- Plan next phase enhancements
- Consider paid tier upgrade

---

## Quick Start Checklist

**Before Starting:**
- [ ] Review evaluation report
- [ ] Get stakeholder approval
- [ ] Allocate team resources
- [ ] Create BALLDONTLIE account

**Week 1 Must-Do:**
- [ ] Obtain API key
- [ ] Set up environment variables
- [ ] Create base API client
- [ ] Write first test

**Track Progress:**
- Use this document as checklist
- Update status weekly
- Flag blockers immediately
- Communicate changes

---

## Contact & Support

**BALLDONTLIE:**
- Documentation: https://docs.balldontlie.io/
- Website: https://www.balldontlie.io/
- Support: Check website for contact info

**Internal:**
- Project Lead: [TBD]
- Backend Lead: [TBD]
- DevOps: [TBD]

---

**Document Version:** 1.0
**Last Updated:** October 24, 2025
**Status:** Ready for Implementation
