function send(res, status, body) {
  res.status(status).json(body);
}

export default function handler(req, res) {
  const livekitUrl = process.env.LIVEKIT_URL || '';
  const hasApiKey = Boolean(process.env.LIVEKIT_API_KEY);
  const hasApiSecret = Boolean(process.env.LIVEKIT_API_SECRET);
  const hasSupabaseUrl = Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const ok = Boolean(livekitUrl && hasApiKey && hasApiSecret && hasSupabaseUrl && hasServiceRole);
  return send(res, ok ? 200 : 500, {
    ok,
    livekitUrlConfigured: Boolean(livekitUrl),
    livekitUrlHost: livekitUrl ? livekitUrl.replace(/^wss?:\/\//, '').replace(/\/.*/, '') : null,
    livekitApiKeyConfigured: hasApiKey,
    livekitApiSecretConfigured: hasApiSecret,
    supabaseConfigured: hasSupabaseUrl,
    supabaseServiceRoleConfigured: hasServiceRole
  });
}
