const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_LIVEKIT_URL'
];

const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length) {
  console.error(`Missing required public environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const forbiddenPublic = Object.keys(process.env).filter((name) =>
  name.startsWith('VITE_') && /(SECRET|SERVICE_ROLE|PRIVATE|WEBHOOK)/i.test(name)
);

if (forbiddenPublic.length) {
  console.error(`Server secrets cannot use VITE_ prefixes: ${forbiddenPublic.join(', ')}`);
  process.exit(1);
}

console.log('Environment contract valid.');
