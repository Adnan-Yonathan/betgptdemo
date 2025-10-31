-- Phase 5: Live Bet Tracking & In-Game Alerts
-- Part 2: Intelligent Alerts System
-- Generates and manages real-time alerts for critical moments during games

CREATE TABLE IF NOT EXISTS public.bet_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bet_id UUID NOT NULL REFERENCES public.bets(id) ON DELETE CASCADE,
  tracking_id UUID REFERENCES public.live_bet_tracking(id) ON DELETE CASCADE,

  -- Alert details
  alert_type TEXT NOT NULL, -- See alert types below
  alert_title TEXT NOT NULL,
  alert_message TEXT NOT NULL,
  priority INTEGER DEFAULT 0, -- 0=low, 1=medium, 2=high, 3=urgent

  -- Context data
  game_id TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  current_score TEXT, -- '98-95'
  time_remaining TEXT, -- '2:34 Q4'

  -- Alert-specific data
  alert_data JSONB DEFAULT '{}'::jsonb, -- Additional context (win_prob, hedge_odds, etc.)

  -- Status
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  is_sent BOOLEAN DEFAULT false, -- For push notifications
  sent_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours'),

  -- Prevent duplicate alerts
  CONSTRAINT unique_alert_per_bet_type UNIQUE (bet_id, alert_type, created_at)
);

-- Enable RLS
ALTER TABLE public.bet_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own alerts"
ON public.bet_alerts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own alerts"
ON public.bet_alerts
FOR UPDATE
USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_bet_alerts_user_id ON public.bet_alerts(user_id);
CREATE INDEX idx_bet_alerts_bet_id ON public.bet_alerts(bet_id);
CREATE INDEX idx_bet_alerts_unread ON public.bet_alerts(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_bet_alerts_created_at ON public.bet_alerts(created_at DESC);

-- Table for user alert settings
CREATE TABLE IF NOT EXISTS public.user_alert_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Master toggle
  alerts_enabled BOOLEAN DEFAULT true,

  -- Alert type toggles (all default to true)
  alert_game_starting BOOLEAN DEFAULT true,
  alert_close_finish BOOLEAN DEFAULT true,
  alert_momentum_shift BOOLEAN DEFAULT true,
  alert_critical_moment BOOLEAN DEFAULT true,
  alert_hedge_opportunity BOOLEAN DEFAULT true,
  alert_win_prob_change BOOLEAN DEFAULT true,
  alert_line_movement BOOLEAN DEFAULT true,
  alert_injury_update BOOLEAN DEFAULT true,

  -- Thresholds
  win_prob_change_threshold NUMERIC DEFAULT 0.15, -- Alert if win prob changes by 15%+
  momentum_points_threshold INTEGER DEFAULT 8, -- Alert on 8-0 run or bigger
  hedge_profit_threshold NUMERIC DEFAULT 0.10, -- Alert if hedge guarantees 10%+ profit
  close_finish_minutes INTEGER DEFAULT 5, -- Alert in final 5 minutes if close

  -- Notification preferences
  notify_via_app BOOLEAN DEFAULT true,
  notify_via_email BOOLEAN DEFAULT false,
  notify_via_sms BOOLEAN DEFAULT false,

  -- Quiet hours (don't send notifications)
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME, -- '23:00:00'
  quiet_hours_end TIME, -- '08:00:00'

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_alert_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own alert settings"
ON public.user_alert_settings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own alert settings"
ON public.user_alert_settings
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alert settings"
ON public.user_alert_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index
CREATE INDEX idx_user_alert_settings_user_id ON public.user_alert_settings(user_id);

-- Function to initialize default alert settings
CREATE OR REPLACE FUNCTION public.initialize_user_alert_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_alert_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create settings when user signs up
CREATE TRIGGER create_user_alert_settings_on_signup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.initialize_user_alert_settings();

/*
  Alert Types:

  1. game_starting - Game is about to start (10 min warning)
  2. close_finish - Game is close in final minutes
  3. momentum_shift - Team goes on significant scoring run
  4. critical_moment - Crucial point in game (under 2 min, close score)
  5. hedge_opportunity - Live odds allow profitable hedge
  6. win_prob_change - Win probability changed significantly
  7. line_movement - Live line moved significantly from bet placement
  8. injury_update - Key player injured during game
*/

-- Function to check if alert should be sent (respects user settings)
CREATE OR REPLACE FUNCTION public.should_send_alert(
  p_user_id UUID,
  p_alert_type TEXT,
  p_win_prob_change NUMERIC DEFAULT NULL,
  p_momentum_points INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_settings RECORD;
  v_current_time TIME;
BEGIN
  -- Get user settings
  SELECT * INTO v_settings
  FROM public.user_alert_settings
  WHERE user_id = p_user_id;

  -- If no settings found, default to true
  IF NOT FOUND THEN
    RETURN true;
  END IF;

  -- Check master toggle
  IF NOT v_settings.alerts_enabled THEN
    RETURN false;
  END IF;

  -- Check quiet hours
  IF v_settings.quiet_hours_enabled THEN
    v_current_time := CURRENT_TIME;

    -- Handle overnight quiet hours (e.g., 23:00 - 08:00)
    IF v_settings.quiet_hours_start > v_settings.quiet_hours_end THEN
      IF v_current_time >= v_settings.quiet_hours_start OR v_current_time <= v_settings.quiet_hours_end THEN
        RETURN false;
      END IF;
    -- Handle same-day quiet hours (e.g., 14:00 - 17:00)
    ELSIF v_current_time BETWEEN v_settings.quiet_hours_start AND v_settings.quiet_hours_end THEN
      RETURN false;
    END IF;
  END IF;

  -- Check alert type specific settings
  CASE p_alert_type
    WHEN 'game_starting' THEN
      IF NOT v_settings.alert_game_starting THEN RETURN false; END IF;
    WHEN 'close_finish' THEN
      IF NOT v_settings.alert_close_finish THEN RETURN false; END IF;
    WHEN 'momentum_shift' THEN
      IF NOT v_settings.alert_momentum_shift THEN RETURN false; END IF;
      IF p_momentum_points IS NOT NULL AND p_momentum_points < v_settings.momentum_points_threshold THEN
        RETURN false;
      END IF;
    WHEN 'critical_moment' THEN
      IF NOT v_settings.alert_critical_moment THEN RETURN false; END IF;
    WHEN 'hedge_opportunity' THEN
      IF NOT v_settings.alert_hedge_opportunity THEN RETURN false; END IF;
    WHEN 'win_prob_change' THEN
      IF NOT v_settings.alert_win_prob_change THEN RETURN false; END IF;
      IF p_win_prob_change IS NOT NULL AND ABS(p_win_prob_change) < v_settings.win_prob_change_threshold THEN
        RETURN false;
      END IF;
    WHEN 'line_movement' THEN
      IF NOT v_settings.alert_line_movement THEN RETURN false; END IF;
    WHEN 'injury_update' THEN
      IF NOT v_settings.alert_injury_update THEN RETURN false; END IF;
    ELSE
      RETURN true; -- Unknown alert type, allow by default
  END CASE;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create an alert
CREATE OR REPLACE FUNCTION public.create_bet_alert(
  p_user_id UUID,
  p_bet_id UUID,
  p_tracking_id UUID,
  p_alert_type TEXT,
  p_alert_title TEXT,
  p_alert_message TEXT,
  p_priority INTEGER DEFAULT 0,
  p_alert_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_alert_id UUID;
  v_tracking RECORD;
  v_should_send BOOLEAN;
  v_win_prob_change NUMERIC;
  v_momentum_points INTEGER;
BEGIN
  -- Get tracking data for context
  SELECT * INTO v_tracking
  FROM public.live_bet_tracking
  WHERE id = p_tracking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tracking record not found: %', p_tracking_id;
  END IF;

  -- Extract context for settings check
  v_win_prob_change := COALESCE((p_alert_data->>'win_prob_change')::numeric, NULL);
  v_momentum_points := COALESCE((p_alert_data->>'momentum_points')::integer, NULL);

  -- Check if alert should be sent
  v_should_send := should_send_alert(
    p_user_id,
    p_alert_type,
    v_win_prob_change,
    v_momentum_points
  );

  IF NOT v_should_send THEN
    RETURN NULL; -- Alert suppressed by user settings
  END IF;

  -- Create alert
  INSERT INTO public.bet_alerts (
    user_id,
    bet_id,
    tracking_id,
    alert_type,
    alert_title,
    alert_message,
    priority,
    game_id,
    home_team,
    away_team,
    current_score,
    time_remaining,
    alert_data
  ) VALUES (
    p_user_id,
    p_bet_id,
    p_tracking_id,
    p_alert_type,
    p_alert_title,
    p_alert_message,
    p_priority,
    v_tracking.game_id,
    v_tracking.home_team,
    v_tracking.away_team,
    v_tracking.current_home_score || '-' || v_tracking.current_away_score,
    v_tracking.time_remaining,
    p_alert_data
  )
  ON CONFLICT (bet_id, alert_type, created_at) DO NOTHING
  RETURNING id INTO v_alert_id;

  -- Update tracking to record alert sent
  IF v_alert_id IS NOT NULL THEN
    UPDATE public.live_bet_tracking
    SET
      alerts_sent = alerts_sent || jsonb_build_array(p_alert_type),
      last_alert_sent_at = now()
    WHERE id = p_tracking_id;
  END IF;

  RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for close finish alert condition
CREATE OR REPLACE FUNCTION public.check_close_finish_alert(p_tracking_id UUID)
RETURNS UUID AS $$
DECLARE
  v_tracking RECORD;
  v_alert_id UUID;
  v_point_diff INTEGER;
  v_minutes_remaining INTEGER;
BEGIN
  SELECT * INTO v_tracking
  FROM public.live_bet_tracking
  WHERE id = p_tracking_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Check if already sent this alert
  IF v_tracking.alerts_sent ? 'close_finish' THEN
    RETURN NULL;
  END IF;

  -- Check if game is in final period (Q4, OT)
  IF v_tracking.current_period NOT IN ('Q4', 'OT', 'OT2', '4th', 'Final') THEN
    RETURN NULL;
  END IF;

  -- Calculate point differential
  v_point_diff := ABS(v_tracking.current_home_score - v_tracking.current_away_score);

  -- Parse time remaining (assumes format like '2:34' or 'End of Period')
  IF v_tracking.time_remaining ~ '^\d+:\d+$' THEN
    v_minutes_remaining := SPLIT_PART(v_tracking.time_remaining, ':', 1)::integer;
  ELSE
    v_minutes_remaining := 0;
  END IF;

  -- Alert if close game (within 6 points) in final 5 minutes
  IF v_point_diff <= 6 AND v_minutes_remaining <= 5 AND v_minutes_remaining > 0 THEN
    v_alert_id := create_bet_alert(
      v_tracking.user_id,
      v_tracking.bet_id,
      p_tracking_id,
      'close_finish',
      'Close Finish! 🔥',
      format('Your %s bet on %s is in a close game! %s-%s with %s remaining.',
        v_tracking.bet_type,
        CASE WHEN v_tracking.bet_side = 'home' THEN v_tracking.home_team ELSE v_tracking.away_team END,
        v_tracking.current_home_score,
        v_tracking.current_away_score,
        v_tracking.time_remaining
      ),
      2, -- High priority
      jsonb_build_object(
        'point_diff', v_point_diff,
        'bet_status', v_tracking.bet_status
      )
    );
  END IF;

  RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for momentum shift alert
CREATE OR REPLACE FUNCTION public.check_momentum_shift_alert(p_tracking_id UUID)
RETURNS UUID AS $$
DECLARE
  v_tracking RECORD;
  v_alert_id UUID;
  v_momentum_diff INTEGER;
  v_momentum_team TEXT;
  v_message TEXT;
BEGIN
  SELECT * INTO v_tracking
  FROM public.live_bet_tracking
  WHERE id = p_tracking_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Calculate momentum differential
  v_momentum_diff := ABS(v_tracking.last_5min_home_points - v_tracking.last_5min_away_points);

  -- Determine which team has momentum
  IF v_tracking.last_5min_home_points > v_tracking.last_5min_away_points THEN
    v_momentum_team := 'home';
  ELSIF v_tracking.last_5min_away_points > v_tracking.last_5min_home_points THEN
    v_momentum_team := 'away';
  ELSE
    RETURN NULL; -- No clear momentum
  END IF;

  -- Alert if significant scoring run (8+ point differential in last 5 min)
  IF v_momentum_diff >= 8 THEN
    -- Check if bet is affected by momentum shift
    DECLARE
      v_is_bad_momentum BOOLEAN;
    BEGIN
      v_is_bad_momentum := (v_tracking.bet_side = 'home' AND v_momentum_team = 'away')
                        OR (v_tracking.bet_side = 'away' AND v_momentum_team = 'home');

      IF v_is_bad_momentum THEN
        v_message := format('Momentum Shift Alert! %s on a %s-%s run in last 5 min. Your %s bet is now %s.',
          CASE WHEN v_momentum_team = 'home' THEN v_tracking.home_team ELSE v_tracking.away_team END,
          GREATEST(v_tracking.last_5min_home_points, v_tracking.last_5min_away_points),
          LEAST(v_tracking.last_5min_home_points, v_tracking.last_5min_away_points),
          v_tracking.bet_type,
          v_tracking.bet_status
        );

        v_alert_id := create_bet_alert(
          v_tracking.user_id,
          v_tracking.bet_id,
          p_tracking_id,
          'momentum_shift',
          'Momentum Shift! ⚠️',
          v_message,
          2, -- High priority
          jsonb_build_object(
            'momentum_team', v_momentum_team,
            'momentum_diff', v_momentum_diff,
            'bet_status', v_tracking.bet_status
          )
        );
      END IF;
    END;
  END IF;

  RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for win probability change alert
CREATE OR REPLACE FUNCTION public.check_win_prob_change_alert(p_tracking_id UUID)
RETURNS UUID AS $$
DECLARE
  v_tracking RECORD;
  v_alert_id UUID;
  v_prob_change NUMERIC;
  v_message TEXT;
BEGIN
  SELECT * INTO v_tracking
  FROM public.live_bet_tracking
  WHERE id = p_tracking_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Check if win prob data exists
  IF v_tracking.win_prob_change IS NULL OR v_tracking.pre_game_win_prob IS NULL THEN
    RETURN NULL;
  END IF;

  v_prob_change := v_tracking.win_prob_change;

  -- Alert if significant change (15%+)
  IF ABS(v_prob_change) >= 0.15 THEN
    IF v_prob_change > 0 THEN
      v_message := format('Win probability increased by %s%% for your %s bet! Now at %s%% (was %s%%).',
        ROUND(v_prob_change * 100, 1),
        v_tracking.bet_type,
        ROUND(v_tracking.current_win_prob * 100, 1),
        ROUND(v_tracking.pre_game_win_prob * 100, 1)
      );
    ELSE
      v_message := format('Win probability decreased by %s%% for your %s bet. Now at %s%% (was %s%%).',
        ROUND(ABS(v_prob_change) * 100, 1),
        v_tracking.bet_type,
        ROUND(v_tracking.current_win_prob * 100, 1),
        ROUND(v_tracking.pre_game_win_prob * 100, 1)
      );
    END IF;

    v_alert_id := create_bet_alert(
      v_tracking.user_id,
      v_tracking.bet_id,
      p_tracking_id,
      'win_prob_change',
      CASE WHEN v_prob_change > 0 THEN 'Win Probability Up! 📈' ELSE 'Win Probability Down 📉' END,
      v_message,
      1, -- Medium priority
      jsonb_build_object(
        'win_prob_change', v_prob_change,
        'current_win_prob', v_tracking.current_win_prob,
        'pre_game_win_prob', v_tracking.pre_game_win_prob
      )
    );
  END IF;

  RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check all alert conditions for a bet
CREATE OR REPLACE FUNCTION public.check_all_alerts_for_bet(p_tracking_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_alerts_created JSONB := '[]'::jsonb;
  v_alert_id UUID;
BEGIN
  -- Check close finish
  v_alert_id := check_close_finish_alert(p_tracking_id);
  IF v_alert_id IS NOT NULL THEN
    v_alerts_created := v_alerts_created || jsonb_build_object('close_finish', v_alert_id);
  END IF;

  -- Check momentum shift
  v_alert_id := check_momentum_shift_alert(p_tracking_id);
  IF v_alert_id IS NOT NULL THEN
    v_alerts_created := v_alerts_created || jsonb_build_object('momentum_shift', v_alert_id);
  END IF;

  -- Check win prob change
  v_alert_id := check_win_prob_change_alert(p_tracking_id);
  IF v_alert_id IS NOT NULL THEN
    v_alerts_created := v_alerts_created || jsonb_build_object('win_prob_change', v_alert_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'tracking_id', p_tracking_id,
    'alerts_created', v_alerts_created
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread alerts for a user
CREATE OR REPLACE FUNCTION public.get_user_unread_alerts(p_user_id UUID)
RETURNS TABLE (
  alert_id UUID,
  alert_type TEXT,
  alert_title TEXT,
  alert_message TEXT,
  priority INTEGER,
  game_id TEXT,
  home_team TEXT,
  away_team TEXT,
  current_score TEXT,
  time_remaining TEXT,
  alert_data JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.alert_type,
    a.alert_title,
    a.alert_message,
    a.priority,
    a.game_id,
    a.home_team,
    a.away_team,
    a.current_score,
    a.time_remaining,
    a.alert_data,
    a.created_at
  FROM public.bet_alerts a
  WHERE a.user_id = p_user_id
    AND a.is_read = false
    AND a.is_dismissed = false
    AND a.expires_at > now()
  ORDER BY a.priority DESC, a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark alert as read
CREATE OR REPLACE FUNCTION public.mark_alert_as_read(p_alert_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.bet_alerts
  SET is_read = true
  WHERE id = p_alert_id AND user_id = p_user_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, UPDATE ON public.bet_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_alert_settings TO authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_user_alert_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.should_send_alert(UUID, TEXT, NUMERIC, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_bet_alert(UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_close_finish_alert(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_momentum_shift_alert(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_win_prob_change_alert(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_all_alerts_for_bet(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_unread_alerts(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_alert_as_read(UUID, UUID) TO authenticated;

-- Add comments
COMMENT ON TABLE public.bet_alerts IS
'Stores real-time alerts for users about critical moments during games affecting their bets.';

COMMENT ON TABLE public.user_alert_settings IS
'User preferences for alert notifications. Controls which alerts to receive and when.';

COMMENT ON FUNCTION public.check_all_alerts_for_bet(UUID) IS
'Checks all alert conditions for a tracked bet and creates alerts as needed. Called by background job.';

-- Initialize alert settings for existing users
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users
  LOOP
    INSERT INTO public.user_alert_settings (user_id)
    VALUES (user_record.id)
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;
END $$;

-- Log installation
DO $$
BEGIN
  RAISE NOTICE '============================================================='
  RAISE NOTICE 'Phase 5 Part 2: Alerts System Created Successfully';
  RAISE NOTICE '=============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - 8 alert types (game starting, close finish, momentum, etc.)';
  RAISE NOTICE '  - User-customizable alert settings';
  RAISE NOTICE '  - Quiet hours support';
  RAISE NOTICE '  - Priority-based alerts';
  RAISE NOTICE '  - Alert threshold configuration';
  RAISE NOTICE '';
  RAISE NOTICE 'Alert Types:';
  RAISE NOTICE '  1. game_starting - 10 min before game';
  RAISE NOTICE '  2. close_finish - Close game in final minutes';
  RAISE NOTICE '  3. momentum_shift - Significant scoring run';
  RAISE NOTICE '  4. critical_moment - Crucial point (< 2 min, close)';
  RAISE NOTICE '  5. hedge_opportunity - Profitable hedge available';
  RAISE NOTICE '  6. win_prob_change - Win prob changed 15%+';
  RAISE NOTICE '  7. line_movement - Live line moved significantly';
  RAISE NOTICE '  8. injury_update - Key player injured';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage:';
  RAISE NOTICE '  -- Check alerts for a bet:';
  RAISE NOTICE '  SELECT check_all_alerts_for_bet(tracking_id);';
  RAISE NOTICE '';
  RAISE NOTICE '  -- Get unread alerts:';
  RAISE NOTICE '  SELECT * FROM get_user_unread_alerts(user_id);';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================';
END $$;
