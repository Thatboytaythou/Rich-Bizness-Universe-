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

if (typeof window !== 'undefined' && !window.__RB_APP_SHELL_BOOTED__) {
  window.__RB_APP_SHELL_BOOTED__ = true;
  queueMicrotask(() => import('./app-shell.js'));
}