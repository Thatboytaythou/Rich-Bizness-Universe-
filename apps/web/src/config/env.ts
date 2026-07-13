type BrowserEnv = Readonly<{
  supabaseUrl: string;
  supabasePublishableKey: string;
  livekitUrl: string;
  appUrl: string;
  appName: string;
  environment: 'development' | 'preview' | 'production';
}>;

function required(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];
  if (!value || typeof value !== 'string') throw new Error(`Missing browser environment variable: ${name}`);
  return value;
}

const environment = required('VITE_ENVIRONMENT');
if (!['development', 'preview', 'production'].includes(environment)) {
  throw new Error(`Invalid VITE_ENVIRONMENT: ${environment}`);
}

export const ENV: BrowserEnv = Object.freeze({
  supabaseUrl: required('VITE_SUPABASE_URL'),
  supabasePublishableKey: required('VITE_SUPABASE_PUBLISHABLE_KEY'),
  livekitUrl: required('VITE_LIVEKIT_URL'),
  appUrl: required('VITE_APP_URL'),
  appName: required('VITE_APP_NAME'),
  environment: environment as BrowserEnv['environment']
});
