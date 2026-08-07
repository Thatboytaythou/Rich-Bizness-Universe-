import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import './search.css';

type SearchResult = {
  category: string;
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  target_url: string;
  score: number;
};

type SearchSnapshot = {
  query?: string;
  category?: string;
  results?: SearchResult[];
  featured?: SearchResult[];
  counts?: Record<string, number>;
  inventory?: Record<string, number>;
  total?: number;
  recent?: Array<{ query: string; last_used_at?: string }>;
  trending?: Array<{ query: string; searches?: number; last_searched_at?: string }>;
};

type CategoryKey = 'all' | 'people' | 'creator' | 'feed' | 'gallery' | 'watch' | 'music' | 'podcast' | 'radio' | 'live' | 'sports' | 'gaming' | 'store' | 'meta';
type Channel = ReturnType<typeof supabase.channel>;
type CleanupHost = Window & { __rbPageCleanup?: (() => void | Promise<void>) | null };

const categories: ReadonlyArray<readonly [CategoryKey, string]> = [
  ['all', 'ALL'], ['people', 'PEOPLE'], ['creator', 'CREATORS'], ['feed', 'FEED'], ['gallery', 'GALLERY'],
  ['watch', 'WATCH'], ['music', 'MUSIC'], ['podcast', 'PODCAST'], ['radio', 'RADIO'], ['live', 'LIVE'],
  ['sports', 'SPORTS'], ['gaming', 'GAMING'], ['store', 'STORE'], ['meta', 'META']
];

const categoryAliases: Record<string, CategoryKey> = {
  people: 'people', profile: 'people', user: 'people', creator: 'creator', feed: 'feed', post: 'feed',
  gallery: 'gallery', image: 'gallery', watch: 'watch', video: 'watch', music: 'music', track: 'music',
  podcast: 'podcast', episode: 'podcast', radio: 'radio', station: 'radio', live: 'live', stream: 'live',
  sports: 'sports', gaming: 'gaming', game: 'gaming', store: 'store', product: 'store', meta: 'meta', world: 'meta'
};

const indexedTables = [
  'profiles', 'creator_page_settings', 'feed_posts', 'music_tracks', 'podcast_episodes', 'radio_stations',
  'live_streams', 'sports_posts', 'games', 'products', 'meta_worlds'
] as const;

const esc = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] ?? char));
const safeMedia = (value: unknown) => {
  try {
    const url = new URL(String(value || ''), location.origin);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (/\.(mp4|webm|mov)(\?|$)/i.test(url.pathname + url.search)) return '';
    return url.href;
  } catch {
    return '';
  }
};
const safeTarget = (value: unknown) => {
  try {
    const url = new URL(String(value || ''), location.origin);
    return url.origin === location.origin && url.pathname.startsWith('/') ? `${url.pathname}${url.search}${url.hash}` : '/search.html';
  } catch {
    return '/search.html';
  }
};
const normalizeCategory = (value: unknown): CategoryKey => categoryAliases[String(value || '').toLowerCase()] ?? 'feed';
const compactQuery = (value: string) => value.trim().replace(/\s+/g, ' ').slice(0, 100);

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  const mountEpoch = root.dataset.pageEpoch ?? '';
  let disposed = false;
  const isCurrent = () => !disposed && root.dataset.pageEpoch === mountEpoch && root.dataset.pageOwner === 'rich-bizness-search-v3';

  const userId = getAuthSnapshot().user?.id ?? null;
  const sessionId = (() => {
    const key = 'rb_search_session';
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(key, created);
    return created;
  })();

  root.innerHTML = `<main class="search-shell"><div class="search-atmosphere" aria-hidden="true"></div><div class="search-wrap">
    <header class="search-head"><a href="/portal.html" aria-label="Back to Portal">←</a><div class="search-brand"><p>RICH BIZNESS GLOBAL DISCOVERY</p><h1>SEARCH THE UNIVERSE</h1><small>${userId ? 'PERSONALIZED DISCOVERY ONLINE' : 'PUBLIC DISCOVERY ONLINE'}</small></div><div class="search-signal"><i></i><span>GLOBAL INDEX</span></div></header>
    <section class="search-command"><form id="searchForm" class="search-box"><span class="search-icon">⌕</span><input id="searchInput" autocomplete="off" inputmode="search" enterkeyhint="search" maxlength="100" aria-label="Search Rich Bizness" placeholder="Search creators, drops, music, live, games, worlds..."/><button id="clearSearch" type="button" aria-label="Clear search">×</button></form></section>
    <section class="search-intelligence"><article><small>INDEX</small><strong>${indexedTables.length}</strong><span>live data owners</span></article><article><small>MODE</small><strong>LIVE</strong><span>server ranked</span></article><article><small>ACCESS</small><strong>${userId ? 'RICH ID' : 'PUBLIC'}</strong><span>${userId ? 'history synced' : 'private session'}</span></article></section>
    <section id="trendingRow" class="discovery-row"></section>
    <section id="recentRow" class="discovery-row"></section>
    <div class="search-meta"><div id="filters" class="search-filters"></div><small id="resultCount">DISCOVERY READY</small></div>
    <section id="results" class="search-grid"></section>
    <nav class="search-shortcuts" aria-label="Universe shortcuts"><a href="/feed.html">FEED</a><a href="/gallery.html">GALLERY</a><a href="/watch.html">WATCH</a><a href="/music.html">MUSIC</a><a href="/radio.html">RADIO</a><a href="/podcast.html">PODCAST</a><a href="/live.html">LIVE</a><a href="/sports.html">SPORTS</a><a href="/gaming.html">GAMING</a><a href="/store.html">STORE</a><a href="/meta.html">META</a></nav>
    <p id="searchStatus" class="search-status" role="status"></p>
  </div></main>`;

  const input = root.querySelector<HTMLInputElement>('#searchInput')!;
  const results = root.querySelector<HTMLElement>('#results')!;
  const count = root.querySelector<HTMLElement>('#resultCount')!;
  const filters = root.querySelector<HTMLElement>('#filters')!;
  const recentRow = root.querySelector<HTMLElement>('#recentRow')!;
  const trendingRow = root.querySelector<HTMLElement>('#trendingRow')!;
  const form = root.querySelector<HTMLFormElement>('#searchForm')!;
  const clearButton = root.querySelector<HTMLButtonElement>('#clearSearch')!;
  const status = root.querySelector<HTMLElement>('#searchStatus')!;

  let rows: SearchResult[] = [];
  let featured: SearchResult[] = [];
  let counts: Record<string, number> = {};
  let inventory: Record<string, number> = {};
  let recent: string[] = [];
  let trending: Array<{ query: string; searches: number }> = [];
  let active: CategoryKey = 'all';
  let timer = 0;
  let statusTimer = 0;
  let refreshTimer = 0;
  let requestId = 0;
  let focusedIndex = -1;
  let lastExecutedQuery = '';
  let catalogChannel: Channel | null = null;

  const setStatus = (message = '', error = false) => {
    if (!isCurrent()) return;
    status.textContent = message;
    status.dataset.error = String(error);
    window.clearTimeout(statusTimer);
    if (message) statusTimer = window.setTimeout(() => { if (isCurrent() && status.textContent === message) status.textContent = ''; }, 3200);
  };

  const localRecent = (): string[] => {
    try {
      const value = JSON.parse(localStorage.getItem('rb_recent_searches') || '[]');
      return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string').slice(0, 8) : [];
    } catch { return []; }
  };

  const saveLocalRecent = (query: string) => {
    const values = [query, ...localRecent().filter((value) => value.toLowerCase() !== query.toLowerCase())].slice(0, 8);
    localStorage.setItem('rb_recent_searches', JSON.stringify(values));
    recent = [...new Set([...recent, ...values])].slice(0, 8);
  };

  const visibleRows = () => active === 'all' ? rows : rows.filter((row) => normalizeCategory(row.category) === active);
  const visibleFeatured = () => active === 'all' ? featured : featured.filter((row) => normalizeCategory(row.category) === active);

  const chooseQuery = (query: string) => { input.value = query; void runSearch(true); };

  const drawDiscoveryRows = () => {
    trendingRow.innerHTML = trending.length
      ? `<div class="discovery-label"><small>TRENDING NOW</small><span>LIVE UNIVERSE</span></div><div class="discovery-pills">${trending.map((item, index) => `<button type="button" data-trending="${esc(item.query)}"><b>${String(index + 1).padStart(2, '0')}</b>${esc(item.query)}<small>${item.searches} signal${item.searches === 1 ? '' : 's'}</small></button>`).join('')}</div>`
      : '<div class="discovery-label"><small>TRENDING NOW</small><span>SYNCING</span></div>';
    recentRow.innerHTML = recent.length
      ? `<div class="discovery-label"><small>RECENT SEARCHES</small>${userId ? '<button id="clearHistory" type="button">CLEAR</button>' : '<span>THIS DEVICE</span>'}</div><div class="discovery-pills compact">${recent.map((query) => `<button type="button" data-recent="${esc(query)}">${esc(query)}</button>`).join('')}</div>`
      : '<div class="discovery-label"><small>RECENT SEARCHES</small><span>NONE YET</span></div>';
    trendingRow.querySelectorAll<HTMLButtonElement>('[data-trending]').forEach((button) => { button.onclick = () => chooseQuery(button.dataset.trending || ''); });
    recentRow.querySelectorAll<HTMLButtonElement>('[data-recent]').forEach((button) => { button.onclick = () => chooseQuery(button.dataset.recent || ''); });
    const clearHistory = root.querySelector<HTMLButtonElement>('#clearHistory');
    if (clearHistory) clearHistory.onclick = async () => {
      clearHistory.disabled = true;
      const { error } = await supabase.rpc('rb_search_action', { p_action: 'clear_history', p_payload: {} });
      if (!isCurrent()) return;
      clearHistory.disabled = false;
      if (error) return setStatus(error.message, true);
      recent = [];
      localStorage.removeItem('rb_recent_searches');
      drawDiscoveryRows();
    };
  };

  const drawFilters = () => {
    filters.innerHTML = categories.map(([key, label]) => {
      const total = key === 'all'
        ? Object.values(inventory).reduce((sum, value) => sum + Number(value || 0), 0)
        : Number(inventory[key] ?? counts[key] ?? featured.filter((row) => normalizeCategory(row.category) === key).length);
      return `<button type="button" class="search-chip ${key === active ? 'active' : ''}" data-filter="${key}"><span>${label}</span><b>${total}</b></button>`;
    }).join('');
    filters.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((button) => {
      button.onclick = () => {
        active = (button.dataset.filter as CategoryKey) || 'all';
        focusedIndex = -1;
        if (lastExecutedQuery) void runSearch(true, false);
        else { drawFilters(); drawResults(); }
      };
    });
  };

  const recordClick = async (row: SearchResult) => {
    if (!lastExecutedQuery) return;
    await supabase.rpc('rb_search_action', { p_action: 'record_click', p_payload: { query: lastExecutedQuery, category: active, session_id: sessionId, result_type: normalizeCategory(row.category), target_id: row.id, target_url: safeTarget(row.target_url), target_title: row.title } });
  };

  const card = (row: SearchResult, index: number) => {
    const category = normalizeCategory(row.category);
    const image = safeMedia(row.image_url);
    return `<a class="search-card search-card--${category} ${focusedIndex === index ? 'keyboard-focus' : ''}" href="${esc(safeTarget(row.target_url))}" data-result-index="${index}"><div class="search-media">${image ? `<img src="${esc(image)}" alt="" loading="lazy">` : `<div class="search-media-fallback"><span>${esc(row.title.slice(0, 1).toUpperCase())}</span></div>`}</div><div class="search-body"><span class="search-type">${esc(category)}</span><h2>${esc(row.title)}</h2><p>${esc(row.subtitle || 'Rich Bizness Universe')}</p><footer><strong>OPEN ↗</strong></footer></div></a>`;
  };

  const drawResults = () => {
    if (!isCurrent()) return;
    const source = lastExecutedQuery ? visibleRows() : visibleFeatured();
    count.textContent = lastExecutedQuery ? `${source.length} RESULT${source.length === 1 ? '' : 'S'}` : `${source.length} LIVE DROPS`;
    results.innerHTML = source.length
      ? source.map(card).join('')
      : '<div class="search-state"><strong>NO CONTENT IN THIS LANE YET.</strong><span>Use another universe lane.</span></div>';
    results.querySelectorAll<HTMLAnchorElement>('[data-result-index]').forEach((link) => {
      link.onclick = () => {
        const row = source[Number(link.dataset.resultIndex)];
        if (row) void recordClick(row);
      };
    });
  };

  const loadSnapshot = async (query: string, category: CategoryKey = active) => {
    const { data, error } = await supabase.rpc('rb_search_snapshot', { p_query: query, p_category: category, p_limit: 120 });
    if (error) throw error;
    return (data ?? {}) as SearchSnapshot;
  };

  const applySnapshot = (snapshot: SearchSnapshot) => {
    rows = (snapshot.results ?? []).sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0));
    featured = (snapshot.featured ?? []).sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0));
    counts = snapshot.counts ?? {};
    inventory = snapshot.inventory ?? inventory;
    recent = [...new Set([...(snapshot.recent ?? []).map((item) => item.query), ...localRecent()])].slice(0, 8);
    trending = (snapshot.trending ?? []).map((item) => ({ query: item.query, searches: Number(item.searches ?? 0) }));
  };

  const runSearch = async (immediate = false, record = true) => {
    window.clearTimeout(timer);
    const query = compactQuery(input.value);
    if (!immediate) { timer = window.setTimeout(() => void runSearch(true), 220); return; }
    const current = ++requestId;
    if (query.length < 2) {
      lastExecutedQuery = '';
      rows = [];
      active = active || 'all';
      history.replaceState({}, '', '/search.html');
      drawFilters();
      drawResults();
      return;
    }
    count.textContent = 'SCANNING...';
    try {
      const snapshot = await loadSnapshot(query, active);
      if (!isCurrent() || current !== requestId) return;
      applySnapshot(snapshot);
      lastExecutedQuery = query;
      if (record) saveLocalRecent(query);
      drawDiscoveryRows(); drawFilters(); drawResults();
      const categoryQuery = active === 'all' ? '' : `&category=${encodeURIComponent(active)}`;
      history.replaceState({}, '', `/search.html?q=${encodeURIComponent(query)}${categoryQuery}`);
      if (record) void supabase.rpc('rb_search_action', { p_action: 'record_query', p_payload: { query, category: active, result_count: rows.length, session_id: sessionId } });
    } catch (error) {
      if (!isCurrent() || current !== requestId) return;
      setStatus(error instanceof Error ? error.message : 'Search unavailable.', true);
    }
  };

  const scheduleRefresh = () => {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(async () => {
      try {
        const snapshot = await loadSnapshot(lastExecutedQuery, active);
        if (!isCurrent()) return;
        applySnapshot(snapshot); drawDiscoveryRows(); drawFilters(); drawResults();
      } catch {}
    }, 180);
  };

  const resetSearch = () => { input.value = ''; rows = []; lastExecutedQuery = ''; active = 'all'; history.replaceState({}, '', '/search.html'); drawFilters(); drawResults(); input.focus({ preventScroll: true }); };
  const onSubmit = (event: SubmitEvent) => { event.preventDefault(); void runSearch(true); };
  const onInput = () => void runSearch(false);
  const onClear = () => resetSearch();
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') return resetSearch();
    const source = lastExecutedQuery ? visibleRows() : visibleFeatured();
    if (!source.length || !['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
    if (event.key === 'Enter' && focusedIndex >= 0) {
      event.preventDefault(); const row = source[focusedIndex]; if (row) location.assign(safeTarget(row.target_url)); return;
    }
    event.preventDefault();
    focusedIndex = event.key === 'ArrowDown' ? (focusedIndex + 1) % source.length : (focusedIndex <= 0 ? source.length - 1 : focusedIndex - 1);
    drawResults();
  };

  form.addEventListener('submit', onSubmit);
  input.addEventListener('input', onInput);
  clearButton.addEventListener('click', onClear);
  window.addEventListener('keydown', onKeyDown);

  catalogChannel = supabase.channel(`rich-search-catalog:${mountEpoch}:${sessionId}`);
  indexedTables.forEach((table) => { catalogChannel = catalogChannel!.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRefresh); });
  catalogChannel.subscribe();

  const cleanup = async () => {
    if (disposed) return;
    disposed = true;
    requestId += 1;
    window.clearTimeout(timer); window.clearTimeout(statusTimer); window.clearTimeout(refreshTimer);
    form.removeEventListener('submit', onSubmit); input.removeEventListener('input', onInput); clearButton.removeEventListener('click', onClear); window.removeEventListener('keydown', onKeyDown);
    if (catalogChannel) await supabase.removeChannel(catalogChannel);
  };
  (window as CleanupHost).__rbPageCleanup = cleanup;

  try {
    const snapshot = await loadSnapshot('', 'all');
    if (!isCurrent()) return;
    applySnapshot(snapshot);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Discovery sync unavailable.', true);
    recent = localRecent();
  }
  drawDiscoveryRows(); drawFilters(); drawResults();

  const params = new URLSearchParams(location.search);
  active = categoryAliases[String(params.get('category') || '').toLowerCase()] ?? 'all';
  const initial = compactQuery(params.get('q') || '');
  if (initial) { input.value = initial; await runSearch(true, false); }
}
