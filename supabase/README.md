# Supabase Infrastructure

This directory contains all Infrastructure-as-Code (IaC) for the BetGPT application. Everything in here is automatically deployed to Supabase when you run `supabase db push` and `supabase functions deploy`.

## Directory Structure

```
supabase/
├── config.toml              # Project configuration
├── migrations/              # Database migrations (70 files)
│   ├── 20251020025718_*.sql
│   ├── 20251020025729_*.sql
│   ├── ...
│   └── 20251031140000_phase7_ai_insights.sql
├── functions/               # Edge Functions (41 functions)
│   ├── _shared/            # Shared utilities
│   ├── chat/               # AI chat bot
│   ├── fetch-betting-odds/ # Odds fetching
│   ├── log-bet/            # Bet logging
│   └── ...
└── seed.sql                # Optional initial data
```

## Migrations (`migrations/`)

**70 SQL migration files** that define the complete database schema. Migrations run in chronological order based on timestamps.

### Migration Categories

#### Phase 1: Core Setup (Oct 20-21)
- Initial tables: profiles, bets, conversations, messages
- Basic bankroll management
- User authentication setup

#### Phase 2: Advanced Betting (Oct 22)
- Professional betting features
- Bet settlement automation
- Atomic transaction handling
- Lineup and matchup tables
- Performance optimization

#### Phase 3: User Intelligence (Oct 31)
- User preferences and customization
- Betting pattern detection
- Conversation memory
- AI insights engine

#### Phase 4: Advanced Analytics (Oct 31)
- Expected Value (EV) analysis
- Closing Line Value (CLV) tracking
- Team ratings and predictions
- Advanced performance metrics

#### Phase 5: Live Features (Oct 31)
- Live bet tracking
- Real-time alerts system
- Smart notifications

#### Phase 6: Portfolio Management (Oct 31)
- Bankroll history tracking
- Financial goals
- Performance snapshots

#### Phase 7: AI Insights (Oct 31)
- AI-generated insights
- Betting playbooks
- Pattern recommendations

### Key Migrations

| File | Description |
|------|-------------|
| `add_initial_bankroll.sql` | Sets up bankroll tracking |
| `add_professional_betting_features.sql` | Sharp money, arbitrage, CLV |
| `atomic_bet_settlement.sql` | Transaction-safe bet settlement |
| `setup_auto_fetch_betting_odds.sql` | Cron job for odds updates |
| `add_kalshi_tables.sql` | Prediction market integration |
| `ai_betting_analytics_engine.sql` | AI insights infrastructure |
| `add_responsible_gambling_features.sql` | Loss limits, cool-offs |

### Migration Naming Convention

```
YYYYMMDDHHMMSS_description.sql
└─timestamp    └─human-readable name

Example: 20251022160000_atomic_bet_settlement.sql
         └─ 2025-10-22 16:00:00
```

### Creating New Migrations

```bash
# Generate new migration file
supabase migration new add_new_feature

# This creates: supabase/migrations/TIMESTAMP_add_new_feature.sql

# Write your SQL
ALTER TABLE bets ADD COLUMN new_field TEXT;

# Apply locally
supabase db reset

# Push to remote
supabase db push
```

## Edge Functions (`functions/`)

**41 TypeScript/Deno serverless functions** organized by purpose.

### Function Categories

#### Chat & Intelligence
```typescript
chat/                    // Main AI chat interface
tracking-chat/           // Conversational bankroll tracking
onboarding/              // User onboarding flow
```

#### Data Fetching
```typescript
fetch-balldontlie-stats/    // NBA stats (primary)
fetch-espn-stats/           // ESPN stats (fallback)
fetch-betting-odds/         // Betting lines from 15+ books
fetch-sports-scores/        // Live game scores
fetch-openai-scores/        // AI score analysis
```

#### Bet Management
```typescript
log-bet/                 // Record user bets
parse-bet/               // Natural language bet parsing
settle-bets/             // Auto-settle completed bets
settle-bet-manual/       // Manual settlement
bankroll-query/          // Bankroll status queries
```

#### Market Intelligence
```typescript
detect-sharp-money/            // Sharp vs public money
detect-arbitrage/              // Arbitrage opportunities
analyze-odds-discrepancies/    // Line discrepancies
get-game-insights/             // Game-level insights
get-team-trends/               // Team trend analysis
generate-value-insights/       // Value bet identification
```

#### Portfolio & Tools
```typescript
portfolio-management/    // Portfolio analysis
hedge-calculator/        // Hedge position calculations
parlay-optimizer/        // Parlay optimization
```

#### Alerts & Monitoring
```typescript
detect-alerts/           // Generate smart alerts
send-alerts/             // Send notifications
monitor-live-bets/       // Track active bets
auto-monitor-bets/       // Automated monitoring
manage-notifications/    // Notification preferences
```

#### Kalshi Integration
```typescript
fetch-kalshi-markets/      // Fetch Kalshi markets
analyze-kalshi-market/     // Market analysis
monitor-kalshi-alerts/     // Kalshi notifications
test-kalshi-connection/    // Health check
```

#### Data Sync (Cron Jobs)
```typescript
sync-balldontlie-daily/    // Daily NBA stats sync
sync-espn-player-stats/    // Daily ESPN sync
sync-injury-data/          // Injury report updates
```

#### Web Scraping
```typescript
scrape-lineups/            // NBA starting lineups
scrape-matchups/           // Game matchup data
```

#### Voice Features
```typescript
speech-to-text/            // Voice input
text-to-speech/            // Voice output
```

#### Utilities
```typescript
check-betting-odds-health/    // API health monitoring
calculate-team-trends/        // Team performance calculations
```

### Function Structure

Each function follows this structure:

```typescript
// supabase/functions/FUNCTION_NAME/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // Parse request
    const { param1, param2 } = await req.json();

    // Business logic
    const result = await doSomething(param1, param2);

    // Return response
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
```

### Shared Utilities (`_shared/`)

```typescript
// supabase/functions/_shared/dateUtils.ts
export const formatDate = (date: Date) => {
  // Shared utility functions
};

// Import in any function:
import { formatDate } from '../_shared/dateUtils.ts';
```

### Deploying Functions

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy chat

# Deploy with no JWT verification (for public endpoints)
supabase functions deploy chat --no-verify-jwt

# Test locally
supabase functions serve

# View logs
supabase functions logs chat --follow
```

### Function Configuration

JWT verification is configured in `config.toml`:

```toml
[functions.chat]
verify_jwt = false    # Public endpoint

[functions.log-bet]
verify_jwt = true     # Requires authentication
```

## Configuration (`config.toml`)

Project-level configuration for Supabase.

```toml
# Project ID (change this to your project)
project_id = "YOUR_PROJECT_REF"

# Function JWT verification settings
[functions.chat]
verify_jwt = false

[functions.log-bet]
verify_jwt = true

# ... more function configs
```

### Key Settings

- **project_id**: Your Supabase project reference ID
- **verify_jwt**: Whether function requires authentication
  - `false`: Public endpoint (anyone can call)
  - `true`: Authenticated only (requires valid JWT)

## Seed Data (`seed.sql`)

Optional file for populating initial data. Useful for:
- Demo accounts
- Sample bets for testing
- Default user preferences
- Reference data (sports leagues, teams, etc.)

```sql
-- supabase/seed.sql

-- Insert sample user
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'demo@example.com');

-- Insert sample preferences
INSERT INTO user_preferences (user_id, theme, favorite_sports) VALUES
  ('11111111-1111-1111-1111-111111111111', 'dark', ARRAY['NBA', 'NFL']);

-- Insert sample bets
INSERT INTO bets (user_id, amount, odds, description) VALUES
  ('11111111-1111-1111-1111-111111111111', 50, -110, 'Lakers ML');
```

Run seed data:
```bash
# Local
supabase db seed

# Remote (via migration)
# Create a new migration with seed data
```

## Database Schema

### Core Tables (Simplified Overview)

```sql
-- Users & Auth
profiles               -- User profiles with stats
user_preferences       -- User settings
user_bankroll          -- Bankroll tracking
user_goals             -- Financial goals

-- Betting
bets                   -- Individual bets
parlay_legs            -- Parlay components
betting_odds           -- Odds from sportsbooks
betting_odds_fetch_log -- API sync logs

-- Portfolio
bankroll_history       -- Daily snapshots
bankroll_transactions  -- All transactions
advanced_metrics       -- Performance analytics

-- Sports Data
sports_scores          -- Game results
live_score_cache       -- Real-time scores
line_movement_history  -- Line changes over time

-- Intelligence
betting_patterns       -- Pattern detection
sharp_money_signals    -- Sharp money tracking
odds_discrepancies     -- Arbitrage opportunities

-- Alternative Markets
kalshi_markets         -- Kalshi prediction markets
kalshi_orders          -- User Kalshi orders

-- Alerts
notifications          -- System notifications
smart_alerts           -- AI-generated alerts
user_alert_preferences -- Alert settings

-- AI
conversations          -- Chat history
messages               -- Individual messages
ai_insights            -- AI-generated insights
```

### Row-Level Security (RLS)

All tables have RLS enabled with policies like:

```sql
-- Users can only see their own data
CREATE POLICY "Users can view own bets"
  ON bets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bets"
  ON bets FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### Triggers

Automatic calculations via database triggers:

```sql
-- Auto-update profit/loss when bet settles
CREATE TRIGGER update_profile_stats
  AFTER UPDATE ON bets
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats();

-- Auto-create bankroll transaction on bet settlement
CREATE TRIGGER create_bankroll_transaction
  AFTER INSERT OR UPDATE ON bets
  FOR EACH ROW
  EXECUTE FUNCTION log_bankroll_change();
```

### Cron Jobs

Scheduled tasks via `pg_cron`:

```sql
-- Fetch odds every 30 minutes
SELECT cron.schedule(
  'auto-fetch-betting-odds',
  '*/30 * * * *',
  $$SELECT net.http_post(...)$$
);

-- Update live scores every 5 minutes
SELECT cron.schedule(
  'setup-live-scores-cron',
  '*/5 * * * *',
  $$SELECT net.http_post(...)$$
);
```

## Deployment Workflow

### Initial Setup

```bash
# 1. Create Supabase project
# Go to https://supabase.com/dashboard

# 2. Login to CLI
supabase login

# 3. Link project
supabase link --project-ref YOUR_PROJECT_REF

# 4. Push migrations
supabase db push

# 5. Deploy functions
supabase functions deploy

# 6. Set secrets
supabase secrets set OPENAI_API_KEY=sk-...
```

### Making Changes

```bash
# 1. Create new migration
supabase migration new add_new_column

# 2. Edit migration file
vim supabase/migrations/TIMESTAMP_add_new_column.sql

# 3. Test locally
supabase db reset  # Re-runs all migrations

# 4. Push to remote
supabase db push

# 5. Update functions if needed
# Edit supabase/functions/FUNCTION_NAME/index.ts

# 6. Deploy updated function
supabase functions deploy FUNCTION_NAME
```

### Syncing with Remote

```bash
# Pull remote migrations
supabase db pull

# This creates new migration files for any remote changes

# Generate TypeScript types
supabase gen types typescript --project-ref YOUR_REF > src/integrations/supabase/types.ts
```

## Local Development

```bash
# Start local Supabase stack
supabase start

# This runs:
# - PostgreSQL database
# - Supabase Studio (GUI)
# - GoTrue (Auth)
# - PostgREST (API)
# - Storage API
# - Edge Functions runtime

# View local dashboard
# Visit: http://localhost:54323

# Stop local stack
supabase stop
```

## Best Practices

### Migrations
- ✅ Always test locally first (`supabase db reset`)
- ✅ Use descriptive migration names
- ✅ Never modify existing migrations (create new ones)
- ✅ Include rollback logic when possible
- ✅ Add comments explaining complex logic

### Functions
- ✅ Keep functions small and focused (single responsibility)
- ✅ Use shared utilities for common code
- ✅ Return proper HTTP status codes
- ✅ Include error handling
- ✅ Add CORS headers for frontend calls
- ✅ Validate input parameters
- ✅ Use environment variables for secrets

### Security
- ✅ Enable RLS on all user data tables
- ✅ Test RLS policies thoroughly
- ✅ Use JWT verification for authenticated endpoints
- ✅ Never expose service_role key in frontend
- ✅ Validate user permissions in functions
- ✅ Sanitize user input

## Troubleshooting

### Migration Errors

```bash
# View detailed error
supabase db push --debug

# Check migration status
supabase db status

# Reset local database
supabase db reset
```

### Function Errors

```bash
# View logs
supabase functions logs FUNCTION_NAME --follow

# Test locally
supabase functions serve

# Check syntax
cd supabase/functions/FUNCTION_NAME
deno check index.ts
```

### Connection Issues

```bash
# Check if local stack is running
supabase status

# Restart local stack
supabase stop && supabase start

# Check remote connection
supabase projects list
```

## Resources

- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [Database Migrations Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Deno Documentation](https://deno.land/manual)

## Quick Reference

```bash
# Database
supabase db push              # Push migrations to remote
supabase db pull              # Pull remote changes
supabase db reset             # Reset local database
supabase db status            # Check migration status
supabase db diff              # Compare local vs remote

# Functions
supabase functions deploy     # Deploy all functions
supabase functions deploy X   # Deploy function X
supabase functions serve      # Serve functions locally
supabase functions logs X     # View logs for function X
supabase functions list       # List all functions

# Secrets
supabase secrets set KEY=val  # Set secret
supabase secrets list         # List secrets
supabase secrets unset KEY    # Remove secret

# Types
supabase gen types typescript --project-ref REF > types.ts

# Local Development
supabase start                # Start local stack
supabase stop                 # Stop local stack
supabase status               # Check stack status
```
