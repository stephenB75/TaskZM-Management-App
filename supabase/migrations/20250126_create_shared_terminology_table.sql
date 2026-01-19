-- Create shared_terminology table for storing user-learned keywords and phrases
-- This enables all users to benefit from terminology learned by any user
-- 
-- NOTE: This migration is based on scripts/create-shared-terminology-table.sql
-- If the table already exists, this migration will be idempotent (won't fail)
-- Migration: 20250126_create_shared_terminology_table.sql

-- Check if table exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'shared_terminology'
  ) THEN
    -- Table doesn't exist, create it
    CREATE TABLE shared_terminology (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      domain TEXT NOT NULL CHECK (domain IN ('business', 'home', 'personal', 'world')),
      term_type TEXT NOT NULL CHECK (term_type IN ('keyword', 'phrase', 'verb', 'noun')),
      term TEXT NOT NULL,
      term_lower TEXT NOT NULL, -- Lowercase version for case-insensitive matching
      usage_count INTEGER DEFAULT 1, -- Number of times this term has been used/learned
      created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- First user who contributed this term
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      last_used_at TIMESTAMPTZ DEFAULT now(),
      
      -- Ensure unique terms per domain and type (case-insensitive)
      UNIQUE(domain, term_type, term_lower)
    );

    -- Add indexes for efficient querying
    CREATE INDEX idx_shared_terminology_domain ON shared_terminology(domain);
    CREATE INDEX idx_shared_terminology_type ON shared_terminology(term_type);
    CREATE INDEX idx_shared_terminology_domain_type ON shared_terminology(domain, term_type);
    CREATE INDEX idx_shared_terminology_term_lower ON shared_terminology(term_lower);
    CREATE INDEX idx_shared_terminology_usage_count ON shared_terminology(usage_count DESC);
    CREATE INDEX idx_shared_terminology_last_used ON shared_terminology(last_used_at DESC);

    -- Enable Row Level Security
    ALTER TABLE shared_terminology ENABLE ROW LEVEL SECURITY;

    -- Create policies
    CREATE POLICY "Anyone can view shared terminology" ON shared_terminology
      FOR SELECT USING (true);

    CREATE POLICY "Authenticated users can add shared terminology" ON shared_terminology
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

    CREATE POLICY "Users can update shared terminology usage" ON shared_terminology
      FOR UPDATE USING (true)
      WITH CHECK (true);

    CREATE POLICY "Service role can delete shared terminology" ON shared_terminology
      FOR DELETE USING (false);

    -- Function to automatically update updated_at timestamp
    CREATE OR REPLACE FUNCTION update_shared_terminology_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Trigger to update updated_at on row update
    CREATE TRIGGER update_shared_terminology_updated_at
      BEFORE UPDATE ON shared_terminology
      FOR EACH ROW
      EXECUTE FUNCTION update_shared_terminology_updated_at();
  END IF;
END $$;

-- Function to increment usage count or insert new term (always recreate to ensure it's up to date)
CREATE OR REPLACE FUNCTION upsert_shared_terminology(
  p_domain TEXT,
  p_term_type TEXT,
  p_term TEXT,
  p_user_id UUID
)
RETURNS void AS $$
DECLARE
  v_term_lower TEXT := LOWER(TRIM(p_term));
BEGIN
  -- Insert or update: increment usage count and update last_used_at
  INSERT INTO shared_terminology (domain, term_type, term, term_lower, created_by, usage_count, last_used_at)
  VALUES (p_domain, p_term_type, TRIM(p_term), v_term_lower, p_user_id, 1, now())
  ON CONFLICT (domain, term_type, term_lower)
  DO UPDATE SET
    usage_count = shared_terminology.usage_count + 1,
    last_used_at = now(),
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION upsert_shared_terminology(TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_shared_terminology(TEXT, TEXT, TEXT, UUID) TO service_role;
