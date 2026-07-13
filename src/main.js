import { RB_CONFIG } from './config.js';
import { supabase } from './supabase-client.js';

const $ = (selector) => document.querySelector(selector);
const setText = (selector, value) => {
  const node = $(selector);
  if (node) node.textContent = String(value ?? 0);
};

let disposed = false;

async function count(table) {
  if (!supabase) return 0;
  const { count: total, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (error) throw error;
  return total || 0;
}

async function loadPlatformStatus() {
  const status = $('#systemStatus');
  if (!supabase) {
    if (status) status.textContent = 'ADD VITE SUPABASE ENV VARIABLES';
    return;
  }

  try {
    const [live, games, worlds, users] = await Promise.all([
      count(RB_CONFIG.tables.liveStreams),
      count(RB_CONFIG.tables.games),
      count(RB_CONFIG.tables.metaWorlds),
      count(RB_CONFIG.tables.profiles)
    ]);

    if (disposed) return;
    setText('#statLive', live);
    setText('#statGames', games);
    setText('#statWorlds', worlds);
    setText('#statUsers', users);
    if (status) status.textContent = 'SUPABASE CONNECTED';
  } catch (error) {
    if (!disposed && status) status.textContent = `DATA CHECK FAILED: ${error.message}`;
  }
}

function boot() {
  document.documentElement.dataset.rbApp = 'original-rebuild';
  loadPlatformStatus();
}

window.addEventListener('pagehide', () => {
  disposed = true;
}, { once: true });

boot();
