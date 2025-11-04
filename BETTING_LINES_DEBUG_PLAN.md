# Betting Lines Debug & Fix Plan

**Date**: November 1, 2025
**Issue**: All betting lines provided are incredibly wrong
**Branch**: `claude/debug-betting-lines-011CUhs7AhW6LfYQBmQ6FVQf`

---

## Investigation Summary

### System Architecture
```
Cron Job (every 30 min)
    ↓
invoke_fetch_betting_odds()
    ↓
fetch-betting-odds edge function
    ↓
The Rundown API (RapidAPI)
    ↓
betting_odds table
    ↓
Chat function fetches & formats data
    ↓
AI provides recommendations
```

### Root Causes Identified

#### 1. AI Hallucination Risk ⚠️
**Problem**: AI may provide betting lines even when no real data exists

**Evidence**:
- System prompt (chat/index.ts:2948) says "Current odds from The Rundown API"
- But AI isn't explicitly told to REFUSE recommendations if data is missing/stale
- Error handling (line 2748) sets context but AI may still guess lines

**Impact**: Users receive completely fabricated odds that don't match reality

#### 2. Insufficient Data Validation ⚠️
**Problem**: No strong guardrails prevent AI from recommending bets with bad data

**Current Flow**:
```typescript
// chat/index.ts:2748
dataContext = "ERROR: Unable to fetch live betting data..."
// But AI might still respond with guesses from training data
```

**Missing**: Hard stop that prevents betting recommendations when data is unavailable

#### 3. Stale Data Warning Insufficiency ⚠️
**Problem**: Data freshness warnings are too subtle

**Current Implementation** (chat/index.ts:1148-1151):
```typescript
Data Freshness: ${dataAgeMinutes < 5 ? 'FRESH' :
                 dataAgeMinutes < 15 ? 'RECENT' :
                 dataAgeMinutes < 30 ? 'ACCEPTABLE' :
                 'STALE - lines may have moved'}
```

**Issue**: "STALE - lines may have moved" is too weak for 2-hour old data

#### 4. No Automated Monitoring ⚠️
**Problem**: Can't detect when cron job or API integration fails

**Missing**:
- Alerts when betting_odds table hasn't updated in >1 hour
- API key validation check
- Cron job execution monitoring

#### 5. Potential API Integration Issues ⚠️
**Problem**: The Rundown API integration might have issues

**Possible causes**:
- Expired/invalid API key (`THE_ODDS_API_KEY` or `X_RAPID_APIKEY`)
- Rate limit exceeded
- API endpoint changes
- Wrong sport_id mapping
- Date parameter format issues

---

## Fix Implementation Plan

### Fix 1: Strengthen AI Guardrails (CRITICAL)

**File**: `supabase/functions/chat/index.ts`

**Changes**:

1. **Add strict data availability check** (before AI invocation):
```typescript
// After line 2750, before system prompt
const hasValidBettingData = dataContext &&
                           !dataContext.includes('ERROR') &&
                           !dataContext.includes('No betting odds') &&
                           dataAgeMinutes < 60; // Max 1 hour old

if (isAskingForBettingData && !hasValidBettingData) {
  // Return error response immediately, don't let AI guess
  return new Response(JSON.stringify({
    response: "I apologize, but I cannot provide betting recommendations at this time because I don't have access to current, accurate betting lines. The data may be unavailable or too stale (>1 hour old). Please try again in a few minutes, or contact support if this persists.",
    requiresAuth: false,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

2. **Enhance system prompt to enforce data requirement**:
```typescript
// Add to both basic and advanced mode prompts (after line 2765 and 2870)

🚨 CRITICAL DATA REQUIREMENT:
- You MUST ONLY provide betting recommendations when you have FRESH, VERIFIED odds data
- If the odds data is marked as "STALE" or is older than 1 hour, you MUST refuse to recommend specific lines
- If odds data is unavailable, say: "I cannot provide specific betting recommendations without current odds data"
- NEVER guess or estimate betting lines - only use the exact odds provided in the data context
- NEVER use odds from your training data - only use live data from The Rundown API
```

### Fix 2: Add Data Staleness Enforcement

**File**: `supabase/functions/chat/index.ts`

**Location**: Lines 1129-1200 (formatOddsData function)

**Changes**:
```typescript
function formatOddsData(odds: any[], query: string): string {
  if (!odds || odds.length === 0) {
    return "No betting odds found for this query. The game may not have lines available yet.";
  }

  const now = new Date();
  const lastUpdated = odds[0]?.last_updated ? new Date(odds[0].last_updated) : now;
  const dataAgeMinutes = Math.floor((now.getTime() - lastUpdated.getTime()) / 60000);

  // NEW: Reject data older than 2 hours
  if (dataAgeMinutes > 120) {
    return `ERROR: Betting odds data is too stale (${dataAgeMinutes} minutes old). Cannot provide reliable recommendations. Data last updated: ${lastUpdated.toLocaleString()}. Please wait for the next automated refresh or try again later.`;
  }

  let result = `LIVE BETTING ODDS DATA:\n`;
  result += `Data Retrieved: ${now.toLocaleString()}\n`;
  result += `Last Updated: ${lastUpdated.toLocaleString()} (${dataAgeMinutes} minutes ago)\n`;

  // ENHANCED: Stronger staleness warnings
  if (dataAgeMinutes > 60) {
    result += `⚠️ DATA QUALITY: STALE (>1 hour old) - Lines may have significantly moved. Use with extreme caution.\n\n`;
  } else if (dataAgeMinutes > 30) {
    result += `⚠️ DATA QUALITY: MODERATELY STALE (>30 min old) - Lines may have moved.\n\n`;
  } else if (dataAgeMinutes > 15) {
    result += `Data Freshness: RECENT\n\n`;
  } else {
    result += `Data Freshness: FRESH ✅\n\n`;
  }

  // ... rest of function unchanged
```

### Fix 3: Add Betting Odds Health Check Endpoint

**New File**: `supabase/functions/check-betting-odds-health/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Check for recent odds data
    const { data: recentOdds, error } = await supabaseClient
      .from('betting_odds')
      .select('sport_key, last_updated')
      .gte('last_updated', oneHourAgo.toISOString())
      .order('last_updated', { ascending: false })
      .limit(1);

    const hasRecentData = recentOdds && recentOdds.length > 0;
    const dataAge = hasRecentData
      ? Math.floor((now.getTime() - new Date(recentOdds[0].last_updated).getTime()) / 60000)
      : null;

    // Check cron job status
    const { data: cronStatus } = await supabaseClient
      .from('betting_odds_fetch_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    const lastFetchAge = cronStatus && cronStatus.length > 0
      ? Math.floor((now.getTime() - new Date(cronStatus[0].created_at).getTime()) / 60000)
      : null;

    const health = {
      status: hasRecentData && dataAge < 60 ? 'healthy' : 'degraded',
      hasRecentData,
      dataAgeMinutes: dataAge,
      lastFetchAgeMinutes: lastFetchAge,
      lastFetchSuccess: cronStatus?.[0]?.success ?? null,
      warnings: [],
      errors: []
    };

    if (!hasRecentData) {
      health.errors.push('No betting odds data in database from the last hour');
    } else if (dataAge > 60) {
      health.warnings.push(`Betting odds data is stale (${dataAge} minutes old)`);
    }

    if (lastFetchAge === null || lastFetchAge > 45) {
      health.warnings.push('Cron job may not be running (no fetch in last 45 minutes)');
    }

    if (cronStatus?.[0]?.success === false) {
      health.errors.push('Last automated fetch failed');
    }

    return new Response(JSON.stringify(health, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
      status: 'error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

### Fix 4: Add API Key Validation

**File**: `supabase/functions/fetch-betting-odds/index.ts`

**Location**: After line 114

```typescript
if (!rundownApiKey) {
  console.error('No betting odds API key configured (THE_ODDS_API_KEY or X_RAPID_APIKEY/THE_RUNDOWN_API)');

  // NEW: Log this error to betting_odds_fetch_log for monitoring
  await supabaseClient
    .from('betting_odds_fetch_log')
    .insert({
      sports_fetched: [sport],
      success: false,
      events_count: 0,
      odds_count: 0,
      error_message: 'No betting odds API key configured (THE_ODDS_API_KEY or X_RAPID_APIKEY/THE_RUNDOWN_API)',
    });

  return new Response(JSON.stringify({
    error: 'No betting odds API key configured (THE_ODDS_API_KEY or X_RAPID_APIKEY/THE_RUNDOWN_API)',
    success: false,
    message: 'Please configure THE_ODDS_API_KEY (primary) or X_RAPID_APIKEY/THE_RUNDOWN_API (fallback) in backend secrets',
  }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

### Fix 5: Enhanced Error Logging

**File**: `supabase/functions/fetch-betting-odds/index.ts`

**Location**: Line 144-155 (API error handling)

```typescript
if (!response.ok) {
  const errorText = await response.text();
  console.error(`The Rundown API error: ${response.status} - ${errorText}`);

  // NEW: Log API errors for monitoring
  await supabaseClient
    .from('betting_odds_fetch_log')
    .insert({
      sports_fetched: [sport],
      success: false,
      events_count: 0,
      odds_count: 0,
      error_message: `The Rundown API returned ${response.status}: ${errorText}`,
    });

  return new Response(JSON.stringify({
    error: `The Rundown API returned ${response.status}`,
    details: errorText,
    success: false,
  }), {
    status: response.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

### Fix 6: Add Migration for Error Logging Column

**New File**: `supabase/migrations/20251101_add_error_logging.sql`

```sql
-- Add error_message column to betting_odds_fetch_log for better debugging

ALTER TABLE betting_odds_fetch_log
ADD COLUMN IF NOT EXISTS error_message TEXT;

COMMENT ON COLUMN betting_odds_fetch_log.error_message IS
  'Error message when fetch fails, null when successful';

-- Create index for quick error lookup
CREATE INDEX IF NOT EXISTS idx_betting_odds_fetch_log_errors
ON betting_odds_fetch_log(success, created_at DESC)
WHERE success = false;
```

---

## Testing Plan

### 1. Manual API Test
```bash
# Test The Rundown API integration directly
curl -X POST https://dskfsnbdgyjizoaafqfk.supabase.co/functions/v1/fetch-betting-odds \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"sport": "americanfootball_nfl"}'
```

### 2. Health Check Test
```bash
# Check system health
curl https://dskfsnbdgyjizoaafqfk.supabase.co/functions/v1/check-betting-odds-health
```

### 3. Chat Integration Test
- Ask for betting lines in chat
- Verify AI refuses if data is stale/missing
- Verify AI provides lines only with fresh data

### 4. Cron Job Verification
```sql
-- Check if cron job is scheduled
SELECT * FROM cron.job WHERE jobname = 'auto-fetch-betting-odds-job';

-- Check recent fetch logs
SELECT * FROM betting_odds_fetch_log
ORDER BY created_at DESC
LIMIT 10;
```

---

## Success Criteria

✅ AI refuses to provide betting lines when data is >1 hour old
✅ AI only uses exact odds from database, never guesses
✅ Clear error messages when betting data is unavailable
✅ Health check endpoint shows system status
✅ Errors are logged to betting_odds_fetch_log
✅ Cron job runs successfully every 30 minutes
✅ Betting lines match The Rundown API exactly

---

## Rollback Plan

If issues arise:
1. Revert chat/index.ts changes
2. Keep health check endpoint (non-breaking)
3. Keep enhanced logging (helpful for debugging)
4. Investigate API integration separately

---

## Timeline

- Investigation: ✅ Complete
- Fix Implementation: ~2 hours
- Testing: ~1 hour
- Deployment: ~30 minutes
- Monitoring: Ongoing

**Total Estimated Time**: 3-4 hours
