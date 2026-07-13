export {
  GAME_BY_SLUG,
  GAME_CATALOG,
  getGameBySlug,
  type GameCatalogEntry,
  type GameStatus
} from '../../../../games/catalog';

export const GAME_ROUTE_PREFIX = '/games/';

export function gameHref(slug: string): string {
  return `${GAME_ROUTE_PREFIX}${encodeURIComponent(slug)}/`;
}
