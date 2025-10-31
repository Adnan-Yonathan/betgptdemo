-- Phase 3: User Preferences and Intelligence System
-- Part 3: Conversation Memory System
-- Stores summaries of past conversations to provide context to the AI

CREATE TABLE IF NOT EXISTS public.conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,

  -- Summary content
  summary_text TEXT NOT NULL,
  key_topics JSONB DEFAULT '[]'::jsonb, -- ['injury reports', 'Lakers bet', 'bankroll advice']
  bets_discussed JSONB DEFAULT '[]'::jsonb, -- Array of bet IDs or descriptions
  advice_given TEXT,
  user_questions TEXT,

  -- Sentiment analysis
  user_sentiment TEXT DEFAULT 'neutral', -- 'positive', 'negative', 'neutral', 'frustrated', 'excited'

  -- Important flags
  contains_goals BOOLEAN DEFAULT false, -- Did user state betting goals?
  contains_concerns BOOLEAN DEFAULT false, -- Did user express concerns?
  requires_follow_up BOOLEAN DEFAULT false, -- Should AI reference this in future?

  -- Metadata
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(conversation_id)
);

-- Enable RLS
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own conversation summaries"
ON public.conversation_summaries
FOR SELECT
USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_conversation_summaries_user_id ON public.conversation_summaries(user_id);
CREATE INDEX idx_conversation_summaries_conversation_id ON public.conversation_summaries(conversation_id);
CREATE INDEX idx_conversation_summaries_created_at ON public.conversation_summaries(created_at DESC);

-- Function to get user memory context (last N conversations)
CREATE OR REPLACE FUNCTION public.get_user_memory_context(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 5
)
RETURNS TEXT AS $$
DECLARE
  memory_text TEXT := '';
  summary_record RECORD;
  summary_count INTEGER := 0;
BEGIN
  -- Get recent conversation summaries
  FOR summary_record IN
    SELECT
      summary_text,
      key_topics,
      advice_given,
      user_questions,
      user_sentiment,
      created_at
    FROM public.conversation_summaries
    WHERE user_id = p_user_id
      AND requires_follow_up = true
    ORDER BY created_at DESC
    LIMIT p_limit
  LOOP
    summary_count := summary_count + 1;

    memory_text := memory_text || E'\n--- Past Conversation ' || summary_count || ' (' ||
      TO_CHAR(summary_record.created_at, 'Mon DD, HH:MI AM') || ') ---\n';

    -- Add summary
    IF summary_record.summary_text IS NOT NULL AND summary_record.summary_text != '' THEN
      memory_text := memory_text || 'Summary: ' || summary_record.summary_text || E'\n';
    END IF;

    -- Add key topics
    IF summary_record.key_topics IS NOT NULL AND jsonb_array_length(summary_record.key_topics) > 0 THEN
      memory_text := memory_text || 'Topics: ' ||
        (SELECT string_agg(value::text, ', ') FROM jsonb_array_elements_text(summary_record.key_topics)) ||
        E'\n';
    END IF;

    -- Add advice given
    IF summary_record.advice_given IS NOT NULL AND summary_record.advice_given != '' THEN
      memory_text := memory_text || 'Advice Given: ' || summary_record.advice_given || E'\n';
    END IF;

    -- Add user sentiment
    IF summary_record.user_sentiment != 'neutral' THEN
      memory_text := memory_text || 'User Sentiment: ' || summary_record.user_sentiment || E'\n';
    END IF;

    memory_text := memory_text || E'\n';
  END LOOP;

  -- If no summaries found
  IF summary_count = 0 THEN
    RETURN 'No previous conversation history available.';
  END IF;

  RETURN memory_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a simple conversation summary (placeholder for now)
CREATE OR REPLACE FUNCTION public.create_conversation_summary(
  p_conversation_id UUID,
  p_summary_text TEXT,
  p_key_topics JSONB DEFAULT '[]'::jsonb,
  p_user_sentiment TEXT DEFAULT 'neutral'
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_message_count INTEGER;
  v_summary_id UUID;
BEGIN
  -- Get user_id and message count from conversation
  SELECT user_id INTO v_user_id
  FROM public.conversations
  WHERE id = p_conversation_id;

  SELECT COUNT(*) INTO v_message_count
  FROM public.messages
  WHERE conversation_id = p_conversation_id;

  -- Insert summary
  INSERT INTO public.conversation_summaries (
    user_id,
    conversation_id,
    summary_text,
    key_topics,
    user_sentiment,
    message_count,
    requires_follow_up
  ) VALUES (
    v_user_id,
    p_conversation_id,
    p_summary_text,
    p_key_topics,
    p_user_sentiment,
    v_message_count,
    true -- Default to requiring follow-up
  )
  ON CONFLICT (conversation_id)
  DO UPDATE SET
    summary_text = EXCLUDED.summary_text,
    key_topics = EXCLUDED.key_topics,
    user_sentiment = EXCLUDED.user_sentiment,
    message_count = EXCLUDED.message_count
  RETURNING id INTO v_summary_id;

  RETURN v_summary_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON public.conversation_summaries TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_memory_context(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_conversation_summary(UUID, TEXT, JSONB, TEXT) TO authenticated, service_role;

-- Add comments
COMMENT ON TABLE public.conversation_summaries IS
'Stores summaries of past conversations to provide memory context to the AI assistant.';

COMMENT ON FUNCTION public.get_user_memory_context(UUID, INTEGER) IS
'Retrieves formatted memory context from past conversations for a user. Used to inject into AI prompts.';

COMMENT ON FUNCTION public.create_conversation_summary(UUID, TEXT, JSONB, TEXT) IS
'Creates or updates a conversation summary. Called after conversations end or at key points.';

-- Log installation
DO $$
BEGIN
  RAISE NOTICE '=============================================================';
  RAISE NOTICE 'Phase 3 Part 3: Conversation Memory Created Successfully';
  RAISE NOTICE '=============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - Stores conversation summaries';
  RAISE NOTICE '  - Tracks key topics and advice given';
  RAISE NOTICE '  - Sentiment analysis';
  RAISE NOTICE '  - Memory context generation for AI';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage:';
  RAISE NOTICE '  SELECT get_user_memory_context(user_id, 5);';
  RAISE NOTICE '  SELECT create_conversation_summary(conversation_id, ''summary text'');';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================';
END $$;
