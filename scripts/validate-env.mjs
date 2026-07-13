const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'LIVEKIT_URL'
];

const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length) {
  console.error(`Missing required Vercel environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const forbiddenPublic = Object.keys(process.env).filter((name) =>
  /^(NEXT_PUBLIC_|VITE_)/.test(name) && /(SECRET|SERVICE_ROLE|PRIVATE|WEBHOOK)/i.test(name)
);

if (forbiddenPublic.length) {
  console.error(`Server secrets cannot use public prefixes: ${forbiddenPublic.join(', ')}`);
  process.exit(1);
}

console.log('Vercel environment contract valid.');
