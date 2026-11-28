// Proposed domain assignments only. No DNS, redirect, auth or payment side effects.
export const DOMAIN_WORLDS = Object.freeze({
  'rich-bizness.com': 'omni',
  'bizapp.site': 'businesses',
  'rich-bizness-mobile.app': 'movie-room',
  'supabase.company': 'private-worlds'
} as const);
export type DomainWorld = typeof DOMAIN_WORLDS[keyof typeof DOMAIN_WORLDS];
export function proposedWorld(hostname: string): DomainWorld | null {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return Object.prototype.hasOwnProperty.call(DOMAIN_WORLDS, host)
    ? DOMAIN_WORLDS[host as keyof typeof DOMAIN_WORLDS] : null;
}
// Hostnames are discovery hints, never authorization. Protected rooms must
// independently verify the signed-in member and server-side entitlement.
