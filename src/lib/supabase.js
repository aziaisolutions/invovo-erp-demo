import { createClient } from '@supabase/supabase-js';

// =========================================================================
// PRODUCTION ENV GUARDING LAYER (PREVENTS SILENT INITIALIZATION CRASHES)
// =========================================================================
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "CRITICAL ARCHITECTURAL ERROR: Supabase environment variables are missing! " +
    "Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are correctly set inside the Vercel Dashboard."
  );
}

// =========================================================================
// 🔒 ENTERPRISE OFFLINE DATA PERSISTENCE INTEGRITY INSTANCE
// =========================================================================
export const supabase = createClient(
  supabaseUrl || 'https://supabase.co', 
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      storageKey: 'invovo_erp_auth_session_token',
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    global: {
      headers: { 'X-Client-Info': 'invovo-erp-offline-sync-engine' },
    },
    realtime: {
      timeout: 30000
    }
  }
);