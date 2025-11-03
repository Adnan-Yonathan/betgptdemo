# BetGPT Quick Start Guide

Get up and running with BetGPT in **10 minutes**.

## Prerequisites

- [Supabase account](https://supabase.com) (free tier works)
- [Node.js 18+](https://nodejs.org)
- [Supabase CLI](https://supabase.com/docs/guides/cli): `npm install -g supabase`
- OpenAI API key
- Rundown API key (for betting odds)

## 5-Step Setup

### 1. Create Supabase Project

```bash
# Go to https://supabase.com/dashboard
# Click "New Project"
# Save your Project Reference ID (e.g., "dskfsnbdgyjizoaafqfk")
```

### 2. Link & Deploy

```bash
# Login
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy database (70 migrations)
supabase db push

# Deploy edge functions (41 functions)
supabase functions deploy
```

### 3. Set Secrets

```bash
# Required secrets
supabase secrets set OPENAI_API_KEY=sk-your-key
supabase secrets set RUNDOWN_API_KEY=your-rundown-key

# Optional but recommended
supabase secrets set BALLDONTLIE_API_KEY=your-balldontlie-key
```

### 4. Configure Environment

```bash
# Copy example
cp .env.example .env

# Edit .env with your values:
# - VITE_SUPABASE_PROJECT_ID
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_PUBLISHABLE_KEY
# (Get these from: Dashboard > Settings > API)
```

### 5. Run Application

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Visit http://localhost:5173
```

## What Just Happened?

✅ **Database**: 40+ tables created with RLS policies
✅ **Functions**: 41 serverless functions deployed
✅ **Auth**: Supabase Auth configured
✅ **Cron Jobs**: Scheduled for data sync (odds, scores, stats)
✅ **Features**: Chat AI, bet tracking, portfolio management, alerts

## Get Your API Keys

| Service | Why You Need It | Get It Here |
|---------|----------------|-------------|
| **Supabase** | Backend & database | [supabase.com/dashboard](https://supabase.com/dashboard) |
| **OpenAI** | AI chat & insights | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **Rundown API** | Betting odds (required) | [therundown.io](https://therundown.io) |
| **Ball Don't Lie** | NBA stats (optional) | [balldontlie.io](https://balldontlie.io) |
| **Kalshi** | Prediction markets (optional) | [kalshi.com](https://kalshi.com) |

## First Steps in the App

1. **Sign Up**: Create your account at `/auth`
2. **Set Bankroll**: Enter your starting bankroll
3. **Configure Preferences**: Choose favorite sports, risk tolerance
4. **Place a Test Bet**: Log a bet via chat or dashboard
5. **Explore Features**: Chat AI, live scores, portfolio stats

## Common Issues

### Migration fails
```bash
supabase db push --debug
# Check error, fix migration, try again
```

### Function deployment fails
```bash
supabase functions logs FUNCTION_NAME
# Check logs for errors
```

### Can't connect to database
```bash
# Verify project ref is correct in .env
# Check Dashboard > Settings > API for correct URLs
```

### Missing secrets
```bash
supabase secrets list
# Set missing secrets with: supabase secrets set KEY=value
```

## Architecture Overview

```
Frontend (React + Vite)
    ↓
Edge Functions (TypeScript/Deno)
    ↓
PostgreSQL Database (40+ tables)
    ↓
External APIs (OpenAI, Rundown, Ball Don't Lie)
```

## What's Included

### Database Tables
- Users & profiles
- Bets & parlay tracking
- Bankroll management
- Betting odds & line movements
- Sharp money signals
- Live scores
- Kalshi markets
- Alerts & notifications
- Chat conversations
- AI insights

### Edge Functions
- **Chat**: AI betting advisor
- **Data Fetching**: Odds, scores, stats
- **Analytics**: Sharp money, arbitrage, EV
- **Bet Management**: Logging, parsing, settlement
- **Portfolio**: Bankroll tracking, hedge calculator
- **Alerts**: Smart notifications
- **Kalshi**: Prediction market integration

### Features
- 🤖 AI Chat for betting insights
- 📊 Real-time odds from 15+ sportsbooks
- 💰 Bankroll & portfolio management
- 🎯 Sharp money detection
- ⚡ Arbitrage opportunities
- 📈 Performance analytics
- 🔔 Smart alerts
- 🎲 Kelly Criterion calculator
- 📱 Mobile-responsive UI
- 🔒 Row-level security

## Next Steps

📖 **Full Documentation**: See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
🏗️ **Architecture**: See [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)
📂 **Supabase Structure**: See [supabase/README.md](./supabase/README.md)

## Local Development

```bash
# Start local Supabase (optional)
supabase start

# This runs everything locally:
# - PostgreSQL
# - Supabase Studio (GUI at http://localhost:54323)
# - Edge Functions
# - Auth

# Stop when done
supabase stop
```

## Deploy to Production

### Vercel
```bash
git push origin main
# Connect repo in Vercel dashboard
# Add environment variables
# Deploy!
```

### Netlify
```bash
# Build: npm run build
# Publish: dist/
# Add environment variables in dashboard
```

## Need Help?

- 📖 [Full Setup Guide](./SUPABASE_SETUP.md)
- 🏗️ [Supabase Docs](https://supabase.com/docs)
- 💬 [Supabase Discord](https://discord.supabase.com)
- 🐛 [Report Issues](https://github.com/yourusername/betgpt/issues)

---

**Time to complete**: ~10 minutes
**Difficulty**: Beginner-friendly
**Cost**: Free tier works for development

🎉 **You're ready to build!**
