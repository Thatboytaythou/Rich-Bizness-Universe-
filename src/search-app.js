import { supabase } from './supabase-client.js';

const $ = (s) => document.querySelector(s);
const esc = (v = '') => String(v).replace(/[&<>"]/g, (m) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[m]));
const initials = (v = 'RB') => String(v).split(/\s+/).map((x) => x[0]).filter(Boolean).slice(0,2).join('').toUpperCase() || 'RB';

function clean() {
  document.querySelectorAll('#globalXpBadge,#xpToast,.xp-gauge,[data-rich-money],[data-balance-cents],[data-wallet-money],.rb-blocker,.rb-overlay,.miniProfile,.composerPanel').forEach((el) => el.remove());
  document.body?.removeAttribute('data-rich-money');
}

function mount() {
  if ($('#rbSearchPower')) return;
  const panel = document.querySelector('.panel') || document.querySelector('main') || document.body;
  const box = document.createElement('section');
  box.id = 'rbSearchPower';
  box.className = 'rb-search-power';
  box.innerHTML = `<div class="rb-search-box"><div class="rb-search-row"><input id="rbSearchInput" placeholder="Search people on Rich Bizness"><button id="rbSearchButton" type="button">SEARCH</button></div><div class="rb-filter-row"><button class="rb-filter-chip active" type="button">PEOPLE</button><a class="rb-filter-chip" href="/feed.html">POSTS</a><a class="rb-filter-chip" href="/store.html">STORE</a><a class="rb-filter-chip" href="/music.html">MUSIC</a></div><div class="rb-web-links" id="rbWebLinks"></div></div><div class="rb-result-grid" id="rbResults"><div class="rb-search-empty">Search usernames, display names, and profiles.</div></div>`;
  panel.prepend(box);
  $('#rbSearchButton')?.addEventListener('click', run);
  $('#rbSearchInput')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  $('#rbSearchInput')?.addEventListener('input', webLinks);
  webLinks();
}

function webLinks() {
  const q = encodeURIComponent($('#rbSearchInput')?.value?.trim() || 'Rich Bizness');
  const target = $('#rbWebLinks');
  if (!target) return;
  target.innerHTML = `<a target="_blank" rel="noopener" href="https://www.google.com/search?q=${q}">Google</a><a target="_blank" rel="noopener" href="https://www.bing.com/search?q=${q}">Bing</a><a target="_blank" rel="noopener" href="https://duckduckgo.com/?q=${q}">DuckDuckGo</a>`;
}

function personCard(row) {
  const name = row.display_name || row.username || 'Rich Bizness User';
  const avatar = row.avatar_url ? `<img src="${esc(row.avatar_url)}" alt="">` : `<span class="rb-result-avatar">${esc(initials(name))}</span>`;
  return `<a class="rb-result-card" href="/profile.html?id=${row.id}">${avatar}<span><b>${esc(name)}</b><small>@${esc(row.username || 'rich_user')} • ${esc(row.rank_title || 'Rich Member')}</small></span><em>PEOPLE</em></a>`;
}

async function run() {
  clean();
  const q = $('#rbSearchInput')?.value?.trim() || '';
  webLinks();
  const out = $('#rbResults');
  if (!out) return;
  if (!q) { out.innerHTML = '<div class="rb-search-empty">Type a name or username.</div>'; return; }
  out.innerHTML = '<div class="rb-search-empty">Searching people...</div>';
  const term = `%${q}%`;
  const { data, error } = await supabase.from('profiles').select('id,username,display_name,avatar_url,bio,rank_title').or(`username.ilike.${term},display_name.ilike.${term},bio.ilike.${term}`).limit(20);
  if (error) { out.innerHTML = '<div class="rb-search-empty">Search is warming up. Try again.</div>'; return; }
  out.innerHTML = data?.length ? data.map(personCard).join('') : '<div class="rb-search-empty">No people found. Try the web search links above.</div>';
  const count = document.getElementById('recordCount'); if (count) count.textContent = String(data?.length || 0);
  const status = document.getElementById('tableCount'); if (status) status.textContent = 'LIVE';
}

clean();
mount();
