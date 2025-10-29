-- Align feedback tables with frontend components and analytics function usage

-- ALERT FEEDBACK
ALTER TABLE public.alert_feedback
  ADD COLUMN IF NOT EXISTS notification_id text,
  ADD COLUMN IF NOT EXISTS alert_type text,
  ADD COLUMN IF NOT EXISTS priority_level text,
  ADD COLUMN IF NOT EXISTS user_action text,
  ADD COLUMN IF NOT EXISTS was_timely boolean,
  ADD COLUMN IF NOT EXISTS was_accurate boolean,
  ADD COLUMN IF NOT EXISTS led_to_bet boolean,
  ADD COLUMN IF NOT EXISTS false_positive boolean,
  ADD COLUMN IF NOT EXISTS relevance_rating numeric,
  ADD COLUMN IF NOT EXISTS time_to_action_seconds integer;

-- Helpful index for lookups by user and notification
CREATE INDEX IF NOT EXISTS idx_alert_feedback_user_notification
  ON public.alert_feedback (user_id, notification_id);

-- MESSAGE FEEDBACK
ALTER TABLE public.message_feedback
  ADD COLUMN IF NOT EXISTS is_helpful boolean,
  ADD COLUMN IF NOT EXISTS response_type text,
  ADD COLUMN IF NOT EXISTS message_content_preview text,
  ADD COLUMN IF NOT EXISTS rating numeric;

-- Helpful index for user/message lookups
CREATE INDEX IF NOT EXISTS idx_message_feedback_user_message
  ON public.message_feedback (user_id, message_id);

-- PREDICTION FEEDBACK
ALTER TABLE public.prediction_feedback
  ADD COLUMN IF NOT EXISTS was_accurate boolean,
  ADD COLUMN IF NOT EXISTS user_action text,
  ADD COLUMN IF NOT EXISTS confidence_rating numeric,
  ADD COLUMN IF NOT EXISTS value_rating numeric,
  ADD COLUMN IF NOT EXISTS user_profit_loss numeric,
  ADD COLUMN IF NOT EXISTS sport text;

-- Helpful index for user/prediction lookups
CREATE INDEX IF NOT EXISTS idx_prediction_feedback_user_prediction
  ON public.prediction_feedback (user_id, prediction_id);
