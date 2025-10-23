-- Create table for storing scraped website data
CREATE TABLE IF NOT EXISTS public.scraped_websites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  url TEXT NOT NULL,
  extract_type TEXT,
  scraped_data JSONB,
  custom_prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.scraped_websites ENABLE ROW LEVEL SECURITY;

-- Create policies for scraped_websites
CREATE POLICY "Users can view their own scraped data"
ON public.scraped_websites
FOR SELECT
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own scraped data"
ON public.scraped_websites
FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can delete their own scraped data"
ON public.scraped_websites
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_scraped_websites_user_id ON public.scraped_websites(user_id);
CREATE INDEX idx_scraped_websites_url ON public.scraped_websites(url);
CREATE INDEX idx_scraped_websites_created_at ON public.scraped_websites(created_at DESC);