import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url) throw new Error('Missing SUPABASE_URL.');
if (!publishableKey) throw new Error('Missing SUPABASE_PUBLISHABLE_KEY.');

export function createSupabaseUserClient(accessToken: string) {
  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-application-name': 'rich-bizness-universe-api-user'
      }
    }
  });
}
