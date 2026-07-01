import { supabase } from './supabase-client.js';
import './xp-gauge.js';

const $$ = (selector) => [...document.querySelectorAll(selector)];
const fmt = (n) => Number(n || 0).toLocaleString();

function statusCells() {
  const cells = $$('.status span');
  return { live: cells[0]?.querySelector('b'), online: cells[1]?.querySelector('b') };
}

function activityRows() {
  const rows = $$('.activity p strong');
  return { live: rows[0], online: rows[1] };
}

function profileCard() {
  return {
    card: document.querySelector('.profile'),
    title: document.querySelector('.profile b'),
    small: document.querySelector('.profile small'),
    label: document.querySelector('.profile span'),
    badge: document.querySelector('.profile i'),
  };
}

function setSignedOutShell() {
  const profile = profileCard();
  if (profile.label) profile.label.textContent = 'UNIVERSE ACCESS';
  if (profile.title) profile.title.textContent = 'TAP IN';
  if (profile.small) profile.small.textContent = 'CREATE OR SIGN IN';
  if (profile.badge) {
    profile.badge.textContent = 'RB';
    profile.badge.style.backgroundImage = '';
  }
  if (profile.card) {
    profile.card.style.cursor = 'pointer';
    profile.card.onclick = () => { location.href = '/auth.html'; };
  }
}

function clearShellPlaceholders() {
  const status = statusCells();
  const rows = activityRows();
  [status.live, status.online, rows.live, rows.online].forEach((el) => {
    if (el) el.textContent = 'SYNC';
  });
  setSignedOutShell();
}

function setLiveCount(value) {
  const text = fmt(value);
  const status = statusCells();
  const rows = activityRows();
  if (status.live) status.live.textContent = text;
  if (rows.live) rows.live.textContent = text;
  $$('[data-live-count]').forEach((el) => { el.textContent = text; });
}

function setOnlineCount(value) {
  const text = fmt(value);
  const status = statusCells();
  const rows = activityRows();
  if (status.online) status.online.textContent = text;
  if (rows.online) rows.online.textContent = text;
  $$('[data-online-count]').forEach((el) => { el.textContent = text; });
}

async function countTable(table, setter) {
  try {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (!error && typeof count === 'number') setter(count);
  } catch (error) {
    console.warn('[RB realtime] count failed:', table, error);
  }
}

async function loadSessionProfile() {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      setSignedOutShell();
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('display_name,username,rich_level,rank_title,rich_points,balance_cents,avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !data) {
      setSignedOutShell();
      return;
    }

    const profile = profileCard();
    const name = data.display_name || data.username || 'Rich Bizness Elite';
    if (profile.label) profile.label.textContent = 'WELCOME BACK';
    if (profile.title) profile.title.textContent = name.toUpperCase();
    if (profile.small) profile.small.textContent = `LEVEL ${data.rich_level || 1}`;
    if (profile.card) profile.card.onclick = null;

    const badge = document.querySelector('.status i');
    if (badge && data.avatar_url) {
      badge.textContent = '';
      badge.style.backgroundImage = `url(${data.avatar_url})`;
      badge.style.backgroundSize = 'cover';
      badge.style.backgroundPosition = 'center';
    }
  } catch (error) {
    console.warn('[RB realtime] profile failed:', error);
    setSignedOutShell();
  }
}

async function refreshUniverse() {
  await Promise.all([
    countTable('live_streams', setLiveCount),
    countTable('profiles', setOnlineCount),
    loadSessionProfile(),
  ]);
}

function subscribeRealtime() {
  const channel = supabase.channel('rich-bizness-universe-home');
  ['profiles', 'live_streams', 'feed_posts', 'music_tracks', 'products', 'rich_notifications'].forEach((table) => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => refreshUniverse());
  });
  channel.subscribe((status) => console.info('[RB realtime]', status));
}

clearShellPlaceholders();
refreshUniverse();
subscribeRealtime();
