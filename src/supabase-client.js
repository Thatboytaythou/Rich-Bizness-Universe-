import { createClient } from '@supabase/supabase-js';
import { RB_CONFIG } from './config.js';

const settings = RB_CONFIG.supabase;

export const supabase = settings.url && settings.publishableKey
  ? createClient(settings.url, settings.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
