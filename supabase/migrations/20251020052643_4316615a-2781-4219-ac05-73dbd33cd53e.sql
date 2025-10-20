-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Add avatar_url column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url text;