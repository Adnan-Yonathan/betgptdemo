# Conversational Bankroll Tracking - Testing Guide

## Overview
This guide provides step-by-step instructions to test the conversational bankroll tracking feature after implementing the critical fixes.

## What Was Fixed

### Phase 1: Atomic Bet Settlement (CRITICAL)
- **Problem**: Bet outcomes were updated but bankroll never changed
- **Fix**: Replaced direct bet UPDATE with `settle_bet_atomic()` RPC call
- **Impact**: Bankroll now updates immediately when user reports win/loss/push
- **File**: `/supabase/functions/chat/index.ts` lines 1233-1283

### Phase 2: Profit/Loss Trigger
- **Problem**: Trigger didn't fire when profit_loss was NULL
- **Fix**: Updated trigger condition to handle both NULL and 0 values
- **Impact**: profit_loss column always calculated correctly
- **File**: `/supabase/migrations/20251028234752_fix_profit_loss_trigger.sql`

### Phase 3: Bankroll Validation
- **Problem**: Users could set invalid bankroll values (negative, zero, etc.)
- **Fix**: Added comprehensive validation with helpful error messages
- **Impact**: Data integrity protected, users get clear feedback
- **File**: `/supabase/functions/chat/index.ts` lines 1116-1180

---

## Pre-Testing Checklist

Before testing, ensure:

1. **Migrations Applied**
   ```sql
   -- Check if fix migration exists
   SELECT * FROM _migrations
   WHERE name = '20251028234752_fix_profit_loss_trigger.sql';
   ```

2. **Functions Exist**
   ```sql
   -- Verify settle_bet_atomic exists
   SELECT routine_name, routine_type
   FROM information_schema.routines
   WHERE routine_name = 'settle_bet_atomic';
   ```

3. **Trigger Updated**
   ```sql
   -- Check trigger definition
   SELECT trigger_name, event_manipulation, action_statement
   FROM information_schema.triggers
   WHERE trigger_name = 'trigger_update_bet_profit_loss';
   ```

---

## Test Plan

### Test 1: Initialize Bankroll Conversationally

**Objective**: Verify users can set bankroll through conversation

#### Test Cases:

**1.1 Set valid bankroll**
- **User says**: "My bankroll is $5000"
- **Expected**:
  - AI responds: "Perfect! I've got your bankroll set at $5,000..."
  - Database check:
    ```sql
    SELECT bankroll, baseline_bankroll
    FROM profiles
    WHERE id = 'user-id';
    -- Should show: bankroll=5000.00, baseline_bankroll=5000.00
    ```

**1.2 Set bankroll with unit size**
- **User says**: "I have $2500 to bet with and my unit size is $25"
- **Expected**:
  - AI responds: "Perfect! I've got your bankroll set at $2,500.00 with unit size of $25.00..."
  - Database check:
    ```sql
    SELECT bankroll, baseline_bankroll, unit_size
    FROM profiles
    WHERE id = 'user-id';
    -- Should show: bankroll=2500.00, unit_size=25.00
    ```

**1.3 Set unit size only**
- **User says**: "My unit size is $50"
- **Expected**:
  - AI responds: "I've set your unit size to $50.00..."
  - Database check:
    ```sql
    SELECT unit_size FROM profiles WHERE id = 'user-id';
    -- Should show: unit_size=50.00
    ```

---

### Test 2: Bankroll Validation

**Objective**: Verify validation prevents invalid values

#### Test Cases:

**2.1 Bankroll too low**
- **User says**: "My bankroll is $0.50"
- **Expected**:
  - AI responds: "I noticed you tried to set a bankroll of $0.50, but the minimum is $1.00..."
  - Database: No change to bankroll

**2.2 Bankroll too high**
- **User says**: "My bankroll is $50000000"
- **Expected**:
  - AI responds: "Bankroll amount seems unusually high ($10M+)..."
  - Database: No change to bankroll

**2.3 Unit size too low**
- **User says**: "My unit size is $0.001"
- **Expected**:
  - AI responds: "Unit size must be at least $0.01..."
  - Database: No change to unit_size

**2.4 Unit size exceeds bankroll**
- **Setup**: User has $1000 bankroll
- **User says**: "My unit size is $2000"
- **Expected**:
  - AI responds: "Unit size ($2000.00) cannot be larger than your bankroll ($1000.00)..."
  - Database: No change to unit_size

**2.5 Unit size warning (>10%)**
- **Setup**: User has $1000 bankroll
- **User says**: "My unit size is $200"
- **Expected**:
  - AI responds: "⚠️ WARNING: Your unit size ($200.00) is 20.0% of your bankroll..."
  - Database: unit_size IS updated to 200.00 (warning, not error)

---

### Test 3: Bet Settlement with Bankroll Update

**Objective**: Verify bankroll updates when bets are settled

#### Setup:
1. Set bankroll: "My bankroll is $1000"
2. Log a bet: "Put $100 on Lakers -110"
3. Verify bet exists:
   ```sql
   SELECT id, description, amount, odds, outcome
   FROM bets
   WHERE user_id = 'user-id' AND outcome = 'pending'
   ORDER BY created_at DESC LIMIT 1;
   ```

#### Test Cases:

**3.1 Win settlement**
- **User says**: "My Lakers bet won"
- **Expected**:
  - AI responds: "🎉 Nice win! You profited +$90.91..."
  - Database checks:
    ```sql
    -- Check bet was settled
    SELECT outcome, actual_return, profit_loss
    FROM bets
    WHERE id = 'bet-id';
    -- Should show: outcome='win', actual_return=190.91, profit_loss=90.91

    -- Check bankroll increased
    SELECT bankroll FROM profiles WHERE id = 'user-id';
    -- Should show: bankroll=1090.91 (1000 + 90.91)
    ```

**3.2 Loss settlement**
- **Setup**: Another $100 bet at -110
- **User says**: "My Hawks bet lost"
- **Expected**:
  - AI responds: "😔 Tough loss on that one..."
  - Database checks:
    ```sql
    SELECT outcome, actual_return, profit_loss
    FROM bets
    WHERE id = 'bet-id';
    -- Should show: outcome='loss', actual_return=0, profit_loss=-100.00

    SELECT bankroll FROM profiles WHERE id = 'user-id';
    -- Should show: bankroll decreased by $100
    ```

**3.3 Push settlement**
- **Setup**: Another $100 bet at -110
- **User says**: "My Celtics bet pushed"
- **Expected**:
  - AI responds: "↔️ Your bet pushed..."
  - Database checks:
    ```sql
    SELECT outcome, actual_return, profit_loss
    FROM bets
    WHERE id = 'bet-id';
    -- Should show: outcome='push', actual_return=100.00, profit_loss=0

    SELECT bankroll FROM profiles WHERE id = 'user-id';
    -- Should show: bankroll unchanged
    ```

**3.4 Multiple pending bets (same team)**
- **Setup**: Log two Lakers bets
  - "Put $50 on Lakers -5"
  - "Put $100 on Lakers ML"
- **User says**: "My Lakers bet won"
- **Expected**:
  - AI responds: "I found 2 pending bets matching 'Lakers'. Please be more specific..."
  - Shows bet details (amount, odds, description)
  - Database: No bets settled (awaiting clarification)

**3.5 Bet not found**
- **User says**: "My Warriors bet won"
- **Expected** (if no Warriors bet exists):
  - AI responds: "I couldn't find a pending bet matching 'Warriors'..."
  - Suggests: Check if already settled, provide more details, or log the bet first

---

### Test 4: Bankroll Status Query

**Objective**: Verify users can query their performance

#### Test Cases:

**4.1 Basic status query**
- **User says**: "How am I doing?"
- **Expected**:
  - AI responds with:
    - Current balance
    - Profit/Loss ($ and %)
    - Win rate
    - ROI
    - Current streak
  - Verify data matches database:
    ```sql
    SELECT * FROM get_user_bankroll_status('user-id');
    SELECT * FROM get_betting_stats('user-id', 'all', NULL, 'settled');
    ```

**4.2 Specific time period**
- **User says**: "What's my record this week?"
- **Expected**:
  - AI responds with weekly stats
  - Filters bets from last 7 days

**4.3 Sport-specific**
- **User says**: "How am I doing on NBA bets?"
- **Expected**:
  - AI responds with NBA-only stats
  - Shows sport breakdown

---

### Test 5: End-to-End Workflow

**Objective**: Test complete realistic workflow

#### Workflow:

1. **Initialize**: "My bankroll is $2000 and my unit size is $40"
   - ✅ Confirm bankroll set to $2000, unit size $40

2. **Log Bet 1**: "Put 1 unit on Raptors -5 at -110"
   - ✅ Bet logged for $40 at -110

3. **Settle Bet 1**: "My Raptors bet won"
   - ✅ Bankroll increases by ~$36.36 (to $2036.36)
   - ✅ AI shows updated P/L percentage: +1.8%

4. **Log Bet 2**: "50 on Lakers ML +120"
   - ✅ Bet logged for $50 at +120

5. **Settle Bet 2**: "Lost my Lakers bet"
   - ✅ Bankroll decreases by $50 (to $1986.36)
   - ✅ AI shows updated P/L percentage: -0.7%

6. **Check Status**: "What's my record?"
   - ✅ AI shows: 1-1 record, -$13.64, -0.7% ROI

7. **Verify Database**:
   ```sql
   -- Check final bankroll
   SELECT bankroll, baseline_bankroll FROM profiles WHERE id = 'user-id';
   -- Should show: bankroll=1986.36, baseline_bankroll=2000.00

   -- Check all bets settled correctly
   SELECT description, outcome, amount, profit_loss
   FROM bets
   WHERE user_id = 'user-id'
   ORDER BY created_at;
   -- Should show:
   -- Raptors: win, $40, +$36.36
   -- Lakers: loss, $50, -$50.00
   ```

---

## Verification Queries

### Check Bankroll Status
```sql
SELECT * FROM get_user_bankroll_status('your-user-id');
```

Expected columns:
- `current_balance` - Current bankroll
- `available_balance` - Minus pending bets
- `starting_balance` - Baseline
- `profit_loss` - Dollar amount
- `profit_loss_pct` - Percentage
- `unit_size` - Bet sizing unit

### Check Betting Stats
```sql
SELECT * FROM get_betting_stats('your-user-id', 'all', NULL, 'settled');
```

Expected columns:
- `wins`, `losses`, `pushes`, `total_bets`
- `win_rate`, `total_wagered`, `total_returned`
- `roi`, `largest_win`, `largest_loss`
- `current_streak`, `streak_type`

### Check Recent Bets
```sql
SELECT
  id,
  description,
  amount,
  odds,
  outcome,
  actual_return,
  profit_loss,
  settled_at
FROM bets
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC
LIMIT 10;
```

### Verify Trigger Works
```sql
-- Insert test bet
INSERT INTO bets (user_id, description, amount, odds, outcome, actual_return)
VALUES ('your-user-id', 'Test Bet', 100, -110, 'win', 190.91)
RETURNING id, profit_loss;

-- Should automatically calculate profit_loss as 90.91
```

---

## Common Issues & Troubleshooting

### Issue 1: Bankroll Not Updating
**Symptom**: User reports bet win/loss but bankroll stays same

**Check**:
```sql
-- Verify settle_bet_atomic exists
SELECT * FROM pg_proc WHERE proname = 'settle_bet_atomic';

-- Check if bet was actually settled
SELECT outcome, settled_at FROM bets WHERE id = 'bet-id';
```

**Solution**:
- Ensure migration `20251028234752_fix_profit_loss_trigger.sql` is applied
- Check chat function logs for errors calling `settle_bet_atomic()`

### Issue 2: profit_loss Column is NULL
**Symptom**: Bets show NULL for profit_loss

**Check**:
```sql
-- Verify trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'trigger_update_bet_profit_loss';
```

**Solution**:
- Run migration to fix trigger
- Manually backfill:
  ```sql
  UPDATE bets
  SET profit_loss = CASE
    WHEN outcome = 'win' THEN (actual_return - amount)
    WHEN outcome = 'loss' THEN -amount
    WHEN outcome = 'push' THEN 0
    ELSE 0
  END
  WHERE outcome IN ('win', 'loss', 'push') AND profit_loss IS NULL;
  ```

### Issue 3: Validation Errors Not Showing
**Symptom**: Invalid bankroll accepted

**Check**: Verify chat function version
```bash
git log --oneline -1 supabase/functions/chat/index.ts
```

**Solution**: Ensure latest version with validation (lines 1116-1180) is deployed

---

## Success Criteria

All tests pass if:

- ✅ Users can set bankroll conversationally
- ✅ Users can set unit size conversationally
- ✅ Validation prevents invalid values with clear messages
- ✅ Bankroll updates immediately when bets are settled
- ✅ profit_loss is always calculated correctly
- ✅ Users can query their performance stats
- ✅ Multiple pending bets are handled gracefully
- ✅ Database and UI stay in sync
- ✅ All transactions are atomic (no partial updates)

---

## Performance Benchmarks

Expected response times:
- Bankroll initialization: < 500ms
- Bet settlement: < 1000ms (includes RPC call + status fetch)
- Status query: < 800ms
- Validation error: < 200ms (no database write)

---

## Next Steps After Testing

Once all tests pass:

1. **Monitor Production Logs**
   - Watch for any `settle_bet_atomic()` errors
   - Track validation error rates
   - Monitor bankroll update success rate

2. **User Feedback**
   - Collect user feedback on conversational flow
   - Identify common phrases not detected
   - Improve patterns based on real usage

3. **Phase 4-6 Enhancements** (Optional)
   - Better bet matching (by bet ID, timestamp)
   - Bankroll history tracking
   - Undo/correction feature
   - Responsible gambling limits enforcement

---

## Contact

If tests fail or you encounter issues, check:
1. Migration logs in Supabase dashboard
2. Edge function logs for chat function
3. Database trigger logs
4. This repository's issues section
