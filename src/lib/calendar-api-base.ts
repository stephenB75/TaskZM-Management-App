/**
 * Base URL for calendar Edge Function requests only.
 * Built from projectId so calendar code does not depend on api/api-base load order.
 * Do not import from api.ts or api-base.ts in this file.
 */
import { projectId } from '../utils/supabase/info';

export const CALENDAR_API_BASE = `https://${projectId}.supabase.co/functions/v1/taskzm-database-function`;
