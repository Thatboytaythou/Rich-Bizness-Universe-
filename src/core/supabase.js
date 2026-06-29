import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let client;

export function getSupabase() {
  if (client) return client;
  if (!url || !key) {
    throw new Error("Missing Supabase environment variables.");
  }
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storageKey: "rb-universe-auth"
    }
  });
  return client;
}

export async function getSessionState() {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return {
    session: data.session || null,
    user: data.session?.user || null
  };
}
