export const PUBLIC_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'LIVEKIT_URL'
] as const;

export const OPTIONAL_PUBLIC_ENV_KEYS = [
  'APP_URL',
  'APP_NAME',
  'APP_ENVIRONMENT'
] as const;

export type PublicEnvKey = (typeof PUBLIC_ENV_KEYS)[number];

export function readPublicEnvironment(source: Record<string, string | undefined>) {
  const values = Object.fromEntries(PUBLIC_ENV_KEYS.map((key) => [key, source[key]?.trim() ?? '']));
  const missing = PUBLIC_ENV_KEYS.filter((key) => !values[key]);

  if (missing.length > 0) {
    throw new Error(`Missing Vercel public environment values: ${missing.join(', ')}`);
  }

  return values as Record<PublicEnvKey, string>;
}
