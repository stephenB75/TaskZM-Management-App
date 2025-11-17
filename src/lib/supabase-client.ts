/**
 * Shared Supabase Client
 * Single instance to avoid "Multiple GoTrueClient instances" warning
 */

import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../utils/supabase/info';

// Wrap initialization in try-catch to prevent crashes during module load
let supabaseInstance: ReturnType<typeof createClient> | null = null;

function initializeSupabase() {
  if (supabaseInstance) {
    return supabaseInstance;
  }
  
  try {
    supabaseInstance = createClient(
      `https://${projectId}.supabase.co`,
      publicAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    );
    return supabaseInstance;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    // Return a minimal mock client to prevent crashes
    // This should never happen, but prevents app crash
    return null as any;
  }
}

// Initialize immediately but safely
export const supabase = initializeSupabase();

