-- Create user_awards table for storing user achievement awards
-- This table tracks which awards users have earned and their progress

CREATE TABLE IF NOT EXISTS public.user_awards (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  award_id TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  progress NUMERIC(10, 2) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Composite primary key ensures one award per user
  PRIMARY KEY (user_id, award_id)
);

-- Create index for faster queries by user_id
CREATE INDEX IF NOT EXISTS idx_user_awards_user_id ON public.user_awards(user_id);

-- Create index for faster queries by award_id
CREATE INDEX IF NOT EXISTS idx_user_awards_award_id ON public.user_awards(award_id);

-- Create index for sorting by earned_at
CREATE INDEX IF NOT EXISTS idx_user_awards_earned_at ON public.user_awards(earned_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_awards ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Users can only see their own awards
CREATE POLICY "Users can view their own awards"
  ON public.user_awards
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create RLS policy: Users can insert their own awards
CREATE POLICY "Users can insert their own awards"
  ON public.user_awards
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policy: Users can update their own awards
CREATE POLICY "Users can update their own awards"
  ON public.user_awards
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policy: Users can delete their own awards
CREATE POLICY "Users can delete their own awards"
  ON public.user_awards
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_user_awards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_awards_updated_at
  BEFORE UPDATE ON public.user_awards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_awards_updated_at();

-- Add comment to table
COMMENT ON TABLE public.user_awards IS 'Stores user achievement awards and progress tracking';

-- Add comments to columns
COMMENT ON COLUMN public.user_awards.user_id IS 'Reference to the user who earned the award';
COMMENT ON COLUMN public.user_awards.award_id IS 'Unique identifier for the award type';
COMMENT ON COLUMN public.user_awards.earned_at IS 'Timestamp when the award was earned';
COMMENT ON COLUMN public.user_awards.progress IS 'Optional progress value (0-100 or custom scale)';
