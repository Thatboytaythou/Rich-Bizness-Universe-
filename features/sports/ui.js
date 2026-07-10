const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const fmt = (value) => Number(value || 0).toLocaleString();
const mediaOf = (row) => row.media_url || row.file_url || row.cover_url || row.thumbnail_url || '';
const typeOf = (row) => row.media_type || row.content_type || '';

export function mountSportsSystems() {
  if (document.querySelector('#sportsArenaSystems')) return;
  const side = document.querySelector('.sports-grid .identity-panel:last-child');
  side?.insertAdjacentHTML('beforeend', `
    <section id="sportsArenaSystems" style="margin-top:14px">
      <h2>Arena Systems</h2>
      <div class="sports-profile">
        <span><b id="sportsLeagueCount">0</b><small>Leagues</small></span>
        <span><b id="sportsTeamCount">0</b><small>Teams</small></span>
        <span><b id="sportsBracketCount">0</b><small>Brackets</small></span>
        <span><b id="sportsBroadcastCount">0</b><small>Broadcasts</small></span>
      </div>
      <form id="sportsPickForm" style="display:grid;gap:8px;margin-top:12px">
        <input id="sportsPickTitle" placeholder="Pick title" style="min-height:42px;border-radius:14px;border:1px solid rgba(157,255,99,.16);background:rgba(0,0,0,.35);color:#f8ffe8;padding:0 10px" />
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><input id="sportsPickTeam" placeholder="Team" style="min-height:42px;border-radius:14px;border:1px solid rgba(157,255,99,.16);background:rgba(0,0,0,.35);color:#f8ffe8;padding:0 10px" /><input id="sportsPickOpponent" placeholder="Opponent" style="min-height:42px;border-radius:14px;border:1px solid rgba(157,255,99,.16);background:rgba(0,0,0,.35);color:#f8ffe8;padding:0 10px" /></div>
        <input id="sportsPickPrediction" placeholder="Prediction" style="min-height:42px;border-radius:14px;border:1px solid rgba(157,255,99,.16);background:rgba(0,0,0,.35);color:#f8ffe8;padding:0 10px" />
        <button class="identity-pill primary">DROP PICK</button>
      </form>
      <div id="sportsPickList" class="cards" style="margin-top:10px"><div class="empty">Loading picks...</div></div>
    </section>`);

  const main = document.querySelector('.sports-grid .identity-panel:first-child');
  main?.insertAdjacentHTML('beforeend', `
    <section id="sportsSocial" style="margin-top:14px">
      <h2 id="sportsSocialTitle">Post Social</h2>
      <div style="display:grid;grid-template-columns:1fr auto auto;gap:8px">
        <input id="sportsCommentBody" placeholder="Comment on selected post..." style="min-height:42px;border-radius:14px;border:1px solid rgba(157,255,99,.16);background:rgba(0,0,0,.35);color:#f8ffe8;padding:0 10px" />
        <button id="sportsCommentBtn" class="identity-pill primary" type="button">COMMENT</button>
        <button id="sportsReactBtn" class="identity-pill" type="button">FIRE</button>
      </div>
      <div id="sportsCommentList" class="cards" style="margin-top:10px"><div class="empty">Select a sports post.</div></div>
    </section>`);
}

function postCard(row, index, selectedId) {
  const media = mediaOf(row);
  const isVideo = String(typeOf(row)).includes('video');
  return `<article class="card sports-card ${selectedId === row.id ? 'active' : ''}" data-sports-post="${index}">${media ? (isVideo ? `<video src="${media}" muted playsinline controls></video>` : `<img src="${media}" alt="">`) : ''}<b>${esc(row.title || row.team_name || 'Sports Drop')}</b><p>${esc(row.body || row.caption || row.description || 'Rich Bizness sports post.')}</p><small>${esc(row.sport || row.sport_name || 'sports')} • ${esc(row.league || row.team_name || 'arena')} • ${fmt(row.view_count || row.views)} views</small></article>`;
}

export function renderSportsPosts({ rows, selectedId, onSelect }) {
  const list = document.querySelector('#sectionCards');
  const count = document.querySelector('#recordCount');
  const views = document.querySelector('#viewCount');
  if (count) count.textContent = fmt(rows.length);
  if (views) views.textContent = fmt(rows.reduce((sum, row) => sum + Number(row.view_count || row.views || 0), 0));
  if (list) list.innerHTML = rows.length ? rows.map((row, index) => postCard(row, index, selectedId)).join('') : '<div class="empty">No sports drops yet.</div>';
  document.querySelectorAll('[data-sports-post]').forEach((node) => node.addEventListener('click', () => onSelect(Number(node.dataset.sportsPost))));
}

export function renderSportsProfile(data) {
  const box = document.querySelector('#sportsProfile');
  if (!box) return;
  if (!data) {
    box.innerHTML = '<span><b>GUEST</b><small>Tap in</small></span>';
    return;
  }
  const rank = document.querySelector('#fanRank');
  if (rank) rank.textContent = data.rank_title || 'ARENA';
  box.innerHTML = `<span><b>${esc(data.fan_tag || data.display_name || 'Fan')}</b><small>Fan Tag</small></span><span><b>${esc(data.favorite_sport || 'Sports')}</b><small>Sport</small></span><span><b>${fmt(data.points)}</b><small>Points</small></span><span><b>${fmt(data.pick_streak)}</b><small>Streak</small></span>`;
}

function pickCard(row) {
  return `<article class="card"><b>${esc(row.title || row.prediction || 'Sports Pick')}</b><p>${esc(row.team_name || 'Team')} vs ${esc(row.opponent || 'Opponent')} • ${esc(row.prediction || '')}</p><small>${esc(row.league || row.sport || 'sports')} • ${Number(row.confidence || 0)}% confidence • ${esc(row.status || 'open')}</small></article>`;
}

export function renderSportsSystems({ picks, leagues, teams, brackets, broadcasts }) {
  const pickList = document.querySelector('#sportsPickList');
  if (pickList) pickList.innerHTML = picks.length ? picks.map(pickCard).join('') : '<div class="empty">No picks yet.</div>';
  const values = [
    ['#sportsLeagueCount', leagues.length],
    ['#sportsTeamCount', teams.length],
    ['#sportsBracketCount', brackets.length],
    ['#sportsBroadcastCount', broadcasts.length]
  ];
  values.forEach(([selector, value]) => { const node = document.querySelector(selector); if (node) node.textContent = fmt(value); });
}

export function renderSportsSocial({ post, comments, reactions, enabled }) {
  const title = document.querySelector('#sportsSocialTitle');
  const list = document.querySelector('#sportsCommentList');
  const react = document.querySelector('#sportsReactBtn');
  if (title) title.textContent = post ? `Social • ${post.title || 'Sports Post'}` : 'Post Social';
  if (!enabled) {
    if (list) list.innerHTML = '<div class="empty">Social actions require a sports_posts record.</div>';
    return;
  }
  if (list) list.innerHTML = comments.length ? comments.map((comment) => `<article class="card"><b>${esc(comment.display_name || comment.username || 'Fan')}</b><p>${esc(comment.body || '')}</p><small>${new Date(comment.created_at).toLocaleString()}</small></article>`).join('') : '<div class="empty">No comments yet.</div>';
  if (react) react.textContent = `FIRE • ${fmt(reactions)}`;
}
