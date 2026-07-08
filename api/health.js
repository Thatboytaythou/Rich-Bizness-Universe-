export default function handler(req, res) {
  const hasSupabase = Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasLiveKit = Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);
  const ok = Boolean(hasSupabase && hasServiceRole);
  res.status(ok ? 200 : 500).json({
    ok,
    app: 'Rich Bizness Universe',
    supabaseConfigured: hasSupabase,
    supabaseServiceRoleConfigured: hasServiceRole,
    livekitConfigured: hasLiveKit,
    routes: '/api/routes',
    sections: '/api/sections'
  });
}
