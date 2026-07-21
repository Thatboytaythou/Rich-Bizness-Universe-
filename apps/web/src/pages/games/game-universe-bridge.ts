const GAME_SLUGS = new Set([
  'diamond-bat-flip','portal-dash','studio-showdown','smoke-burst-arena','vault-unlock','treehouse-ride','empire-builder','cash-rain-catcher','market-flip','smoke-city-hustle','aura-shinobi-clash','bizness-party-room','rich-samurais-son-ninja','money-road-runner','smoke-room-cards','portal-room-rush','rich-chess','rich-court-king','dj-radio-run','hero-villain-showdown','boss-walk-battle','gym-grind-reps','avatar-free-roam','golf-green-gold','crown-connect-four','rich-spades-royale','rich-color-clash','rich-checkers-elite'
]);

const SECTION_ROUTES: Record<string,string> = {
  home: '/', portal: '/portal.html', gaming: '/gaming.html', games: '/gaming.html', live: '/live.html', watch: '/watch.html', feed: '/feed.html', gallery: '/gallery.html', sports: '/sports.html', music: '/music.html', radio: '/radio.html', podcast: '/podcast.html', store: '/store.html', profile: '/profile.html', creator: '/creator.html', upload: '/upload.html', meta: '/meta.html'
};

function slugFromPath(pathname: string): string | null {
  const clean = pathname.replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '');
  if (clean.startsWith('games/')) return clean.slice(6);
  return GAME_SLUGS.has(clean) ? clean : null;
}

function canonicalizeLocation(): void {
  const slug = slugFromPath(location.pathname);
  if (!slug || !GAME_SLUGS.has(slug)) return;
  const canonical = `/games/${slug}`;
  if (location.pathname !== canonical) history.replaceState(history.state, '', `${canonical}${location.search}${location.hash}`);
  document.body.dataset.gameSlug = slug;
  document.body.dataset.gameOwner = 'rich-bizness-game-runtime-v1';
}

function canonicalHref(anchor: HTMLAnchorElement): string | null {
  const raw = anchor.getAttribute('href');
  if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('javascript:')) return null;
  let url: URL;
  try { url = new URL(raw, location.origin); } catch { return null; }
  if (url.origin !== location.origin) return null;
  const gameSlug = slugFromPath(url.pathname);
  if (gameSlug && GAME_SLUGS.has(gameSlug)) return `/games/${gameSlug}${url.search}${url.hash}`;
  const key = url.pathname.replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '').toLowerCase();
  const route = SECTION_ROUTES[key];
  return route ? `${route}${url.search}${url.hash}` : null;
}

function normalizeLinks(root: ParentNode = document): void {
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
    const href = canonicalHref(anchor);
    if (href) anchor.setAttribute('href', href);
  });
}

function repairCatalogLabels(root: ParentNode = document): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach((node) => {
    const value = node.nodeValue ?? '';
    const repaired = value
      .replace(/(GAME\s+\d+\s*\/\s*)24\b/gi, '$128')
      .replace(/(WORLD\s+\d+\s*\/\s*)24\b/gi, '$128')
      .replace(/(\b\d+\s*\/\s*)24\b/g, '$128')
      .replace(/\b24\s+(GAMES|WORLDS)\b/gi, '28 $1');
    if (repaired !== value) node.nodeValue = repaired;
  });
}

function mountGameBridge(): void {
  canonicalizeLocation();
  normalizeLinks();
  repairCatalogLabels();
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        normalizeLinks(node);
        repairCatalogLabels(node);
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
}

mountGameBridge();
