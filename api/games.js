const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xfsrqomsiulswbalgknx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_pW8c7eWAX1GPi5HbncKjpg_CicEceV8';

export default async function handler(req, res) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/games?is_active=eq.true&select=id,slug,title,description,game_type,play_url,is_featured,metadata&order=is_featured.desc&limit=60`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` }
  });
  const data = await response.json().catch(() => []);
  res.status(response.ok ? 200 : 500).json({ ok: response.ok, games: Array.isArray(data) ? data : [] });
}
