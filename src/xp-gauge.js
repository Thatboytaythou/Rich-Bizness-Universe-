import { supabase } from './supabase-client.js';

const fmt = (n) => Number(n || 0).toLocaleString();

function ensureGauge() {
  const panel = document.querySelector('.profile');
  if (!panel) return null;
  let gauge = panel.querySelector('.xp-gauge');
  if (gauge) return gauge;
  const old = panel.querySelector(':scope > div:not(.xp-gauge)');
  gauge = document.createElement('div');
  gauge.className = 'xp-gauge';
  gauge.innerHTML = '<div class="xp-gauge-top"><span>RICH XP</span><strong data-xp-level>LEVEL 1</strong></div><div class="xp-track"><em data-xp-fill></em></div><div class="xp-gauge-bottom"><span data-xp-current>0 XP</span><span data-xp-next>1,000 XP NEXT</span></div>';
  if (old) old.replaceWith(gauge);
  else panel.appendChild(gauge);
  return gauge;
}

function renderXp(profile) {
  const gauge = ensureGauge();
  if (!gauge) return;
  const level = Number(profile?.rich_level || 1);
  const points = Number(profile?.rich_points || 0);
  const levelStart = Math.max(0, (level - 1) * 1000);
  const nextLevel = level * 1000;
  const gained = Math.max(0, points - levelStart);
  const pct = Math.max(0, Math.min(100, (gained / 1000) * 100));
  gauge.querySelector('[data-xp-fill]').style.width = pct + '%';
  gauge.querySelector('[data-xp-level]').textContent = 'LEVEL ' + level;
  gauge.querySelector('[data-xp-current]').textContent = fmt(points) + ' XP';
  gauge.querySelector('[data-xp-next]').textContent = fmt(nextLevel) + ' XP NEXT';
}

async function loadXp() {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      renderXp({ rich_level: 1, rich_points: 0 });
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('rich_level,rich_points')
      .eq('id', user.id)
      .maybeSingle();
    renderXp(data || { rich_level: 1, rich_points: 0 });
  } catch (_) {
    renderXp({ rich_level: 1, rich_points: 0 });
  }
}

loadXp();
supabase.channel('rich-bizness-xp-gauge')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, loadXp)
  .subscribe();
