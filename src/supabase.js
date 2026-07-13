import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
  realtime: { params: { eventsPerSecond: 20 } }
});

export async function requireUser(next = location.pathname + location.search) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    location.assign(`/tap-in.html?next=${encodeURIComponent(next)}`);
    return null;
  }
  return user;
}
