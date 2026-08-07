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
  counts?: Record<string, number>;
  total?: number;
  recent?: Array<{ query: string; last_used_at?: string }>;
  trending?: Array<{ query: string; searches?: number; last_searched_at?: string }>;
};

type CategoryKey = 'all' | 'people' | 'creator' | 'feed' | 'gallery' | 'watch' | 'music' | 'podcast' | 'radio' | 'live' | 'sports' | 'gaming' | 'store' | 'meta';
type Channel = ReturnType<typeof supabase.channel>;
type CleanupHost = Window & { __rbPageCleanup?: (() => void | Promise<void>) | null };

const OWNER = 'rich-bizness-search-v3';
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
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
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
  const isCurrent = () => !disposed && root.dataset.pageEpoch === mountEpoch && root.dataset.pageOwner === OWNER;

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
    <section class="search-command">
      <div class="search-command-copy"><span>ONE COMMAND • EVERY WORLD</span><h2>Find the people, drops, sounds, broadcasts, games, products and worlds moving Rich Bizness.</h2></div>
      <form id="searchForm" class="search-box"><span class="search-icon">⌕</span><input id="searchInput" autocomplete="off" inputmode="search" enterkeyhint="search" maxlength="100" aria-label="Search Rich Bizness" placeholder="Search creators, visuals, music, live, games, store..."/><kbd>⌘ K</kbd><button id="clearSearch" type="button" aria-label="Clear search">×</button></form>
      <div class="search-hints"><span>↑↓ MOVE</span><span>ENTER OPEN</span><span>ESC CLEAR</span><span>REALTIME INDEX</span></div>
    </section>
    <section class="search-intelligence"><article><small>INDEX</small><strong>${indexedTables.length}</strong><span>live data owners</span></article><article><small>MODE</small><strong>LIVE</strong><span>server ranked</span></article><article><small>ACCESS</small><strong>${userId ? 'RICH ID' : 'PUBLIC'}</strong><span>${userId ? 'history synced' : 'private session'}</span></article></section>
    <section class="search-discovery-rows"><div id="trendingRow" class="discovery-row"></div><div id="recentRow" class="discovery-row"></div></section>
    <div class="search-meta"><div id="filters" class="search-filters"></div><small id="resultCount">DISCOVERY READY</small></div>
    <section id="results" class="search-grid"><div class="search-state"><strong>THE WHOLE UNIVERSE IS CONNECTED.</strong><span>Start typing or choose a trending search.</span></div></section>
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
  let counts: Record<string, number> = {};
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
    } catch {
      return [];
    }
  };

  const saveLocalRecent = (query: string) => {
    const values = [query, ...localRecent().filter((value) => value.toLowerCase() !== query.toLowerCase())].slice(0, 8);
    localStorage.setItem('rb_recent_searches', JSON.stringify(values));
    recent = [...new Set([...recent, ...values])].slice(0, 8);
  };

  const visibleRows = () => active === 'all' ? rows : rows.filter((row) => normalizeCategory(row.category) === active);
  const chooseQuery = (query: string) => { if (!isCurrent()) return; input.value = query; void runSearch(true); };

  const drawDiscoveryRows = () => {
    if (!isCurrent()) return;
    trendingRow.innerHTML = trending.length
      ? `<div class="discovery-label"><small>TRENDING NOW</small><span>GLOBAL</span></div><div class="discovery-pills">${trending.map((item, index) => `<button type="button" data-trending="${esc(item.query)}"><b>${String(index + 1).padStart(2, '0')}</b>${esc(item.query)}<small>${item.searches} searches</small></button>`).join('')}</div>`
      : '<div class="discovery-label"><small>TRENDING NOW</small><span>BUILDING SIGNAL</span></div>';
    recentRow.innerHTML = recent.length
      ? `<div class="discovery-label"><small>RECENT SEARCHES</small>${userId ? '<button id="clearHistory" type="button">CLEAR</button>' : '<span>THIS DEVICE</span>'}</div><div class="discovery-pills compact">${recent.map((query) => `<button type="button" data-recent="${esc(query)}">${esc(query)}</button>`).join('')}</div>`
      : '<div class="discovery-label"><small>RECENT SEARCHES</small><span>NONE YET</span></div>';
    trendingRow.querySelectorAll<HTMLButtonElement>('[data-trending]').forEach((button) => { button.onclick = () => chooseQuery(button.dataset.trending || ''); });
    recentRow.querySelectorAll<HTMLButtonElement>('[data-recent]').forEach((button) => { button.onclick = () => chooseQuery(button.dataset.recent || ''); });
    const clearHistory = root.querySelector<HTMLButtonElement>('#clearHistory');
    if (clearHistory) clearHistory.onclick = async () => {
      if (!isCurrent()) return;
      clearHistory.disabled = true;
      const { error } = await supabase.rpc('rb_search_action', { p_action: 'clear_history', p_payload: {} });
      if (!isCurrent()) return;
      clearHistory.disabled = false;
      if (error) return setStatus(error.message, true);
      recent = [];
      localStorage.removeItem('rb_recent_searches');
      drawDiscoveryRows();
      setStatus('Search history cleared.');
    };
  };

  const drawFilters = () => {
    if (!isCurrent()) return;
    filters.innerHTML = categories.map(([key, label]) => {
      const total = key === 'all' ? rows.length : Number(counts[key] ?? rows.filter((row) => normalizeCategory(row.category) === key).length);
      return `<button type="button" class="search-chip ${key === active ? 'active' : ''}" data-filter="${key}" ${key !== 'all' && rows.length > 0 && total === 0 ? 'disabled' : ''}><span>${label}</span><b>${total}</b></button>`;
    }).join('');
    filters.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((button) => {
      button.onclick = () => {
        if (!isCurrent()) return;
        const next = (button.dataset.filter as CategoryKey) || 'all';
        if (active === next) return;
        active = next;
        focusedIndex = -1;
        if (lastExecutedQuery) void runSearch(true, false);
        else { drawFilters(); drawResults(); }
      };
    });
  };

  const recordClick = async (row: SearchResult) => {
    if (!lastExecutedQuery || !isCurrent()) return;
    await supabase.rpc('rb_search_action', {
      p_action: 'record_click',
      p_payload: {
        query: lastExecutedQuery,
        category: active,
        session_id: sessionId,
        result_type: normalizeCategory(row.category),
        target_id: row.id,
        target_url: safeTarget(row.target_url),
        target_title: row.title
      }
    });
  };

  const drawResults = () => {
    if (!isCurrent()) return;
    const visible = visibleRows();
    count.textContent = lastExecutedQuery ? `${visible.length} ${active === 'all' ? 'GLOBAL' : active.toUpperCase()} RESULT${visible.length === 1 ? '' : 'S'}` : 'DISCOVERY READY';
    results.innerHTML = visible.length
      ? visible.map((row, index) => {
          const category = normalizeCategory(row.category);
          const image = safeMedia(row.image_url);
          const score = Math.max(0, Number(row.score || 0));
          return `<a class="search-card search-card--${category} ${focusedIndex === index ? 'keyboard-focus' : ''}" href="${esc(safeTarget(row.target_url))}" data-result-index="${index}" style="--rank:${Math.max(0, Math.min(100, score * 10))}%"><div class="search-media">${image ? `<img src="${esc(image)}" alt="" loading="lazy" onerror="this.remove()">` : `<div class="search-media-fallback"><span>${esc(row.title.slice(0, 1).toUpperCase())}</span></div>`}<div class="search-rank"><b>${String(index + 1).padStart(2, '0')}</b><i></i></div></div><div class="search-body"><span class="search-type">${esc(category)}</span><h2>${esc(row.title)}</h2><p>${esc(row.subtitle || 'Rich Bizness Universe')}</p><footer><small>${score.toFixed(2)} relevance</small><strong>OPEN ↗</strong></footer></div></a>`;
        }).join('')
      : lastExecutedQuery
        ? '<div class="search-state"><strong>NO MATCHES IN THIS WORLD.</strong><span>Try another lane or broaden the search.</span></div>'
        : '<div class="search-state"><strong>THE WHOLE UNIVERSE IS CONNECTED.</strong><span>Start typing or choose a trending search.</span></div>';
    results.querySelectorAll<HTMLAnchorElement>('[data-result-index]').forEach((link) => {
      link.onclick = () => {
        const row = visible[Number(link.dataset.resultIndex)];
        if (row) void recordClick(row);
      };
    });
  };

  const recordQuery = async (query: string, resultCount: number) => {
    if (!isCurrent()) return;
    await supabase.rpc('rb_search_action', { p_action: 'record_query', p_payload: { query, category: active, result_count: resultCount, session_id: sessionId } });
  };

  const loadSnapshot = async (query: string, category: CategoryKey = active) => {
    const { data, error } = await supabase.rpc('rb_search_snapshot', { p_query: query, p_category: category, p_limit: 120 });
    if (error) throw error;
    return (data ?? {}) as SearchSnapshot;
  };

  const runSearch = async (immediate = false, record = true) => {
    if (!isCurrent()) return;
    window.clearTimeout(timer);
    const query = compactQuery(input.value);
    if (!immediate) {
      timer = window.setTimeout(() => { if (isCurrent()) void runSearch(true); }, 260);
      return;
    }
    const current = ++requestId;
    if (query.length < 2) {
      rows = [];
      counts = {};
      active = 'all';
      focusedIndex = -1;
      lastExecutedQuery = '';
      count.textContent = query.length ? 'TYPE 2+ CHARACTERS' : 'DISCOVERY READY';
      drawFilters();
      drawResults();
      history.replaceState({}, '', '/search.html');
      return;
    }
    count.textContent = 'SCANNING THE UNIVERSE...';
    results.innerHTML = '<div class="search-state scanning"><strong>GLOBAL INDEX ACTIVE</strong><span>Ranking every connected world...</span></div>';
    try {
      const snapshot = await loadSnapshot(query, active);
      if (!isCurrent() || current !== requestId) return;
      rows = (snapshot.results ?? []).sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0));
      counts = snapshot.counts ?? counts;
      recent = [...new Set([...(snapshot.recent ?? []).map((item) => item.query), ...localRecent()])].slice(0, 8);
      trending = (snapshot.trending ?? []).map((item) => ({ query: item.query, searches: Number(item.searches ?? 0) }));
      lastExecutedQuery = query;
      focusedIndex = -1;
      if (record) saveLocalRecent(query);
      drawDiscoveryRows();
      drawFilters();
      drawResults();
      const categoryQuery = active === 'all' ? '' : `&category=${encodeURIComponent(active)}`;
      history.replaceState({}, '', `/search.html?q=${encodeURIComponent(query)}${categoryQuery}`);
      if (record) void recordQuery(query, rows.length);
    } catch (error) {
      if (!isCurrent() || current !== requestId) return;
      count.textContent = 'SEARCH ERROR';
      results.innerHTML = `<div class="search-state"><strong>DISCOVERY SIGNAL INTERRUPTED.</strong><span>${esc(error instanceof Error ? error.message : 'Please try again.')}</span></div>`;
    }
  };

  const scheduleRefresh = () => {
    if (!lastExecutedQuery || !isCurrent()) return;
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => { if (isCurrent()) void runSearch(true, false); }, 220);
  };

  const resetSearch = (focus = true) => {
    if (!isCurrent()) return;
    window.clearTimeout(timer);
    window.clearTimeout(refreshTimer);
    requestId += 1;
    input.value = '';
    rows = [];
    counts = {};
    active = 'all';
    focusedIndex = -1;
    lastExecutedQuery = '';
    drawFilters();
    drawResults();
    count.textContent = 'DISCOVERY READY';
    history.replaceState({}, '', '/search.html');
    if (focus) input.focus({ preventScroll: true });
  };

  const onSubmit = (event: SubmitEvent) => { event.preventDefault(); void runSearch(true); };
  const onInput = () => void runSearch(false);
  const onClear = () => resetSearch();
  const onKeyDown = (event: KeyboardEvent) => {
    if (!isCurrent()) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      input.focus({ preventScroll: true });
      input.select();
      return;
    }
    if (event.key === 'Escape') {
      if (input.value) resetSearch(); else input.blur();
      return;
    }
    const visible = visibleRows();
    if (!visible.length || !['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
    if (event.key === 'Enter' && focusedIndex >= 0) {
      event.preventDefault();
      const row = visible[focusedIndex];
      if (row) {
        void recordClick(row);
        location.assign(safeTarget(row.target_url));
      }
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusedIndex = event.key === 'ArrowDown' ? (focusedIndex + 1) % visible.length : (focusedIndex <= 0 ? visible.length - 1 : focusedIndex - 1);
      drawResults();
      results.querySelector<HTMLElement>('.keyboard-focus')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };

  form.addEventListener('submit', onSubmit);
  input.addEventListener('input', onInput);
  clearButton.addEventListener('click', onClear);
  window.addEventListener('keydown', onKeyDown);

  catalogChannel = supabase.channel(`rich-search-catalog:${mountEpoch}:${sessionId}`);
  indexedTables.forEach((table) => {
    catalogChannel = catalogChannel!.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRefresh);
  });
  catalogChannel.subscribe();

  const cleanup = async () => {
    if (disposed) return;
    disposed = true;
    requestId += 1;
    window.clearTimeout(timer);
    window.clearTimeout(statusTimer);
    window.clearTimeout(refreshTimer);
    form.removeEventListener('submit', onSubmit);
    input.removeEventListener('input', onInput);
    clearButton.removeEventListener('click', onClear);
    window.removeEventListener('keydown', onKeyDown);
    if (catalogChannel) await supabase.removeChannel(catalogChannel);
    catalogChannel = null;
    const host = window as CleanupHost;
    if (host.__rbPageCleanup === cleanup) host.__rbPageCleanup = null;
    window.removeEventListener('pagehide', onPageExit);
    window.removeEventListener('beforeunload', onPageExit);
  };
  const onPageExit = () => { void cleanup(); };
  (window as CleanupHost).__rbPageCleanup = cleanup;
  window.addEventListener('pagehide', onPageExit, { once: true });
  window.addEventListener('beforeunload', onPageExit, { once: true });

  try {
    const snapshot = await loadSnapshot('', 'all');
    if (!isCurrent()) return;
    recent = [...new Set([...(snapshot.recent ?? []).map((item) => item.query), ...localRecent()])].slice(0, 8);
    trending = (snapshot.trending ?? []).map((item) => ({ query: item.query, searches: Number(item.searches ?? 0) }));
  } catch (error) {
    if (!isCurrent()) return;
    setStatus(error instanceof Error ? error.message : 'Discovery intelligence could not load.', true);
    recent = localRecent();
  }
  drawDiscoveryRows();
  drawFilters();
  drawResults();

  const params = new URLSearchParams(location.search);
  const initialCategory = categoryAliases[String(params.get('category') || '').toLowerCase()] ?? 'all';
  const initial = compactQuery(params.get('q') || '');
  active = initialCategory;
  if (initial) {
    input.value = initial;
    await runSearch(true, false);
  } else if (!matchMedia('(max-width: 760px)').matches) {
    input.focus({ preventScroll: true });
  }
}
