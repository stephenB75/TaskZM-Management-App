-- Verify that the upsert_shared_terminology function exists and has the correct signature
-- Run this in the Supabase SQL Editor to check

-- Check if function exists
SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'upsert_shared_terminology';

-- If the above returns no rows, the function doesn't exist
-- Run scripts/create-shared-terminology-table.sql to create it

-- Verify the function signature matches what the Edge Function expects:
-- Expected: upsert_shared_terminology(p_domain TEXT, p_term_type TEXT, p_term TEXT, p_user_id UUID)
