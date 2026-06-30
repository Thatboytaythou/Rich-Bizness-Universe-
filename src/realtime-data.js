import { supabase } from './supabase-client.js';

const $all = (selector) => [...document.querySelectorAll(selector)];
const setAll = (selector, value) => $all(selector).forEach((el) => { el.textContent = value; });
const fmt = (n) => Number(n || 0).toLocaleString();

async function countTable(table, selector) {
  try {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (!error && typeof count === 'number') setAll(selector, fmt(count));
  } catch (_) {}
}

async function loadSessionProfile() {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('display_name,username,rich_level,rank_title,rich_points,balance_cents,avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    if (!data) return;
    const name = data.display_name || data.username || 'Rich Bizness Elite';
    setAll('.profile b', name.toUpperCase());
    setAll('.profile small', `LEVEL ${data.rich_level || 1}`);
    const badge = document.querySelector('.status i');
    if (badge && data.avatar_url) {
      badge.textContent = '';
      badge.style.backgroundImage = `url(${data.avatar_url})`;
      badge.style.backgroundSize = 'cover';
      badge.style.backgroundPosition = 'center';
    }
  } catch (_) {}
}

async function refreshUniverse() {
  await Promise.all([
    countTable('live_streams', '[data-live-count]'),
    countTable('profiles', '[data-online-count]'),
    countTable('rich_notifications', '[data-notification-count]'),
    loadSessionProfile(),
  ]);
}

function subscribeRealtime() {
  const channel = supabase.channel('rich-bizness-universe-home');
  ['profiles','live_streams','feed_posts','music_tracks','products','rich_notifications'].forEach((table) => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => refreshUniverse());
  });
  channel.subscribe();
}

refreshUniverse();
subscribeRealtime();
