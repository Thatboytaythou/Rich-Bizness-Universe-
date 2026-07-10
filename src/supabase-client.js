import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FALLBACK_URL = 'https://xfsrqomsiulswbalgknx.supabase.co';
const FALLBACK_ANON_KEY = 'sb_publishable_pW8c7eWAX1GPi5HbncKjpg_CicEceV8';

const env = globalThis.__RICH_ENV__ || {};
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL;
const anonKey = env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;

const CLIENT_KEY = '__RICH_BIZNESS_SUPABASE__';

export const supabase = globalThis[CLIENT_KEY] || createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  realtime: {
    params: { eventsPerSecond: 10 },
    heartbeatIntervalMs: 30000,
    reconnectAfterMs: (tries) => Math.min(1000 * 2 ** Math.min(tries, 5), 30000),
  },
  global: {
    headers: { 'x-client-info': 'rich-bizness-universe' },
  },
});

if (!globalThis[CLIENT_KEY]) globalThis[CLIENT_KEY] = supabase;

export const RB_SUPABASE_SOURCE = Object.freeze({
  url,
  anonKeyType: anonKey.startsWith('sb_publishable_') ? 'publishable' : 'legacy-anon',
});
