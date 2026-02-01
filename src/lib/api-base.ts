/**
 * Single source of truth for Edge Function base URL.
 * Isolated from api.ts so api.ts never reads projectId at top level,
 * avoiding "Cannot access uninitialized variable" (TDZ) when the bundler
 * evaluates the provider tree.
 */

import { projectId } from '../utils/supabase/info';

export const API_BASE = `https://${projectId}.supabase.co/functions/v1/taskzm-database-function`;
