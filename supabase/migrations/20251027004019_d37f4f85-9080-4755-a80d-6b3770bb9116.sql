-- ============================================================================
-- ADDITIONAL APP FEATURES MIGRATION
-- Creates missing tables for bankroll tracking, parlays, and gambling limits
-- ============================================================================

-- 1. User Bankroll Table
CREATE TABLE IF NOT EXISTS user_bankroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starting_amount NUMERIC NOT NULL DEFAULT 1000,
  current_amount NUMERIC NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE user_bankroll ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own bankroll" 
  ON user_bankroll FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bankroll" 
  ON user_bankroll FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bankroll" 
  ON user_bankroll FOR UPDATE USING (auth.uid() = user_id);

-- 2. Bankroll Transactions Table
CREATE TABLE IF NOT EXISTS bankroll_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'bet', 'win', 'loss', 'refund')),
  amount NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  notes TEXT,
  bet_id UUID REFERENCES bets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bankroll_trans_user ON bankroll_transactions(user_id);
CREATE INDEX idx_bankroll_trans_date ON bankroll_transactions(created_at DESC);

ALTER TABLE bankroll_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" 
  ON bankroll_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" 
  ON bankroll_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Parlay Legs Table
CREATE TABLE IF NOT EXISTS parlay_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id UUID NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  selection TEXT NOT NULL,
  odds NUMERIC NOT NULL,
  result TEXT DEFAULT 'pending' CHECK (result IN ('pending', 'won', 'lost', 'push')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_parlay_legs_bet ON parlay_legs(bet_id);

ALTER TABLE parlay_legs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own parlay legs" 
  ON parlay_legs FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bets WHERE bets.id = parlay_legs.bet_id AND bets.user_id = auth.uid()
    )
  );

-- 4. Loss Limits Table
CREATE TABLE IF NOT EXISTS loss_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_limit NUMERIC,
  weekly_limit NUMERIC,
  monthly_limit NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE loss_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own loss limits" 
  ON loss_limits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own loss limits" 
  ON loss_limits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own loss limits" 
  ON loss_limits FOR UPDATE USING (auth.uid() = user_id);

-- 5. Add missing columns to bets table
ALTER TABLE bets ADD COLUMN IF NOT EXISTS sport TEXT DEFAULT 'basketball_nba';
ALTER TABLE bets ADD COLUMN IF NOT EXISTS league TEXT DEFAULT 'NBA';