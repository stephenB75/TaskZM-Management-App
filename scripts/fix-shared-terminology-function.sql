-- Fix/Recreate the upsert_shared_terminology function
-- This ensures it has the correct signature that matches the Edge Function call
-- Run this in the Supabase SQL Editor

-- Drop the function if it exists (to recreate with correct signature)
DROP FUNCTION IF EXISTS public.upsert_shared_terminology(TEXT, TEXT, TEXT, UUID);

-- Recreate the function with the correct signature
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

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION upsert_shared_terminology(TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_shared_terminology(TEXT, TEXT, TEXT, UUID) TO service_role;

-- Verify the function was created
SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'upsert_shared_terminology';
