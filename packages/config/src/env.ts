export const PUBLIC_ENV_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_LIVEKIT_URL',
  'VITE_APP_URL',
  'VITE_APP_NAME',
  'VITE_ENVIRONMENT'
] as const;

export type PublicEnvKey = (typeof PUBLIC_ENV_KEYS)[number];

export function readPublicEnvironment(source: Record<string, string | undefined>) {
  const values = Object.fromEntries(PUBLIC_ENV_KEYS.map((key) => [key, source[key]?.trim() ?? '']));
  const missing = PUBLIC_ENV_KEYS.filter((key) => !values[key]);

  if (missing.length > 0) {
    throw new Error(`Missing public environment values: ${missing.join(', ')}`);
  }

  return values as Record<PublicEnvKey, string>;
}
