import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';

const webRoot = resolve(__dirname, 'apps/web');
// Publish existing original brand artwork before Vite resolves CSS. Explicit aliases
// for legacy names whose original files are absent; do not mutate tracked source art.
const brandImages = [
 ['0E886281-8F03-4288-B3CA-C45369B7B58E.png','0E886281-8F03-4288-B3CA-C45369B7B58E.png'],
 ['gta-style-elite.png.jpeg','gta-style-elite.png.jpeg'],
 ['music-log.png.jpeg','music-logo.png.jpeg'],
 ['hero-banner.png','brand/IMG_5997.png'],
 ['hero-banner.png','brand/C54535CD-E2B2-481B-81C8-4CFA81CC2ACD.png']
] as const;
function publishBrandImages(){for(const [source,target] of brandImages){const output=resolve(webRoot,'public/images',target);mkdirSync(dirname(output),{recursive:true});copyFileSync(resolve(__dirname,'images',source),output);}}

const vendorChunk = (id: string): string | undefined => {
  if (!id.includes('node_modules')) return undefined;
  if (id.includes('/@livekit/protocol/')) return 'vendor-livekit-protocol';
  if (id.includes('/@livekit/mutex/')) return 'vendor-livekit-mutex';
  if (id.includes('/@livekit/typed-emitter/')) return 'vendor-livekit-events';
  if (id.includes('/webrtc-adapter/')) return 'vendor-webrtc-adapter';
  if (id.includes('/livekit-client/')) {
    if (id.includes('/room/')) return 'vendor-livekit-room';
    if (id.includes('/track/')) return 'vendor-livekit-track';
    if (id.includes('/participant/')) return 'vendor-livekit-participant';
    return 'vendor-livekit-core';
  }
  if (id.includes('/@livekit/')) return 'vendor-livekit-shared';
  if (id.includes('/ara3d/')) return 'vendor-character-hd';
  if (id.includes('/three/')) return 'vendor-three';
  if (id.includes('/@supabase/realtime-js/')) return 'vendor-supabase-realtime';
  if (id.includes('/@supabase/postgrest-js/')) return 'vendor-supabase-postgrest';
  if (id.includes('/@supabase/auth-js/')) return 'vendor-supabase-auth';
  if (id.includes('/@supabase/storage-js/')) return 'vendor-supabase-storage';
  if (id.includes('/@supabase/functions-js/')) return 'vendor-supabase-functions';
  if (id.includes('/@supabase/supabase-js/')) return 'vendor-supabase-core';
  if (id.includes('/ws/')) return 'vendor-websocket';
  if (id.includes('/tslib/')) return 'vendor-tslib';
  return 'vendor-shared';
};

export default defineConfig(({ mode }) => {
  publishBrandImages();
  const env = loadEnv(mode, __dirname, '');
  const runtimeEnv = {
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    LIVEKIT_URL: env.LIVEKIT_URL ?? '',
    APP_URL: env.APP_URL ?? env.VERCEL_PROJECT_PRODUCTION_URL ?? '',
    APP_NAME: env.APP_NAME ?? 'Rich Bizness Universe',
    APP_ENVIRONMENT: env.VERCEL_ENV ?? mode
  };
  const page = (name: string) => resolve(webRoot, `${name}.html`);
  return {
    root: webRoot,
    publicDir: resolve(webRoot, 'public'),
    envDir: __dirname,
    define: { __RB_PUBLIC_ENV__: JSON.stringify(runtimeEnv) },
    plugins: [{
      name: 'rb-beyond-cinematic-surfaces',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          const page = html.match(/data-page="([^"]+)"/)?.[1];
          if (!page) return html;
          const games = new Set(["rich-chess","crown-connect-four","treehouse-ride","rich-checkers-elite","smoke-room-cards","dj-radio-run","money-road-runner","rich-samurais-son-ninja","aura-shinobi-clash","boss-walk-battle","smoke-burst-arena","hero-villain-showdown","empire-builder","market-flip","vault-unlock","portal-room-rush","avatar-free-roam","smoke-city-hustle","studio-showdown","rich-court-king","diamond-bat-flip","golf-green-gold","gym-grind-reps","cash-rain-catcher","portal-dash","bizness-party-room","rich-color-clash","rich-spades-royale"]);
          const surface = games.has(page) ? 'game' : 'universe';
          return html.replace(/<body\b/, '<body data-rb-visual="' + surface + '"').replace('</head>', '<link rel="stylesheet" href="/src/styles/beyond-cinematic.css">\n</head>');
        }
      }
    }],
    build: {
      outDir: resolve(__dirname, 'apps/web/dist'),
      emptyOutDir: true,
      sourcemap: true,
      manifest: true,
      target: 'es2022',
      rollupOptions: {
        input: {
          index: page('index'), portal: page('portal'), tapIn: page('tap-in'), profile: page('profile'), editProfile: page('edit-profile'), settings: page('settings'), notifications: page('notifications'), messages: page('messages'), search: page('search'), upload: page('upload'), creator: page('creator'), creatorDimensions: page('creator-dimensions'), admin: page('admin'), feed: page('feed'), gallery: page('gallery'), live: page('live'), watch: page('watch'), music: page('music'), podcast: page('podcast'), radio: page('radio'), sports: page('sports'), store: page('store'), gaming: page('gaming'), meta: page('meta'), avatar: page('avatar'), avatarCharacters: page('avatar-characters'), richChess: page('rich-chess'), smokeRoomCards: page('smoke-room-cards'), djRadioRun: page('dj-radio-run'), moneyRoadRunner: page('money-road-runner'), richSamuraisSonNinja: page('rich-samurais-son-ninja'), auraShinobiClash: page('aura-shinobi-clash'), bossWalkBattle: page('boss-walk-battle'), smokeBurstArena: page('smoke-burst-arena'), heroVillainShowdown: page('hero-villain-showdown'), empireBuilder: page('empire-builder'), marketFlip: page('market-flip'), vaultUnlock: page('vault-unlock'), portalRoomRush: page('portal-room-rush'), avatarFreeRoam: page('avatar-free-roam'), smokeCityHustle: page('smoke-city-hustle'), treehouseRide: page('treehouse-ride'), studioShowdown: page('studio-showdown'), richCourtKing: page('rich-court-king'), diamondBatFlip: page('diamond-bat-flip'), golfGreenGold: page('golf-green-gold'), gymGrindReps: page('gym-grind-reps'), cashRainCatcher: page('cash-rain-catcher'), portalDash: page('portal-dash'), biznessPartyRoom: page('bizness-party-room'), richColorClash: page('rich-color-clash'), richSpadesRoyale: page('rich-spades-royale'), richCheckersElite: page('rich-checkers-elite'), crownConnectFour: page('crown-connect-four')
        },
        output: { manualChunks: vendorChunk }
      }
    },
    resolve: { alias: { '@web': resolve(webRoot, 'src'), '@rb/config': resolve(__dirname, 'packages/config/src'), '@rb/database': resolve(__dirname, 'packages/database/src'), '@rb/ui': resolve(__dirname, 'packages/ui/src'), '@rb/avatar': resolve(__dirname, 'engines/avatar/src'), '@rb/game-runtime': resolve(__dirname, 'engines/game-runtime/src') } }
  };
});