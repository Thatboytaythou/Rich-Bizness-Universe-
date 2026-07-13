import { getGameBySlug, type GameCatalogEntry } from './catalog';

export type LoadedGameRuntime = Readonly<{
  game: GameCatalogEntry;
  module: Record<string, unknown>;
}>;

const GAME_MODULES = import.meta.glob<Record<string, unknown>>('./*/game.ts');

export async function loadGameRuntime(slug: string): Promise<LoadedGameRuntime> {
  const game = getGameBySlug(slug);
  if (!game) throw new Error(`Unknown game slug: ${slug}`);

  const modulePath = `./${slug}/game.ts`;
  const loader = GAME_MODULES[modulePath];
  if (!loader) throw new Error(`Missing runtime entry for ${slug}: ${modulePath}`);

  return Object.freeze({ game, module: await loader() });
}

export function resolveGameSlug(pathname = globalThis.location?.pathname ?? ''): string | null {
  const match = pathname.match(/^\/games\/([^/]+)\/?/i);
  return match?.[1] ?? null;
}

export async function bootCurrentGame(): Promise<LoadedGameRuntime | null> {
  const slug = resolveGameSlug();
  return slug ? loadGameRuntime(slug) : null;
}
