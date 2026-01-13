-- Create user_awards table for storing user-earned awards and achievements
-- This enables awards to persist across devices and be linked to user profiles
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  award_id TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  progress INTEGER, -- For progressive awards (optional)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure unique award per user (user can only earn each award once)
  UNIQUE(user_id, award_id)
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_awards_user_id ON user_awards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_awards_award_id ON user_awards(award_id);
CREATE INDEX IF NOT EXISTS idx_user_awards_earned_at ON user_awards(earned_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_awards_user_earned ON user_awards(user_id, earned_at DESC);

-- Enable Row Level Security
ALTER TABLE user_awards ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Users can view their own awards
CREATE POLICY "Users can view their own awards" ON user_awards
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own awards
CREATE POLICY "Users can insert their own awards" ON user_awards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own awards (for progress tracking)
CREATE POLICY "Users can update their own awards" ON user_awards
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own awards (if needed)
CREATE POLICY "Users can delete their own awards" ON user_awards
  FOR DELETE USING (auth.uid() = user_id);

-- Also allow service role full access (for backend operations)
CREATE POLICY "Service role has full access to user awards" ON user_awards
  FOR ALL USING (true) WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_awards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_awards_updated_at
  BEFORE UPDATE ON user_awards
  FOR EACH ROW
  EXECUTE FUNCTION update_user_awards_updated_at();
