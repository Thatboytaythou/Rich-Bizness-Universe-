import { createClient } from '@supabase/supabase-js';
import { ENV } from '../../config/env';
import type { Database } from './database.types';

export const supabase = createClient<Database>(ENV.supabaseUrl, ENV.supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'rich-bizness-auth'
  },
  realtime: {
    params: { eventsPerSecond: 20 },
    timeout: 20_000
  },
  global: {
    headers: { 'x-application-name': 'rich-bizness-universe-web' }
  }
});
