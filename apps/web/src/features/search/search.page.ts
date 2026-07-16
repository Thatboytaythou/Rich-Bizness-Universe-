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

type CategoryKey = 'all' | 'people' | 'feed' | 'gallery' | 'watch' | 'music' | 'podcast' | 'radio' | 'live' | 'sports' | 'gaming' | 'store' | 'meta' | 'creator';

const categories: ReadonlyArray<readonly [CategoryKey, string]> = [
  ['all', 'ALL'], ['people', 'PEOPLE'], ['feed', 'FEED'], ['gallery', 'GALLERY'], ['watch', 'WATCH'],
  ['music', 'MUSIC'], ['podcast', 'PODCAST'], ['radio', 'RADIO'], ['live', 'LIVE'], ['sports', 'SPORTS'],
  ['gaming', 'GAMING'], ['store', 'STORE'], ['meta', 'META'], ['creator', 'CREATOR']
];

const categoryAliases: Record<string, CategoryKey> = {
  creator: 'creator', profile: 'people', user: 'people', people: 'people', post: 'feed', feed: 'feed',
  gallery: 'gallery', image: 'gallery', video: 'watch', watch: 'watch', music: 'music', track: 'music',
  podcast: 'podcast', episode: 'podcast', radio: 'radio', station: 'radio', live: 'live', stream: 'live',
  sports: 'sports', game: 'gaming', gaming: 'gaming', product: 'store', store: 'store', world: 'meta', meta: 'meta'
};

const esc = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] ?? char));
const safeTarget = (value: string) => {
  try {
    const url = new URL(value, location.origin);
    return url.origin === location.origin && url.pathname.startsWith('/') ? `${url.pathname}${url.search}${url.hash}` : '/search.html';
  } catch {
    return '/search.html';
  }
};
const normalizeCategory = (value: string): CategoryKey => categoryAliases[value.toLowerCase()] ?? 'feed';

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  if (root.dataset.mounted === 'search') return;
  root.dataset.mounted = 'search';

  const auth = getAuthSnapshot();
  const userId = auth.user?.id ?? null;

  root.innerHTML = `<main class="search-shell"><div class="search-wrap">
    <header class="search-head"><a href="/portal.html" aria-label="Back to Portal">←</a><div><p>RICH DISCOVERY ENGINE</p><h1>Search the Universe</h1><small>${userId ? 'PERSONALIZED DISCOVERY ACTIVE' : 'PUBLIC UNIVERSE DISCOVERY'}</small></div></header>
    <form id="searchForm" class="search-box"><span>⌕</span><input id="searchInput" autocomplete="off" inputmode="search" maxlength="100" placeholder="Creators, Feed, Watch, music, games, live, store..."/><button id="clearSearch" type="button" aria-label="Clear search">×</button></form>
    <div id="recentRow" class="recent-row"></div>
    <div class="search-meta"><div id="filters" class="search-filters"></div><small id="resultCount">READY</small></div>
    <section id="results" class="search-grid"><div class="search-state">Search every connected section from one place.</div></section>
    <nav class="search-shortcuts"><a href="/feed.html">FEED</a><a href="/gallery.html">GALLERY</a><a href="/watch.html">WATCH</a><a href="/music.html">MUSIC</a><a href="/live.html">LIVE</a><a href="/gaming.html">GAMING</a><a href="/store.html">STORE</a></nav>
  </div></main>`;

  const input = document.querySelector<HTMLInputElement>('#searchInput')!;
  const results = document.querySelector<HTMLElement>('#results')!;
  const count = document.querySelector<HTMLElement>('#resultCount')!;
  const filters = document.querySelector<HTMLElement>('#filters')!;
  const recentRow = document.querySelector<HTMLElement>('#recentRow')!;
  const form = document.querySelector<HTMLFormElement>('#searchForm')!;
  const clearButton = document.querySelector<HTMLButtonElement>('#clearSearch')!;

  let rows: SearchResult[] = [];
  let active: CategoryKey = 'all';
  let timer = 0;
  let requestId = 0;
  let disposed = false;
  let lastExecutedQuery = '';
  let recentQueries: string[] = [];

  const localRecent = (): string[] => {
    try {
      const parsed = JSON.parse(localStorage.getItem('rb_recent_searches') || '[]');
      return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string').slice(0, 8) : [];
    } catch {
      return [];
    }
  };

  const saveLocalRecent = (query: string) => {
    recentQueries = [query, ...recentQueries.filter((value) => value.toLowerCase() !== query.toLowerCase())].slice(0, 8);
    localStorage.setItem('rb_recent_searches', JSON.stringify(recentQueries));
  };

  const loadRecent = async () => {
    const local = localRecent();
    if (!userId) {
      recentQueries = local;
      return;
    }
    const { data } = await supabase.from('search_queries').select('query').eq('user_id', userId).order('created_at', { ascending: false }).limit(12);
    const remote = (data ?? []).map((row: { query: string }) => row.query).filter(Boolean);
    recentQueries = [...new Set([...remote, ...local])].slice(0, 8);
  };

  const drawRecent = () => {
    recentRow.innerHTML = recentQueries.length
      ? `<small>RECENT</small>${recentQueries.map((query) => `<button type="button" data-recent="${esc(query)}">${esc(query)}</button>`).join('')}`
      : '<small>Search history appears here.</small>';
    recentRow.querySelectorAll<HTMLButtonElement>('[data-recent]').forEach((button) => {
      button.onclick = () => {
        input.value = button.dataset.recent || '';
        void runSearch(true);
      };
    });
  };

  const visibleRows = () => active === 'all' ? rows : rows.filter((row) => normalizeCategory(row.category) === active);

  const drawFilters = () => {
    const available = new Set(rows.map((row) => normalizeCategory(row.category)));
    filters.innerHTML = categories.map(([key, label]) => `<button type="button" class="search-chip ${key === active ? 'active' : ''}" data-filter="${key}" ${key !== 'all' && rows.length && !available.has(key) ? 'disabled' : ''}>${label}</button>`).join('');
    filters.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((button) => {
      button.onclick = () => {
        active = (button.dataset.filter as CategoryKey) || 'all';
        drawFilters();
        drawResults();
      };
    });
  };

  const recordClick = async (row: SearchResult) => {
    if (!userId || !lastExecutedQuery) return;
    await supabase.from('search_clicks').insert({
      user_id: userId,
      query: lastExecutedQuery,
      result_type: normalizeCategory(row.category),
      target_url: safeTarget(row.target_url),
      target_title: row.title
    });
  };

  const drawResults = () => {
    if (disposed) return;
    const visible = visibleRows();
    count.textContent = `${visible.length} RESULT${visible.length === 1 ? '' : 'S'}`;
    results.innerHTML = visible.length
      ? visible.map((row, index) => {
          const target = safeTarget(row.target_url);
          const category = normalizeCategory(row.category);
          const image = row.image_url ? `style="background-image:linear-gradient(180deg,transparent,rgba(2,4,2,.5)),url('${esc(row.image_url)}')"` : '';
          return `<a class="search-card" href="${esc(target)}" data-result-index="${index}"><div class="search-media" ${image}></div><div class="search-body"><span class="search-type">${esc(category)}</span><h2>${esc(row.title)}</h2><p>${esc(row.subtitle || 'Rich Bizness Universe')}</p><small>${Math.max(0, Number(row.score || 0)).toFixed(2)} relevance</small></div></a>`;
        }).join('')
      : '<div class="search-state">No matches in this section.</div>';

    results.querySelectorAll<HTMLAnchorElement>('[data-result-index]').forEach((link) => {
      link.onclick = () => {
        const row = visible[Number(link.dataset.resultIndex)];
        if (row) void recordClick(row);
      };
    });
  };

  const persistQuery = async (query: string, resultCount: number) => {
    if (!userId) return;
    await supabase.from('search_queries').insert({ user_id: userId, query, result_count: resultCount });
  };

  const runSearch = async (immediate = false) => {
    window.clearTimeout(timer);
    const query = input.value.trim().replace(/\s+/g, ' ');
    if (!immediate) {
      timer = window.setTimeout(() => void runSearch(true), 320);
      return;
    }

    const current = ++requestId;
    if (query.length < 2) {
      rows = [];
      lastExecutedQuery = '';
      count.textContent = 'TYPE 2+ CHARACTERS';
      results.innerHTML = '<div class="search-state">Search every connected section from one place.</div>';
      drawFilters();
      history.replaceState({}, '', '/search.html');
      return;
    }

    count.textContent = 'SEARCHING...';
    const { data, error } = await supabase.rpc('rb_global_search', { p_query: query, p_limit: 100 });
    if (disposed || current !== requestId) return;
    if (error) {
      count.textContent = 'SEARCH ERROR';
      results.innerHTML = `<div class="search-state">${esc(error.message)}</div>`;
      return;
    }

    rows = ((data ?? []) as SearchResult[]).sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0));
    lastExecutedQuery = query;
    active = 'all';
    saveLocalRecent(query);
    drawRecent();
    drawFilters();
    drawResults();
    history.replaceState({}, '', `/search.html?q=${encodeURIComponent(query)}`);
    void persistQuery(query, rows.length);
  };

  const onSubmit = (event: SubmitEvent) => { event.preventDefault(); void runSearch(true); };
  const onInput = () => void runSearch(false);
  const onClear = () => {
    window.clearTimeout(timer);
    requestId += 1;
    input.value = '';
    rows = [];
    active = 'all';
    lastExecutedQuery = '';
    drawFilters();
    count.textContent = 'READY';
    results.innerHTML = '<div class="search-state">Search every connected section from one place.</div>';
    history.replaceState({}, '', '/search.html');
    input.focus();
  };

  form.addEventListener('submit', onSubmit);
  input.addEventListener('input', onInput);
  clearButton.addEventListener('click', onClear);

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    requestId += 1;
    window.clearTimeout(timer);
    form.removeEventListener('submit', onSubmit);
    input.removeEventListener('input', onInput);
    clearButton.removeEventListener('click', onClear);
  };
  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });

  await loadRecent();
  drawRecent();
  drawFilters();
  const initial = new URLSearchParams(location.search).get('q');
  if (initial) {
    input.value = initial;
    await runSearch(true);
  } else {
    input.focus();
  }
}
