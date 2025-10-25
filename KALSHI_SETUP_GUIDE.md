# Kalshi Integration Setup Guide

## Current Status: No Active Data

**Issue**: The Kalshi integration is fully implemented but has no active data because:
1. Kalshi API credentials are not configured in Supabase
2. No markets have been synced from the Kalshi API to the database
3. The `kalshi_markets` table is empty

---

## ✅ What's Already Implemented

The following components are **fully implemented and ready to use**:

### 1. Database Schema
- `kalshi_markets` - Market data cache
- `kalshi_positions` - User positions
- `kalshi_orders` - Order history
- `kalshi_fills` - Trade executions
- `kalshi_market_analytics` - AI analysis

**Migration**: `/supabase/migrations/20251025000000_add_kalshi_tables.sql`

### 2. Edge Functions (Serverless)
- ✅ `test-kalshi-connection` - Verify API credentials
- ✅ `fetch-kalshi-markets` - Sync markets from Kalshi
- ✅ `analyze-kalshi-market` - AI-powered market analysis
- ✅ `detect-arbitrage` - Find arbitrage opportunities
- ✅ `monitor-kalshi-alerts` - Trading alerts

### 3. Frontend Components
- ✅ `/kalshi` page route
- ✅ `KalshiMarketBrowser` - Browse and filter markets
- ✅ `KalshiMarketCard` - Individual market display
- ✅ `KalshiPortfolioDashboard` - Portfolio management
- ✅ Real-time WebSocket updates

### 4. API Integration
- ✅ Full TypeScript Kalshi API client (`src/utils/kalshiApi.ts`)
- ✅ WebSocket client for real-time updates (`src/utils/kalshiWebSocket.ts`)

---

## 🔧 Setup Required

### Step 1: Get Kalshi Credentials

1. **Sign up for Kalshi**: https://kalshi.com
2. **Get your credentials**:
   - Email
   - Password
   - (Optional) API Key for advanced features

### Step 2: Configure Supabase Secrets

You need to add the following secrets to your Supabase project:

```bash
# Required for basic functionality
KALSHI_EMAIL=your-kalshi-email@example.com
KALSHI_PASSWORD=your-kalshi-password

# Optional for advanced API access
KALSHI_API_KEY=your-api-key
KALSHI_PRIVATE_KEY=your-private-key-base64

# Required for AI analysis features
OPENAI_API_KEY=sk-your-openai-api-key
```

#### How to Set Secrets in Supabase:

**Option A: Via Supabase Dashboard**
1. Go to https://supabase.com/dashboard/project/dskfsnbdgyjizoaafqfk
2. Navigate to **Settings** → **Edge Functions**
3. Add each secret under **Secrets**

**Option B: Via Supabase CLI**
```bash
# Install Supabase CLI if needed
npm install -g supabase

# Link to your project
npx supabase link --project-ref dskfsnbdgyjizoaafqfk

# Set secrets
npx supabase secrets set KALSHI_EMAIL=your-email@example.com
npx supabase secrets set KALSHI_PASSWORD=your-password
npx supabase secrets set OPENAI_API_KEY=sk-your-key
```

### Step 3: Deploy/Redeploy Edge Functions

After setting secrets, redeploy the Kalshi edge functions:

```bash
npx supabase functions deploy test-kalshi-connection
npx supabase functions deploy fetch-kalshi-markets
npx supabase functions deploy analyze-kalshi-market
npx supabase functions deploy detect-arbitrage
npx supabase functions deploy monitor-kalshi-alerts
```

### Step 4: Test the Connection

Test that your Kalshi credentials work:

```bash
curl -X POST "https://dskfsnbdgyjizoaafqfk.supabase.co/functions/v1/test-kalshi-connection" \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json"
```

Expected response if successful:
```json
{
  "success": true,
  "message": "Kalshi API connection successful!",
  "results": {
    "credentials_found": {
      "email": true,
      "password": true
    },
    "tests": {
      "exchange_status": { "success": true },
      "login": { "success": true, "has_token": true },
      "markets": { "success": true, "market_count": 5 }
    }
  }
}
```

### Step 5: Sync Initial Market Data

Once credentials are configured, sync markets from Kalshi:

```bash
# Sync all sports markets
curl -X POST "https://dskfsnbdgyjizoaafqfk.supabase.co/functions/v1/fetch-kalshi-markets" \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json"

# OR sync specific sport (NBA, NFL, MLB, NHL)
curl -X POST "https://dskfsnbdgyjizoaafqfk.supabase.co/functions/v1/fetch-kalshi-markets" \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sport": "NBA"}'
```

Expected response:
```json
{
  "success": true,
  "fetched_count": 150,
  "stored_count": 150,
  "message": "Successfully fetched and stored 150 Kalshi markets"
}
```

### Step 6: Verify Data in Frontend

1. Open your app and navigate to `/kalshi`
2. You should see markets displayed
3. Click "Sync" button to refresh data
4. Markets should appear grouped by sport

---

## 🧪 Testing & Diagnostics

### Check Database Tables

Run this query in Supabase SQL Editor:

```sql
-- Check if markets were synced
SELECT
  COUNT(*) as total_markets,
  sport_key,
  status
FROM kalshi_markets
GROUP BY sport_key, status;

-- View sample markets
SELECT ticker, title, sport_key, status, volume, liquidity
FROM kalshi_markets
ORDER BY volume DESC
LIMIT 10;
```

### Test Individual Functions

```bash
# Test connection
curl -X POST "https://dskfsnbdgyjizoaafqfk.supabase.co/functions/v1/test-kalshi-connection" \
  -H "apikey: YOUR_KEY"

# Fetch markets
curl -X POST "https://dskfsnbdgyjizoaafqfk.supabase.co/functions/v1/fetch-kalshi-markets" \
  -H "apikey: YOUR_KEY"

# Analyze a market (after markets are fetched)
curl -X POST "https://dskfsnbdgyjizoaafqfk.supabase.co/functions/v1/analyze-kalshi-market" \
  -H "apikey: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ticker": "NBA-LAKERS-WIN-2024"}'
```

---

## 📊 Features Available After Setup

Once configured, you'll have access to:

### Market Browsing
- **Sport Filtering**: NBA, NFL, MLB, NHL
- **Search**: Find markets by name or ticker
- **Sorting**: By volume, edge, or closing time
- **Real-time Updates**: WebSocket price feeds

### AI Analysis
- **Model Probabilities**: AI-estimated win probabilities
- **Edge Detection**: Identify +EV opportunities
- **Confidence Scores**: Reliability ratings
- **Kelly Criterion**: Optimal bet sizing

### Portfolio Management
- **Position Tracking**: Monitor open positions
- **P&L Calculation**: Real-time profit/loss
- **Order History**: View all trades
- **Trade Execution**: Place YES/NO orders

### Advanced Features
- **Arbitrage Detection**: Cross-platform opportunities
- **Alerts**: Price movements, high edge, closing soon
- **Live Game Integration**: Combine live scores with markets
- **Hedge Calculator**: Calculate optimal hedge bets

---

## 🚨 Troubleshooting

### "No markets found"
- **Cause**: Database table is empty
- **Solution**: Run Step 5 to sync markets

### "Access denied" when calling edge functions
- **Cause**: Missing Supabase API key or function not deployed
- **Solution**: Include `apikey` header and redeploy functions

### "Login failed" in connection test
- **Cause**: Invalid Kalshi credentials
- **Solution**: Verify email/password in Supabase secrets

### Markets not updating
- **Cause**: WebSocket connection issues
- **Solution**: Check browser console, verify Kalshi API status

### AI analysis not working
- **Cause**: Missing OpenAI API key
- **Solution**: Set `OPENAI_API_KEY` in Supabase secrets

---

## 📝 Configuration Checklist

- [ ] Kalshi account created
- [ ] Kalshi credentials obtained
- [ ] Supabase secrets configured (KALSHI_EMAIL, KALSHI_PASSWORD)
- [ ] OpenAI API key set (for AI features)
- [ ] Edge functions deployed
- [ ] Connection test passed
- [ ] Markets synced to database
- [ ] Frontend displaying markets
- [ ] WebSocket real-time updates working

---

## 🔗 Quick Links

- **Kalshi API Docs**: https://trading-api.readme.io/
- **Supabase Dashboard**: https://supabase.com/dashboard/project/dskfsnbdgyjizoaafqfk
- **Frontend Page**: `/kalshi` route in app
- **Edge Functions Code**: `/supabase/functions/`

---

## 💡 Next Steps

After setup is complete:

1. **Set up automated syncing**:
   - Configure cron job to run `fetch-kalshi-markets` every hour
   - Enable `monitor-kalshi-alerts` for real-time notifications

2. **Customize AI analysis**:
   - Adjust confidence thresholds in `analyze-kalshi-market`
   - Fine-tune Kelly Criterion parameters

3. **Enable push notifications**:
   - Integrate with notification service
   - Set up alert preferences per user

4. **Add more sports**:
   - Extend sport filtering to include additional leagues
   - Add custom market categories

---

**Status**: Ready for configuration. Follow Steps 1-6 above to activate Kalshi integration.
