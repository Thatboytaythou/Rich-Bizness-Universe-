function present(name) {
  return Boolean(process.env[name]);
}

export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    live: 'WE LIT🔥',
    watch: 'We 🔥📺',
    env: {
      LIVEKIT_URL: present('LIVEKIT_URL'),
      LIVEKIT_API_KEY: present('LIVEKIT_API_KEY'),
      LIVEKIT_API_SECRET: present('LIVEKIT_API_SECRET'),
      SUPABASE_URL: present('SUPABASE_URL') || present('NEXT_PUBLIC_SUPABASE_URL'),
      SUPABASE_SERVICE_ROLE_KEY: present('SUPABASE_SERVICE_ROLE_KEY')
    },
    required: ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  });
}
