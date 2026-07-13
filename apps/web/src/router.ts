import { ROUTES, safeInternalRoute, type RouteKey } from '@rb/config/routes';

export type NavigationOptions = Readonly<{
  replace?: boolean;
  query?: Record<string, string | number | boolean | null | undefined>;
}>;

export function routeUrl(route: RouteKey, query: NavigationOptions['query'] = {}): string {
  const url = new URL(ROUTES[route], window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function navigate(route: RouteKey | string, options: NavigationOptions = {}): void {
  const target = typeof route === 'string' && route in ROUTES
    ? routeUrl(route as RouteKey, options.query)
    : safeInternalRoute(String(route));

  if (options.replace) window.location.replace(target);
  else window.location.assign(target);
}

export function currentReturnTo(): string {
  return safeInternalRoute(`${window.location.pathname}${window.location.search}`, ROUTES.portal);
}
