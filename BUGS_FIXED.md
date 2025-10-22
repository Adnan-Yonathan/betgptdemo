# Bugs Found and Fixed - BetGPT Demo

## Testing Session Summary
Date: October 22, 2025
Focus Areas:
- Advanced mode selection functionality
- Model accuracy and prediction features
- CRM functionality
- Betting profile functionality

## Bugs Identified and Fixed

### Bug #1: Incorrect Expected EV Calculation in BankrollStats
**Severity**: High
**Location**: `/home/user/betgptdemo/src/components/BankrollStats.tsx` (lines 54-64)

**Problem**:
The Expected EV calculation was using the market's implied probability instead of the model's win probability. This resulted in near-zero EV values even for +EV bets because the market is generally efficient.

```typescript
// INCORRECT CODE:
const impliedProb = 1 / decimalOdds; // Market's implied probability
const ev = (impliedProb * potentialProfit) - ((1 - impliedProb) * bet.amount);
```

This calculation assumes the market's probability is the true probability, which defeats the purpose of +EV betting. The Expected Value should reflect YOUR edge over the market, not the market's own expectations.

**Fix**:
Changed to use the pre-calculated `expected_value` field from the database, which is calculated using the model's probability (when available) by the `calculate_expected_value()` database function.

```typescript
// FIXED CODE:
const totalEV = bets
  .filter(bet => bet.outcome === 'pending')
  .reduce((sum, bet) => {
    // Use the pre-calculated expected_value if available (calculated with model probability)
    // Otherwise, default to 0 since we can't calculate EV without win probability
    return sum + (bet.expected_value || 0);
  }, 0);
```

**Impact**: Users will now see accurate Expected EV for their pending bets instead of values artificially deflated toward zero.

---

### Bug #2: Duplicate Bankroll Baseline Columns
**Severity**: Medium
**Location**: Database schema - `profiles` table

**Problem**:
The database had TWO columns for tracking the baseline bankroll:
1. `initial_bankroll` (created in migration `20251021225111_add_initial_bankroll.sql`)
2. `baseline_bankroll` (created in migration `20251022080610_...`)

The codebase was using `baseline_bankroll` but `initial_bankroll` still existed, causing potential confusion and data inconsistency.

**Fix**:
Created migration `20251022200000_remove_duplicate_initial_bankroll.sql` to:
1. Migrate any data from `initial_bankroll` to `baseline_bankroll` (if needed)
2. Drop the `initial_bankroll` column
3. Update documentation to clarify `baseline_bankroll` is the only baseline column

**Impact**: Cleaner database schema, no confusion about which column to use for baseline calculations.

---

### Bug #3: Advanced Mode Promises Non-Existent Backtesting Data
**Severity**: High (User Experience)
**Location**: `/home/user/betgptdemo/supabase/functions/chat/index.ts` (lines 1021-1244)

**Problem**:
The advanced mode system prompt instructed the AI to provide backtesting validation for EVERY bet:

```
CRITICAL REQUIREMENT: ALWAYS PROVIDE STATISTICAL REASONING WITH BACKTESTING
Every recommendation MUST include:
- Backtested performance of similar betting scenarios
- Historical success rate of this bet type in similar conditions
```

However, the application doesn't actually have a backtesting database with historical bet performance data. This meant the AI would either:
1. Fail to provide the required information (breaking the promise to users)
2. Make up backtesting numbers (hallucination risk)

**Fix**:
Updated the advanced mode prompt to be realistic about available data:

**Changes Made**:
1. Removed the requirement for backtesting on EVERY bet
2. Changed "MUST include backtested performance" to "should include historical context when available"
3. Updated the example format to show realistic analysis without fabricated backtesting data
4. Changed rules from "ALWAYS Backtest First" to "Include historical context when available but don't fabricate"

**Sample Before/After**:

**BEFORE:**
```
CRITICAL REQUIREMENT: ALWAYS PROVIDE STATISTICAL REASONING WITH BACKTESTING
Every recommendation MUST include:
- Backtested performance of similar betting scenarios
- Historical success rate of this bet type in similar conditions
```

**AFTER:**
```
CRITICAL REQUIREMENT: ALWAYS PROVIDE STATISTICAL REASONING
Every recommendation MUST include:
- Expected Value (EV) calculations
- Win probability estimates with confidence intervals
- Statistical analysis based on available data
- Historical context when relevant and available
```

**Impact**:
- AI will no longer be pressured to hallucinate backtesting data
- Advanced mode still provides professional-grade statistical analysis
- More honest about data availability
- Better user trust

---

## Additional Findings

### Features Verified to be Working Correctly:

1. **Advanced Mode Selection**:
   - ✅ BettingModeSelector uses proper upsert pattern to handle missing profiles
   - ✅ Mode is sent to chat endpoint and used to select appropriate prompt
   - ✅ Toast notifications inform users of mode changes

2. **Database Functions**:
   - ✅ `calculate_clv()` - Correctly calculates Closing Line Value
   - ✅ `calculate_kelly_stake()` - Correctly implements Kelly Criterion
   - ✅ `calculate_expected_value()` - Correctly calculates EV using model probability
   - ✅ `settle_bet_atomic()` - Atomically settles bets and updates bankroll

3. **CRM Sync**:
   - ✅ Automatic triggers update profile stats on bet insert/update/delete
   - ✅ `sync_user_betting_profile()` function correctly calculates all CRM metrics
   - ✅ Manual sync button works correctly

4. **Bet Settlement**:
   - ✅ Atomic settlement prevents race conditions
   - ✅ Bankroll updated correctly on win/loss/push
   - ✅ CLV calculated when closing line data is available

---

## Recommendations for Future Improvements

1. **Build Actual Backtesting Database**:
   - Add a `bet_performance_analytics` table or materialized view
   - Track historical win rates by bet type, sport, league, etc.
   - This would allow advanced mode to deliver on its promise

2. **Model Probability Tracking**:
   - Ensure the AI consistently provides model probability when making recommendations
   - This allows the `expected_value` field to be calculated for all bets

3. **Line Movement Tracking**:
   - Implement actual line movement monitoring
   - Populate the `line_movements` table with historical odds data
   - This would enable sharp money detection

4. **Testing**:
   - Add unit tests for all calculation functions
   - Add integration tests for bet settlement flow
   - Add E2E tests for mode switching

---

## Files Modified

1. `/home/user/betgptdemo/src/components/BankrollStats.tsx`
   - Fixed Expected EV calculation to use pre-calculated values

2. `/home/user/betgptdemo/supabase/migrations/20251022200000_remove_duplicate_initial_bankroll.sql`
   - Created migration to remove duplicate `initial_bankroll` column

3. `/home/user/betgptdemo/supabase/functions/chat/index.ts`
   - Updated advanced mode prompt to be realistic about data availability
   - Removed mandatory backtesting requirements
   - Clarified what data sources are actually available
