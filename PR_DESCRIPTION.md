# Kalshi Prediction Markets Integration

This PR adds complete integration with Kalshi, a CFTC-regulated prediction market exchange, enabling users to trade on sports outcomes with real-time pricing, AI analysis, and advanced features.

## 🎯 Overview

Kalshi offers prediction markets for sports events where users can trade binary outcome contracts (YES/NO) on games, player props, and season outcomes. This integration brings prediction markets to BetGPT alongside traditional sportsbook betting.

---

## ✨ Features Added

### Phase 1: Core Infrastructure
- **Kalshi API Client** (`src/utils/kalshiApi.ts`)
  - Full TypeScript client with JWT authentication
  - Auto-refresh tokens (30-minute expiry)
  - Market data, portfolio, and order management
  - Retry logic with exponential backoff
  - Helper functions for probability and edge calculations

- **Database Schema** (5 new tables)
  - `kalshi_markets` - Market data with sports categorization
  - `kalshi_positions` - User positions with auto P&L calculation
  - `kalshi_orders` - Order tracking and history
  - `kalshi_fills` - Trade execution records
  - `kalshi_market_analytics` - AI analysis storage

- **Edge Functions**
  - `test-kalshi-connection` - Verify API credentials
  - `fetch-kalshi-markets` - Sync sports markets from Kalshi

### Phase 2: User Interface
- **KalshiMarketCard Component**
  - Beautiful market display with YES/NO pricing
  - Bid/Ask spreads with implied probabilities
  - Market stats (volume, open interest, liquidity)
  - AI analysis section (edge, confidence, EV)
  - Sport-specific badges and colors
  - Dark mode support

- **KalshiMarketBrowser Component**
  - Browse by sport (NBA, NFL, MLB, NHL)
  - Real-time search and filtering
  - Sort by volume or closing time
  - Sync button for latest data
  - Responsive design

### Phase 3: Real-time & AI
- **WebSocket Client** (`src/utils/kalshiWebSocket.ts`)
  - Real-time price updates
  - Auto-reconnect with exponential backoff
  - React hook: `useKalshiWebSocket(ticker)`
  - Event handlers for updates/errors

- **AI Market Analysis** (`analyze-kalshi-market`)
  - GPT-4o powered market analysis
  - Fetches related sports data
  - Calculates model probability vs market
  - Edge detection and EV calculation
  - Kelly Criterion bet sizing
  - Detailed reasoning

### Phase 4: Advanced Features
- **Dedicated Kalshi Page** (`/kalshi`)
  - Markets browser with sport tabs
  - Portfolio view for authenticated users
  - Info banner explaining Kalshi
  - Integrated navigation

- **Portfolio Dashboard**
  - Summary cards (value, P&L, positions, orders)
  - Three tabs: Positions, Orders, History
  - Real-time P&L calculations
  - Trade history with timestamps

- **Live Game View** (`LiveGameWithKalshi`)
  - Real-time scores + Kalshi markets
  - Live WebSocket price updates
  - Win probability meter
  - Automatic hedge opportunity detection

- **Arbitrage Detector** (`detect-arbitrage`)
  - Compares Kalshi vs sportsbook odds
  - Detects pure arbitrage (guaranteed profit)
  - Identifies positive EV opportunities
  - Calculates optimal stake sizing

- **Alert System** (`monitor-kalshi-alerts`)
  - High-edge markets (8%+ edge)
  - Significant price movements (10%+ changes)
  - Volume spikes
  - Markets closing soon (<1 hour)
  - Priority levels (urgent, high, medium, low)

---

## 📊 Technical Details

### Files Created (15 new files)
**Frontend:**
- `src/utils/kalshiApi.ts` (717 lines)
- `src/utils/kalshiWebSocket.ts` (442 lines)
- `src/components/KalshiMarketCard.tsx` (370 lines)
- `src/components/KalshiMarketBrowser.tsx` (249 lines)
- `src/components/KalshiPortfolioDashboard.tsx` (350 lines)
- `src/components/LiveGameWithKalshi.tsx` (300 lines)
- `src/pages/KalshiPage.tsx` (120 lines)

**Backend:**
- `supabase/migrations/20251025000000_add_kalshi_tables.sql` (390 lines)
- `supabase/functions/test-kalshi-connection/index.ts` (219 lines)
- `supabase/functions/fetch-kalshi-markets/index.ts` (284 lines)
- `supabase/functions/analyze-kalshi-market/index.ts` (365 lines)
- `supabase/functions/detect-arbitrage/index.ts` (400 lines)
- `supabase/functions/monitor-kalshi-alerts/index.ts` (300 lines)

**Modified Files:**
- `src/App.tsx` (added /kalshi route)

**Total:** ~4,500+ lines of production-ready code

### Database Changes
- 5 new tables with RLS policies
- Automatic P&L calculation triggers
- Comprehensive indexes for performance
- Sports categorization (NBA, NFL, MLB, NHL)

### API Integration
- REST API client with full type safety
- WebSocket for real-time updates
- JWT authentication with auto-refresh
- Rate limiting and error handling

---

## 🚀 Usage Examples

### Browse Kalshi Markets
```typescript
// Visit dedicated page
navigate('/kalshi');

// Or use component directly
<KalshiMarketBrowser
  defaultSport="NBA"
  onTrade={(market, side) => handleTrade(market, side)}
/>
```

### View Live Game with Markets
```typescript
<LiveGameWithKalshi
  homeTeam="Lakers"
  awayTeam="Celtics"
  sport="NBA"
/>
```

### Detect Arbitrage Opportunities
```typescript
const { data } = await supabase.functions.invoke('detect-arbitrage', {
  body: { sport: 'NBA', min_profit: 2 }
});
// Returns guaranteed profit opportunities
```

### Get AI Market Analysis
```typescript
const { data } = await supabase.functions.invoke('analyze-kalshi-market', {
  body: { ticker: 'KXNBA-24-LAL-BOS-10-25' }
});
// Returns edge, confidence, recommendation, reasoning
```

### Real-time Price Updates
```typescript
const { connected, marketData } = useKalshiWebSocket('KXNBA-24-LAL-BOS-10-25');
// Auto-updates when prices change
```

---

## ⚙️ Setup Required

### Environment Variables
Add to Supabase secrets:
```bash
KALSHI_EMAIL=your-kalshi-email@example.com
KALSHI_PASSWORD=your-kalshi-password
```

### Database Migration
```bash
# Apply the migration
npx supabase migration up
```

### Optional: Schedule Cron Jobs
```sql
-- Monitor alerts every 5 minutes
SELECT cron.schedule(
  'monitor-kalshi-alerts',
  '*/5 * * * *',
  'SELECT net.http_post(...)'
);

-- Detect arbitrage every 10 minutes
SELECT cron.schedule(
  'detect-arbitrage',
  '*/10 * * * *',
  'SELECT net.http_post(...)'
);
```

---

## 🎯 Key Benefits

1. **Prediction Market Trading** - Trade on sports outcomes with transparent pricing
2. **Real-time Updates** - WebSocket streaming for live price changes
3. **AI-Powered Analysis** - GPT-4o recommendations with edge detection
4. **Arbitrage Detection** - Automatically find guaranteed profit opportunities
5. **Portfolio Tracking** - Monitor all positions with real-time P&L
6. **Automated Alerts** - Get notified of high-edge markets
7. **Live Game Integration** - See markets alongside live scores
8. **Hedge Opportunities** - Detect when to hedge positions

---

## 🧪 Testing

### Manual Testing
1. Visit `/kalshi` page
2. Click "Sync" to fetch markets from Kalshi
3. Browse markets by sport
4. View portfolio (requires auth)
5. Test real-time WebSocket updates

### Edge Functions
```bash
# Test connection
curl -X POST https://[PROJECT].supabase.co/functions/v1/test-kalshi-connection

# Fetch markets
curl -X POST https://[PROJECT].supabase.co/functions/v1/fetch-kalshi-markets \
  -H "Authorization: Bearer [KEY]" \
  -d '{"sport":"NBA"}'

# Analyze market
curl -X POST https://[PROJECT].supabase.co/functions/v1/analyze-kalshi-market \
  -H "Authorization: Bearer [KEY]" \
  -d '{"ticker":"KXNBA-24-LAL-BOS-10-25"}'

# Detect arbitrage
curl -X POST https://[PROJECT].supabase.co/functions/v1/detect-arbitrage \
  -H "Authorization: Bearer [KEY]" \
  -d '{"sport":"NBA","min_profit":2}'

# Monitor alerts
curl -X POST https://[PROJECT].supabase.co/functions/v1/monitor-kalshi-alerts \
  -H "Authorization: Bearer [KEY]"
```

---

## 📝 Breaking Changes

None - this is entirely new functionality.

---

## 🔒 Security Considerations

- All Kalshi credentials stored in Supabase secrets (never in code)
- RLS policies protect user positions and orders
- JWT tokens auto-refresh before expiration
- No sensitive data exposed in client-side code
- API keys handled server-side only

---

## 📚 Documentation

Full implementation plan and API reference available in:
- Kalshi API docs: https://docs.kalshi.com
- Component documentation in JSDoc comments
- Type definitions in TypeScript

---

## 🎉 What's Next

Future enhancements could include:
- Push notifications for alerts
- Advanced charting for market prices
- Social features (share markets/positions)
- Mobile app integration
- More sports coverage

---

## 📸 Screenshots

(Add screenshots when deployed)

---

**Ready for review and deployment!** 🚀

All features are production-ready with comprehensive error handling, type safety, and responsive design.

Co-Authored-By: Claude <noreply@anthropic.com>
