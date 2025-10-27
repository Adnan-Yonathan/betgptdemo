-- User Feedback System Migration
-- This migration adds comprehensive feedback collection tables to enable explicit user feedback
-- on AI responses, predictions, alerts, and overall features for continuous improvement

-- =============================================
-- MESSAGE FEEDBACK TABLE
-- Tracks user feedback on individual chat messages
-- =============================================
CREATE TABLE IF NOT EXISTS public.message_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_id UUID NOT NULL,  -- Reference to messages table
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,

    -- Feedback type and rating
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('thumbs_up', 'thumbs_down', 'rating')),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),  -- Optional 1-5 star rating
    is_helpful BOOLEAN,  -- Quick helpful/not helpful flag

    -- Detailed feedback
    feedback_category TEXT CHECK (feedback_category IN ('accuracy', 'relevance', 'clarity', 'completeness', 'tone', 'other')),
    feedback_text TEXT,  -- Optional detailed feedback

    -- Context
    response_type TEXT CHECK (response_type IN ('betting_advice', 'prediction', 'analysis', 'general', 'bankroll_management', 'strategy')),
    message_content_preview TEXT,  -- First 200 chars of the message for reference

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Prevent duplicate feedback on same message
    UNIQUE(user_id, message_id)
);

-- Indexes for message feedback
CREATE INDEX idx_message_feedback_user ON public.message_feedback(user_id);
CREATE INDEX idx_message_feedback_message ON public.message_feedback(message_id);
CREATE INDEX idx_message_feedback_conversation ON public.message_feedback(conversation_id);
CREATE INDEX idx_message_feedback_type ON public.message_feedback(feedback_type);
CREATE INDEX idx_message_feedback_created ON public.message_feedback(created_at DESC);
CREATE INDEX idx_message_feedback_helpful ON public.message_feedback(is_helpful) WHERE is_helpful IS NOT NULL;

-- Enable RLS on message feedback
ALTER TABLE public.message_feedback ENABLE ROW LEVEL SECURITY;

-- RLS policies for message feedback
CREATE POLICY "Users can view their own message feedback"
    ON public.message_feedback FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own message feedback"
    ON public.message_feedback FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own message feedback"
    ON public.message_feedback FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own message feedback"
    ON public.message_feedback FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================
-- PREDICTION FEEDBACK TABLE
-- Tracks user feedback on betting predictions
-- =============================================
CREATE TABLE IF NOT EXISTS public.prediction_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    prediction_id UUID REFERENCES public.model_predictions(id) ON DELETE CASCADE,
    bet_id UUID REFERENCES public.bets(id) ON DELETE CASCADE,  -- If user placed the bet

    -- Prediction details (denormalized for analytics)
    game_id TEXT,
    sport TEXT,
    prediction_type TEXT,  -- spread, moneyline, total, props

    -- Feedback metrics
    was_helpful BOOLEAN,
    was_accurate BOOLEAN,  -- Did prediction match outcome?
    confidence_rating INTEGER CHECK (confidence_rating >= 1 AND confidence_rating <= 5),  -- User's confidence in following prediction
    value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 5),  -- How valuable was this prediction?

    -- Action taken
    user_action TEXT CHECK (user_action IN ('placed_bet', 'skipped', 'saved_for_later', 'shared', 'ignored')),
    bet_amount DECIMAL(10, 2),  -- If they placed a bet

    -- Outcome tracking
    prediction_result TEXT CHECK (prediction_result IN ('correct', 'incorrect', 'pending', 'push')),
    user_profit_loss DECIMAL(10, 2),  -- Actual P/L if bet was placed

    -- Detailed feedback
    feedback_text TEXT,
    improvement_suggestions TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Prevent duplicate feedback on same prediction
    UNIQUE(user_id, prediction_id)
);

-- Indexes for prediction feedback
CREATE INDEX idx_prediction_feedback_user ON public.prediction_feedback(user_id);
CREATE INDEX idx_prediction_feedback_prediction ON public.prediction_feedback(prediction_id);
CREATE INDEX idx_prediction_feedback_bet ON public.prediction_feedback(bet_id);
CREATE INDEX idx_prediction_feedback_sport ON public.prediction_feedback(sport);
CREATE INDEX idx_prediction_feedback_helpful ON public.prediction_feedback(was_helpful) WHERE was_helpful IS NOT NULL;
CREATE INDEX idx_prediction_feedback_accurate ON public.prediction_feedback(was_accurate) WHERE was_accurate IS NOT NULL;
CREATE INDEX idx_prediction_feedback_action ON public.prediction_feedback(user_action);
CREATE INDEX idx_prediction_feedback_created ON public.prediction_feedback(created_at DESC);

-- Enable RLS on prediction feedback
ALTER TABLE public.prediction_feedback ENABLE ROW LEVEL SECURITY;

-- RLS policies for prediction feedback
CREATE POLICY "Users can view their own prediction feedback"
    ON public.prediction_feedback FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own prediction feedback"
    ON public.prediction_feedback FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prediction feedback"
    ON public.prediction_feedback FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prediction feedback"
    ON public.prediction_feedback FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================
-- ALERT FEEDBACK TABLE
-- Tracks user feedback on alerts/notifications
-- =============================================
CREATE TABLE IF NOT EXISTS public.alert_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE,

    -- Alert details (denormalized)
    alert_type TEXT,
    priority_level TEXT,

    -- Feedback metrics
    was_useful BOOLEAN,
    was_timely BOOLEAN,
    was_accurate BOOLEAN,
    relevance_rating INTEGER CHECK (relevance_rating >= 1 AND relevance_rating <= 5),

    -- Action taken
    user_action TEXT CHECK (user_action IN ('acted_on', 'investigated', 'dismissed', 'snoozed', 'disabled_alert_type', 'ignored')),
    time_to_action_seconds INTEGER,  -- How long until user acted

    -- Outcome
    led_to_bet BOOLEAN DEFAULT false,
    bet_id UUID REFERENCES public.bets(id) ON DELETE SET NULL,
    was_profitable BOOLEAN,  -- If bet was placed, was it profitable?

    -- Detailed feedback
    feedback_text TEXT,
    false_positive BOOLEAN,  -- Was this a false alert?

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Prevent duplicate feedback on same alert
    UNIQUE(user_id, notification_id)
);

-- Indexes for alert feedback
CREATE INDEX idx_alert_feedback_user ON public.alert_feedback(user_id);
CREATE INDEX idx_alert_feedback_notification ON public.alert_feedback(notification_id);
CREATE INDEX idx_alert_feedback_type ON public.alert_feedback(alert_type);
CREATE INDEX idx_alert_feedback_useful ON public.alert_feedback(was_useful) WHERE was_useful IS NOT NULL;
CREATE INDEX idx_alert_feedback_action ON public.alert_feedback(user_action);
CREATE INDEX idx_alert_feedback_created ON public.alert_feedback(created_at DESC);
CREATE INDEX idx_alert_feedback_led_to_bet ON public.alert_feedback(led_to_bet) WHERE led_to_bet = true;

-- Enable RLS on alert feedback
ALTER TABLE public.alert_feedback ENABLE ROW LEVEL SECURITY;

-- RLS policies for alert feedback
CREATE POLICY "Users can view their own alert feedback"
    ON public.alert_feedback FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alert feedback"
    ON public.alert_feedback FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alert feedback"
    ON public.alert_feedback FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alert feedback"
    ON public.alert_feedback FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================
-- FEATURE FEEDBACK TABLE
-- General feedback on app features and UX
-- =============================================
CREATE TABLE IF NOT EXISTS public.feature_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Feature identification
    feature_name TEXT NOT NULL,  -- e.g., 'dashboard', 'conversation_history', 'kelly_calculator'
    feature_area TEXT CHECK (feature_area IN ('chat', 'analytics', 'alerts', 'bankroll', 'settings', 'predictions', 'responsible_gambling', 'general')),

    -- Feedback metrics
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    ease_of_use_rating INTEGER CHECK (ease_of_use_rating >= 1 AND ease_of_use_rating <= 5),
    would_recommend BOOLEAN,

    -- Feedback type
    feedback_type TEXT CHECK (feedback_type IN ('bug_report', 'feature_request', 'improvement', 'praise', 'complaint', 'suggestion')),

    -- Detailed feedback
    title TEXT,
    description TEXT NOT NULL,
    expected_behavior TEXT,
    actual_behavior TEXT,

    -- Priority (user's perspective)
    user_priority TEXT CHECK (user_priority IN ('low', 'medium', 'high', 'critical')),

    -- Status tracking (for internal use)
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'planned', 'in_progress', 'completed', 'wont_fix')),
    admin_notes TEXT,

    -- Metadata
    browser_info JSONB,
    screen_resolution TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for feature feedback
CREATE INDEX idx_feature_feedback_user ON public.feature_feedback(user_id);
CREATE INDEX idx_feature_feedback_feature ON public.feature_feedback(feature_name);
CREATE INDEX idx_feature_feedback_area ON public.feature_feedback(feature_area);
CREATE INDEX idx_feature_feedback_type ON public.feature_feedback(feedback_type);
CREATE INDEX idx_feature_feedback_status ON public.feature_feedback(status);
CREATE INDEX idx_feature_feedback_created ON public.feature_feedback(created_at DESC);
CREATE INDEX idx_feature_feedback_rating ON public.feature_feedback(satisfaction_rating) WHERE satisfaction_rating IS NOT NULL;

-- Enable RLS on feature feedback
ALTER TABLE public.feature_feedback ENABLE ROW LEVEL SECURITY;

-- RLS policies for feature feedback
CREATE POLICY "Users can view their own feature feedback"
    ON public.feature_feedback FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feature feedback"
    ON public.feature_feedback FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feature feedback"
    ON public.feature_feedback FOR UPDATE
    USING (auth.uid() = user_id);

-- =============================================
-- FEEDBACK ANALYTICS VIEWS
-- Aggregated views for analyzing feedback trends
-- =============================================

-- Message feedback summary view
CREATE OR REPLACE VIEW public.message_feedback_summary AS
SELECT
    response_type,
    COUNT(*) as total_feedback,
    SUM(CASE WHEN feedback_type = 'thumbs_up' THEN 1 ELSE 0 END) as thumbs_up_count,
    SUM(CASE WHEN feedback_type = 'thumbs_down' THEN 1 ELSE 0 END) as thumbs_down_count,
    SUM(CASE WHEN is_helpful = true THEN 1 ELSE 0 END) as helpful_count,
    SUM(CASE WHEN is_helpful = false THEN 1 ELSE 0 END) as not_helpful_count,
    AVG(rating) as avg_rating,
    DATE_TRUNC('day', created_at) as feedback_date
FROM public.message_feedback
GROUP BY response_type, DATE_TRUNC('day', created_at);

-- Prediction feedback summary view
CREATE OR REPLACE VIEW public.prediction_feedback_summary AS
SELECT
    sport,
    prediction_type,
    COUNT(*) as total_feedback,
    SUM(CASE WHEN was_helpful = true THEN 1 ELSE 0 END) as helpful_count,
    SUM(CASE WHEN was_accurate = true THEN 1 ELSE 0 END) as accurate_count,
    SUM(CASE WHEN user_action = 'placed_bet' THEN 1 ELSE 0 END) as bets_placed,
    AVG(confidence_rating) as avg_confidence,
    AVG(value_rating) as avg_value,
    SUM(CASE WHEN prediction_result = 'correct' THEN 1 ELSE 0 END) as correct_predictions,
    SUM(user_profit_loss) as total_profit_loss,
    DATE_TRUNC('day', created_at) as feedback_date
FROM public.prediction_feedback
GROUP BY sport, prediction_type, DATE_TRUNC('day', created_at);

-- Alert feedback summary view
CREATE OR REPLACE VIEW public.alert_feedback_summary AS
SELECT
    alert_type,
    priority_level,
    COUNT(*) as total_feedback,
    SUM(CASE WHEN was_useful = true THEN 1 ELSE 0 END) as useful_count,
    SUM(CASE WHEN was_timely = true THEN 1 ELSE 0 END) as timely_count,
    SUM(CASE WHEN led_to_bet = true THEN 1 ELSE 0 END) as led_to_bet_count,
    AVG(relevance_rating) as avg_relevance,
    AVG(time_to_action_seconds) as avg_time_to_action,
    SUM(CASE WHEN false_positive = true THEN 1 ELSE 0 END) as false_positive_count,
    DATE_TRUNC('day', created_at) as feedback_date
FROM public.alert_feedback
GROUP BY alert_type, priority_level, DATE_TRUNC('day', created_at);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to get user's feedback statistics
CREATE OR REPLACE FUNCTION public.get_user_feedback_stats(p_user_id UUID)
RETURNS TABLE (
    total_message_feedback BIGINT,
    positive_message_feedback BIGINT,
    total_prediction_feedback BIGINT,
    helpful_predictions BIGINT,
    total_alert_feedback BIGINT,
    useful_alerts BIGINT,
    total_feature_feedback BIGINT,
    avg_satisfaction NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.message_feedback WHERE user_id = p_user_id),
        (SELECT COUNT(*) FROM public.message_feedback WHERE user_id = p_user_id AND (feedback_type = 'thumbs_up' OR is_helpful = true)),
        (SELECT COUNT(*) FROM public.prediction_feedback WHERE user_id = p_user_id),
        (SELECT COUNT(*) FROM public.prediction_feedback WHERE user_id = p_user_id AND was_helpful = true),
        (SELECT COUNT(*) FROM public.alert_feedback WHERE user_id = p_user_id),
        (SELECT COUNT(*) FROM public.alert_feedback WHERE user_id = p_user_id AND was_useful = true),
        (SELECT COUNT(*) FROM public.feature_feedback WHERE user_id = p_user_id),
        (SELECT AVG(satisfaction_rating) FROM public.feature_feedback WHERE user_id = p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has already given feedback on a message
CREATE OR REPLACE FUNCTION public.has_message_feedback(p_user_id UUID, p_message_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.message_feedback
        WHERE user_id = p_user_id AND message_id = p_message_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers to all feedback tables
CREATE TRIGGER update_message_feedback_timestamp
    BEFORE UPDATE ON public.message_feedback
    FOR EACH ROW
    EXECUTE FUNCTION public.update_feedback_updated_at();

CREATE TRIGGER update_prediction_feedback_timestamp
    BEFORE UPDATE ON public.prediction_feedback
    FOR EACH ROW
    EXECUTE FUNCTION public.update_feedback_updated_at();

CREATE TRIGGER update_alert_feedback_timestamp
    BEFORE UPDATE ON public.alert_feedback
    FOR EACH ROW
    EXECUTE FUNCTION public.update_feedback_updated_at();

CREATE TRIGGER update_feature_feedback_timestamp
    BEFORE UPDATE ON public.feature_feedback
    FOR EACH ROW
    EXECUTE FUNCTION public.update_feedback_updated_at();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prediction_feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_feedback TO authenticated;

GRANT SELECT ON public.message_feedback_summary TO authenticated;
GRANT SELECT ON public.prediction_feedback_summary TO authenticated;
GRANT SELECT ON public.alert_feedback_summary TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.message_feedback IS 'Stores user feedback on individual chat messages for AI response improvement';
COMMENT ON TABLE public.prediction_feedback IS 'Stores user feedback on betting predictions for model accuracy improvement';
COMMENT ON TABLE public.alert_feedback IS 'Stores user feedback on alerts/notifications for alert optimization';
COMMENT ON TABLE public.feature_feedback IS 'Stores general user feedback on app features and user experience';

COMMENT ON FUNCTION public.get_user_feedback_stats IS 'Returns aggregated feedback statistics for a specific user';
COMMENT ON FUNCTION public.has_message_feedback IS 'Checks if a user has already provided feedback on a specific message';
