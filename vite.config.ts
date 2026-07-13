import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';

const webRoot = resolve(__dirname, 'apps/web');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const runtimeEnv = {
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    LIVEKIT_URL: env.LIVEKIT_URL ?? '',
    APP_URL: env.APP_URL ?? env.VERCEL_PROJECT_PRODUCTION_URL ?? '',
    APP_NAME: env.APP_NAME ?? 'Rich Bizness Universe',
    APP_ENVIRONMENT: env.VERCEL_ENV ?? mode
  };

  return {
    root: webRoot,
    publicDir: resolve(webRoot, 'public'),
    envDir: __dirname,
    define: { __RB_PUBLIC_ENV__: JSON.stringify(runtimeEnv) },
    build: {
      outDir: resolve(__dirname, 'apps/web/dist'),
      emptyOutDir: true,
      sourcemap: true,
      target: 'es2022',
      rollupOptions: {
        input: {
          index: resolve(webRoot, 'index.html'),
          profile: resolve(webRoot, 'profile.html'),
          gaming: resolve(webRoot, 'gaming.html')
        }
      }
    },
    resolve: {
      alias: {
        '@web': resolve(webRoot, 'src'),
        '@rb/config': resolve(__dirname, 'packages/config/src'),
        '@rb/database': resolve(__dirname, 'packages/database/src'),
        '@rb/ui': resolve(__dirname, 'packages/ui/src'),
        '@rb/avatar': resolve(__dirname, 'engines/avatar/src'),
        '@rb/game-runtime': resolve(__dirname, 'engines/game-runtime/src')
      }
    }
  };
});
