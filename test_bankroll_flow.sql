-- Test script to verify bankroll tracking system

-- 1. Check if required columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' 
  AND column_name IN ('bankroll', 'baseline_bankroll', 'kelly_multiplier', 'unit_size')
ORDER BY column_name;

-- 2. Check if required columns exist in bets table
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'bets' 
  AND column_name IN ('profit_loss', 'actual_return', 'outcome')
ORDER BY column_name;

-- 3. Check if trigger exists
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_bet_profit_loss';

-- 4. Check if functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'get_user_bankroll_status',
  'update_bet_profit_loss',
  'settle_bet_atomic'
)
ORDER BY routine_name;
