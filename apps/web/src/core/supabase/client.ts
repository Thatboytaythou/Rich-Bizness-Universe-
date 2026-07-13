import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ENV } from '../../config/env';
import type { Database } from './database.types';

export const supabase: SupabaseClient<Database> = createClient<Database>(
  ENV.supabaseUrl,
  ENV.supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    },
    realtime: {
      params: { eventsPerSecond: 20 }
    },
    global: {
      headers: { 'x-application-name': 'rich-bizness-universe' }
    }
  }
);
