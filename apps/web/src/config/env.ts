type BrowserEnv = Readonly<{
  supabaseUrl: string;
  supabasePublishableKey: string;
  livekitUrl: string;
  appUrl: string;
  appName: string;
  environment: 'development' | 'preview' | 'production';
}>;

function required(name: keyof typeof __RB_PUBLIC_ENV__): string {
  const value = __RB_PUBLIC_ENV__[name];
  if (!value || typeof value !== 'string') throw new Error(`Missing browser environment value: ${name}`);
  return value;
}

const rawEnvironment = __RB_PUBLIC_ENV__.APP_ENVIRONMENT || 'development';
const environment = rawEnvironment === 'production' || rawEnvironment === 'preview' ? rawEnvironment : 'development';

export const ENV: BrowserEnv = Object.freeze({
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL'),
  supabasePublishableKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  livekitUrl: required('LIVEKIT_URL'),
  appUrl: __RB_PUBLIC_ENV__.APP_URL || globalThis.location?.origin || '',
  appName: __RB_PUBLIC_ENV__.APP_NAME || 'Rich Bizness Universe',
  environment
});
