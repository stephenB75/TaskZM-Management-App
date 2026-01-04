-- Create duckduckgo_search_cache table for storing DuckDuckGo search results
-- Run this in the Supabase SQL Editor
-- This enables persistent caching across sessions and devices for faster search results

CREATE TABLE IF NOT EXISTS duckduckgo_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  query_hash TEXT NOT NULL, -- Hashed query for faster lookups
  results JSONB NOT NULL, -- Array of search result strings
  extracted_keywords JSONB DEFAULT '[]'::jsonb, -- Extracted keywords from search results
  extracted_phrases JSONB DEFAULT '[]'::jsonb, -- Extracted phrases from search results
  extracted_verbs JSONB DEFAULT '[]'::jsonb, -- Extracted verbs (action words) from search results
  extracted_nouns JSONB DEFAULT '[]'::jsonb, -- Extracted nouns from search results
  extracted_pronouns JSONB DEFAULT '[]'::jsonb, -- Extracted pronouns from search results
  domain TEXT, -- Detected domain (business, home, personal, world, mixed)
  confidence NUMERIC(3, 2), -- Confidence score (0.00 to 1.00)
  hit_count INTEGER DEFAULT 1, -- Number of times this cache entry was used
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL, -- When this cache entry expires
  
  -- Ensure unique query_hash per user (or global if user_id is null)
  UNIQUE(user_id, query_hash)
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ddg_cache_query_hash ON duckduckgo_search_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_ddg_cache_user_id ON duckduckgo_search_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_ddg_cache_user_query ON duckduckgo_search_cache(user_id, query_hash);
CREATE INDEX IF NOT EXISTS idx_ddg_cache_expires_at ON duckduckgo_search_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_ddg_cache_domain ON duckduckgo_search_cache(domain);

-- Create index for full-text search on query (for finding similar queries)
CREATE INDEX IF NOT EXISTS idx_ddg_cache_query_text ON duckduckgo_search_cache USING gin(to_tsvector('english', query));

-- Enable Row Level Security
ALTER TABLE duckduckgo_search_cache ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Users can view their own cache entries and global (user_id IS NULL) entries
CREATE POLICY "Users can view their own and global cache entries" ON duckduckgo_search_cache
  FOR SELECT USING (
    auth.uid() = user_id OR 
    user_id IS NULL OR
    auth.uid() IS NULL -- Allow anonymous users to read global cache
  );

-- Users can insert their own cache entries
CREATE POLICY "Users can insert their own cache entries" ON duckduckgo_search_cache
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR 
    auth.uid() IS NULL -- Allow anonymous users to create cache entries
  );

-- Users can update their own cache entries (to update hit_count, etc.)
CREATE POLICY "Users can update their own cache entries" ON duckduckgo_search_cache
  FOR UPDATE USING (
    auth.uid() = user_id OR 
    user_id IS NULL
  );

-- Users can delete their own cache entries
CREATE POLICY "Users can delete their own cache entries" ON duckduckgo_search_cache
  FOR DELETE USING (
    auth.uid() = user_id OR 
    user_id IS NULL
  );

-- Service role has full access (for cleanup jobs, analytics, etc.)
CREATE POLICY "Service role has full access to search cache" ON duckduckgo_search_cache
  FOR ALL USING (true) WITH CHECK (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_duckduckgo_search_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on UPDATE
CREATE TRIGGER update_duckduckgo_search_cache_updated_at
  BEFORE UPDATE ON duckduckgo_search_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_duckduckgo_search_cache_updated_at();

-- Function to clean up expired cache entries (can be run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_search_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM duckduckgo_search_cache
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to clean up expired entries (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-expired-search-cache', '0 2 * * *', 'SELECT cleanup_expired_search_cache()');

