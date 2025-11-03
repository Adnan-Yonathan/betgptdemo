# Supabase Setup Guide

**Yes, automatic database and edge function setup is absolutely possible!** This guide will walk you through setting up your entire Supabase infrastructure automatically using Infrastructure-as-Code (IaC).

## Table of Contents
- [Overview](#overview)
- [What Gets Set Up Automatically](#what-gets-set-up-automatically)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup Instructions](#detailed-setup-instructions)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Overview

This repository uses **Supabase CLI** to manage infrastructure as code. When you connect to a Supabase project, all database schemas, edge functions, and configurations are automatically deployed from version-controlled files.

### Infrastructure Includes:
- **70+ database migrations** defining the complete schema
- **41 edge functions** for serverless backend logic
- **Row-level security (RLS)** policies for data protection
- **Database triggers** for automated calculations
- **Scheduled cron jobs** for data sync
- **Authentication** with Supabase Auth

## What Gets Set Up Automatically

### Database Schema (70 Migrations)
```
✅ User Management
   - profiles, user_bankroll, user_preferences, user_goals

✅ Betting System
   - bets, parlay_legs, betting_odds, betting_odds_fetch_log

✅ Portfolio Management
   - bankroll_history, bankroll_transactions, advanced_metrics

✅ Sports Data
   - sports_scores, live_score_cache, line_movement_history

✅ Market Intelligence
   - sharp_money_signals, odds_discrepancies, opening_closing_lines

✅ Alternative Markets
   - kalshi_markets, kalshi_orders, kalshi_positions, kalshi_fills

✅ Alerts & Notifications
   - notifications, smart_alerts, user_alert_preferences, loss_limits

✅ AI & Analytics
   - conversations, messages, ai_insights, betting_patterns

✅ Feedback Systems
   - prediction_feedback, message_feedback, alert_feedback
```

### Edge Functions (41 Functions)
```
✅ Chat & Onboarding
   - chat, tracking-chat, onboarding

✅ Data Fetching
   - fetch-balldontlie-stats, fetch-betting-odds, fetch-sports-scores
   - fetch-espn-stats, fetch-openai-scores

✅ Bet Management
   - log-bet, parse-bet, settle-bets, settle-bet-manual

✅ Market Analysis
   - detect-sharp-money, detect-arbitrage, analyze-odds-discrepancies
   - get-game-insights, get-team-trends, generate-value-insights

✅ Portfolio Tools
   - bankroll-query, portfolio-management, hedge-calculator, parlay-optimizer

✅ Alerts & Monitoring
   - detect-alerts, send-alerts, monitor-live-bets, auto-monitor-bets

✅ Kalshi Integration
   - fetch-kalshi-markets, analyze-kalshi-market, monitor-kalshi-alerts

✅ Data Sync
   - sync-balldontlie-daily, sync-espn-player-stats, sync-injury-data

✅ Web Scraping
   - scrape-lineups, scrape-matchups

✅ Voice Features
   - speech-to-text, text-to-speech
```

## Prerequisites

1. **Supabase Account**
   - Sign up at [https://supabase.com](https://supabase.com)
   - Create a new project (or use existing)

2. **Supabase CLI**
   ```bash
   # Install via npm
   npm install -g supabase

   # Or via Homebrew (macOS)
   brew install supabase/tap/supabase

   # Verify installation
   supabase --version
   ```

3. **Node.js & npm**
   - Node.js 18+ required
   - Check: `node --version`

4. **Git** (already installed if you cloned this repo)

## Quick Start

### Option 1: New Supabase Project (Recommended)

```bash
# 1. Create a new Supabase project via dashboard
# Go to https://supabase.com/dashboard and create project

# 2. Login to Supabase CLI
supabase login

# 3. Link your local repo to the project
supabase link --project-ref YOUR_PROJECT_REF

# 4. Push all database migrations
supabase db push

# 5. Deploy all edge functions
supabase functions deploy

# 6. Set up environment variables (see below)

# 7. Done! Your database and functions are live
```

### Option 2: Local Development First

```bash
# 1. Start local Supabase
supabase start

# 2. This will automatically:
#    - Run all migrations
#    - Set up local database
#    - Start local edge functions
#    - Display connection details

# 3. When ready, link to remote
supabase link --project-ref YOUR_PROJECT_REF

# 4. Push to production
supabase db push
supabase functions deploy
```

## Detailed Setup Instructions

### Step 1: Create Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Fill in:
   - **Project Name**: BetGPT (or your choice)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Select closest to your users
4. Wait 2-3 minutes for project creation
5. Copy your **Project Reference ID** (looks like `dskfsnbdgyjizoaafqfk`)

### Step 2: Get API Keys

1. In your Supabase dashboard, go to **Settings > API**
2. Copy these values:
   - **Project URL**: `https://YOUR_PROJECT_REF.supabase.co`
   - **anon/public key**: Long JWT token starting with `eyJ...`
   - **service_role key**: Another JWT token (keep this secret!)

### Step 3: Configure Environment Variables

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your values:
   ```env
   # Supabase Configuration
   VITE_SUPABASE_PROJECT_ID="YOUR_PROJECT_REF"
   VITE_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
   VITE_SUPABASE_PUBLISHABLE_KEY="your_anon_key_here"

   # OpenAI API (Required for AI features)
   OPENAI_API_KEY="sk-..."

   # Betting Odds API (Required for odds data)
   RUNDOWN_API_KEY="your_rundown_api_key"

   # Optional: Sports Data APIs
   BALLDONTLIE_API_KEY="your_balldontlie_key"
   ESPN_API_KEY="your_espn_key"

   # Optional: Alternative Markets
   KALSHI_API_KEY="your_kalshi_key"
   KALSHI_API_SECRET="your_kalshi_secret"
   ```

### Step 4: Link to Supabase

```bash
# Login to Supabase CLI
supabase login

# Link your local repo to remote project
supabase link --project-ref YOUR_PROJECT_REF

# You'll be prompted for your database password
```

### Step 5: Push Database Migrations

```bash
# Push all 70 migrations to your Supabase project
supabase db push

# This will:
# ✅ Create all 40+ tables
# ✅ Set up RLS policies
# ✅ Create database functions
# ✅ Set up triggers
# ✅ Schedule cron jobs

# Verify migrations
supabase db status
```

### Step 6: Deploy Edge Functions

```bash
# Deploy all 41 functions at once
supabase functions deploy

# Or deploy individually
supabase functions deploy chat
supabase functions deploy fetch-betting-odds
# ... etc

# Verify deployment
supabase functions list
```

### Step 7: Set Function Secrets

Edge functions need environment variables:

```bash
# Set OpenAI API key
supabase secrets set OPENAI_API_KEY=sk-your-key-here

# Set Rundown API key (betting odds)
supabase secrets set RUNDOWN_API_KEY=your-rundown-key

# Set Ball Don't Lie API key (NBA stats)
supabase secrets set BALLDONTLIE_API_KEY=your-key

# Set Kalshi API credentials
supabase secrets set KALSHI_API_KEY=your-kalshi-key
supabase secrets set KALSHI_API_SECRET=your-kalshi-secret

# Verify secrets are set
supabase secrets list
```

### Step 8: Run the Application

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Environment Variables

### Required Variables

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `VITE_SUPABASE_PROJECT_ID` | Your Supabase project reference ID | Dashboard > Settings > General |
| `VITE_SUPABASE_URL` | Your Supabase project URL | Dashboard > Settings > API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public anon key | Dashboard > Settings > API |
| `OPENAI_API_KEY` | OpenAI API key for AI features | [platform.openai.com](https://platform.openai.com) |
| `RUNDOWN_API_KEY` | The Rundown API for betting odds | [therundown.io](https://therundown.io) |

### Optional Variables

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `BALLDONTLIE_API_KEY` | NBA stats API | [balldontlie.io](https://balldontlie.io) |
| `ESPN_API_KEY` | ESPN stats fallback | ESPN Developer Portal |
| `KALSHI_API_KEY` | Kalshi prediction markets | [kalshi.com](https://kalshi.com) |
| `KALSHI_API_SECRET` | Kalshi API secret | Kalshi Dashboard |

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Deploy to Netlify

1. Push your code to GitHub
2. Import project in Netlify
3. Add environment variables in Netlify dashboard
4. Build command: `npm run build`
5. Publish directory: `dist`

### Update Existing Deployment

```bash
# Pull latest migrations from remote
supabase db pull

# Push new migrations
supabase db push

# Deploy updated functions
supabase functions deploy

# Redeploy frontend
git push origin main  # (triggers auto-deploy on Vercel/Netlify)
```

## Database Management

### View Database Schema

```bash
# Generate TypeScript types from database
supabase gen types typescript --local > src/integrations/supabase/types.ts

# Or for remote database
supabase gen types typescript --project-ref YOUR_PROJECT_REF > src/integrations/supabase/types.ts
```

### Create New Migration

```bash
# Create a new migration file
supabase migration new add_new_feature

# Edit the file in supabase/migrations/
# Then push it
supabase db push
```

### Reset Database (Careful!)

```bash
# Reset local database
supabase db reset

# This will re-run all migrations from scratch
```

## Function Management

### View Function Logs

```bash
# Stream logs in real-time
supabase functions logs chat --follow

# View logs for all functions
supabase functions logs
```

### Test Functions Locally

```bash
# Serve functions locally
supabase functions serve

# Test with curl
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/chat' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"message":"Hello"}'
```

### Update a Function

```bash
# Edit function code in supabase/functions/FUNCTION_NAME/index.ts

# Deploy updated function
supabase functions deploy FUNCTION_NAME
```

## Troubleshooting

### Issue: Migration Fails

```bash
# Check migration status
supabase db status

# View detailed error
supabase db push --debug

# Reset and try again (local only)
supabase db reset
```

### Issue: Function Deployment Fails

```bash
# Check for syntax errors
cd supabase/functions/FUNCTION_NAME
deno check index.ts

# Deploy with verbose output
supabase functions deploy FUNCTION_NAME --debug
```

### Issue: RLS Policy Blocks Query

```bash
# Check RLS policies in Supabase Dashboard
# Go to: Database > Tables > [table_name] > RLS Policies

# Temporarily disable RLS for testing (not recommended for production)
# In SQL Editor:
# ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
```

### Issue: Missing Environment Variables

```bash
# Check what secrets are set
supabase secrets list

# Set missing secret
supabase secrets set KEY_NAME=value
```

### Issue: Database Connection Limit

```bash
# Check active connections in Supabase Dashboard
# Database > Connection Pooling

# Enable connection pooling:
# Use the "Connection pooling" URL instead of "Direct connection"
```

## Cron Jobs

The following cron jobs are automatically set up by migrations:

| Job | Schedule | Description |
|-----|----------|-------------|
| `auto-fetch-betting-odds` | Every 30 minutes | Fetch latest betting lines |
| `setup-live-scores-cron` | Every 5 minutes | Update live game scores |
| `setup-injury-sync-cron` | Every 2 hours | Sync injury reports |
| `setup-odds-discrepancy-cron` | Every 15 minutes | Detect arbitrage opportunities |
| `setup-auto-bet-settlement-cron` | Every hour | Auto-settle completed bets |
| `sync-balldontlie-daily` | Daily at 3 AM | Sync NBA stats |
| `sync-espn-player-stats` | Daily at 4 AM | Sync ESPN stats |

View cron job status in Supabase Dashboard > Database > Cron Jobs

## Security Considerations

1. **Never commit `.env` file** - It's in `.gitignore`
2. **Keep `service_role` key secret** - Only use in backend/functions
3. **Use Row Level Security (RLS)** - Already configured in migrations
4. **Rotate API keys regularly** - Update in Supabase secrets
5. **Enable 2FA on Supabase account** - For production projects

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Database Migrations](https://supabase.com/docs/guides/cli/local-development#database-migrations)

## Support

If you encounter issues:

1. Check [Supabase Status](https://status.supabase.com/)
2. Review function logs: `supabase functions logs`
3. Check database logs in Supabase Dashboard
4. Join [Supabase Discord](https://discord.supabase.com/)

## Next Steps

After setup:

1. ✅ Run the application: `npm run dev`
2. ✅ Create your first user account
3. ✅ Test the chat interface
4. ✅ Place a test bet
5. ✅ Configure alert preferences
6. ✅ Explore portfolio management

**Congratulations! Your BetGPT instance is now running with full Supabase infrastructure!** 🎉
