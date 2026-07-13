import { createClient } from '@supabase/supabase-js';
import { ENV } from '../../config/env';

export const supabase = createClient(ENV.supabaseUrl, ENV.supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
  realtime: {
    params: { eventsPerSecond: 20 }
  }
});
