import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    manifest: true,
    sourcemap: false,
  },
  define: {
    __BUILD_ID__: JSON.stringify(Date.now().toString()),
  },
});
