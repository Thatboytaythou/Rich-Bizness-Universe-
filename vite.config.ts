import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const webRoot = resolve(__dirname, 'apps/web');

export default defineConfig({
  root: webRoot,
  publicDir: resolve(webRoot, 'public'),
  envDir: __dirname,
  build: {
    outDir: resolve(__dirname, 'apps/web/dist'),
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        index: resolve(webRoot, 'index.html'),
        portal: resolve(webRoot, 'portal.html'),
        tapIn: resolve(webRoot, 'tap-in.html'),
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
});
