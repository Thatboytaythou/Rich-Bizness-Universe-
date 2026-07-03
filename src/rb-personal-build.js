import { supabase } from './supabase-client.js';
import { loadPersonality, label } from './rb-personality.js';

await loadPersonality();

document.documentElement.dataset.rbPersonal = 'true';

const href = '/src/rb-personal-build.css?v=personal-1';
if (!document.getElementById('rbPersonalBuildCss')) {
  const link = document.createElement('link');
  link.id = 'rbPersonalBuildCss';
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

const page = document.body?.dataset?.rbPage || document.body?.dataset?.section || 'index';
const set = (sel, text) => document.querySelectorAll(sel).forEach((el) => { if (el && text) el.textContent = text; });
const addStrip = (target, title, text) => {
  const node = document.querySelector(target);
  if (!node || node.querySelector('.rb-personal-strip')) return;
  const div = document.createElement('div');
  div.className = 'rb-personal-strip';
  div.innerHTML = `<b>${title}</b><span>${text}</span>`;
  node.appendChild(div);
};

async function currentProfile() {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('id,username,display_name,bio,avatar_url,rank_title,rich_level,rich_points,balance_cents,metadata').eq('id', user.id).maybeSingle();
  return data || { id: user.id, display_name: label('brand_voice', 'owner_handle', 'ThatboyTayThou'), username: 'thatboytaythou' };
}

if (page === 'auth') {
  set('.auth-card h1', 'TAP INTO RICH BIZNESS');
  set('.auth-card .sub', 'Build your Rich Bizness lane across Live, Music, Gaming, Sports, Gallery, and Money.');
  const dn = document.getElementById('displayName');
  if (dn && !dn.value) dn.placeholder = label('brand_voice', 'owner_handle', 'ThatboyTayThou');
  addStrip('.auth-card', 'ONE HOME BASE', 'Real wealth. Real power. Build legacy.');
}

if (page === 'profile') {
  const p = await currentProfile();
  if (p) {
    set('#displayName', p.display_name || label('brand_voice', 'owner_handle', 'ThatboyTayThou'));
    set('#username', '@' + (p.username || 'thatboytaythou'));
    set('#bio', p.bio || 'Building my Rich Bizness lane across live, music, gaming, sports, gallery, and money.');
    set('#rank', p.rank_title || label('home_labels', 'rank_default', 'BIZ LEGEND'));
    set('#level', String(p.rich_level || 1));
    set('#xp', String(p.rich_points || 0));
    set('#cash', '$' + (Number(p.balance_cents || 0) / 100).toFixed(2));
  }
  addStrip('.profile-screen .hero', 'THATBOYTAYTHOU MODE', 'Money Tree • Money Road • Smoke Cloud • Green Gold Universe');
}

if (page === 'avatar') {
  set('.avatar-panel p', 'FULL BODY CINEMA CHARACTER');
  set('.avatar-panel h1', 'BUILD YOUR RICH BIZNESS CHARACTER');
  const dn = document.getElementById('displayName');
  if (dn && !dn.value) dn.placeholder = label('brand_voice', 'owner_handle', 'ThatboyTayThou');
  addStrip('.avatar-panel', 'CHARACTER UPGRADE', 'Hoodie/beanie boss energy, smoke-cloud aura, Money Tree mode.');
}

if (page === 'index' || document.querySelector('.rb-universe')) {
  set('.headline p', label('brand_voice', 'motto', 'Your world. Your rules. Your empire.'));
}
