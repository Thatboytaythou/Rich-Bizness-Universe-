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
  const page = (name: string) => resolve(webRoot, `${name}.html`);
  return {
    root: webRoot,
    publicDir: resolve(webRoot, 'public'),
    envDir: __dirname,
    define: { __RB_PUBLIC_ENV__: JSON.stringify(runtimeEnv) },
    build: {
      outDir: resolve(__dirname, 'apps/web/dist'), emptyOutDir: true, sourcemap: true, target: 'es2022',
      rollupOptions: { input: {
        index: page('index'), tapIn: page('tap-in'), profile: page('profile'), editProfile: page('edit-profile'), settings: page('settings'), notifications: page('notifications'), messages: page('messages'), search: page('search'), upload: page('upload'), creator: page('creator'), admin: page('admin'), feed: page('feed'), gallery: page('gallery'), live: page('live'), watch: page('watch'), music: page('music'), podcast: page('podcast'), radio: page('radio'), sports: page('sports'), store: page('store'), gaming: page('gaming'), meta: page('meta'), avatar: page('avatar'), richChess: page('rich-chess'), smokeRoomCards: page('smoke-room-cards'), djRadioRun: page('dj-radio-run'), moneyRoadRunner: page('money-road-runner'), richSamuraisSonNinja: page('rich-samurais-son-ninja'), auraShinobiClash: page('aura-shinobi-clash'), bossWalkBattle: page('boss-walk-battle'), smokeBurstArena: page('smoke-burst-arena'), heroVillainShowdown: page('hero-villain-showdown'), empireBuilder: page('empire-builder'), marketFlip: page('market-flip'), vaultUnlock: page('vault-unlock'), portalRoomRush: page('portal-room-rush'), avatarFreeRoam: page('avatar-free-roam'), smokeCityHustle: page('smoke-city-hustle'), treehouseRide: page('treehouse-ride'), studioShowdown: page('studio-showdown'), richCourtKing: page('rich-court-king'), diamondBatFlip: page('diamond-bat-flip'), golfGreenGold: page('golf-green-gold'), gymGrindReps: page('gym-grind-reps'), cashRainCatcher: page('cash-rain-catcher'), portalDash: page('portal-dash'), biznessPartyRoom: page('bizness-party-room')
      }}
    },
    resolve: { alias: { '@web': resolve(webRoot, 'src'), '@rb/config': resolve(__dirname, 'packages/config/src'), '@rb/database': resolve(__dirname, 'packages/database/src'), '@rb/ui': resolve(__dirname, 'packages/ui/src'), '@rb/avatar': resolve(__dirname, 'engines/avatar/src'), '@rb/game-runtime': resolve(__dirname, 'engines/game-runtime/src') } }
  };
});