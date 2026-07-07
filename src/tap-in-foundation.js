import { supabase } from './supabase-client.js';
import { ensureTapInFoundation, slugName, safeNextRoute } from './rb-identity.js?v=tap-in-foundation-2';
import { loadCurrentXp, awardXp } from './rb-xp.js?v=realtime-2';

const form = document.getElementById('authForm');
const createBtn = document.getElementById('createBtn');
const status = document.getElementById('status');
const email = document.getElementById('email');
const password = document.getElementById('password');
const displayName = document.getElementById('displayName');
const params = new URL(location.href).searchParams;
const next = safeNextRoute(params.get('next') || '/', '/');

const say = (text) => { if (status) status.textContent = text; };
const lock = (on) => {
  document.body.classList.toggle('auth-working', !!on);
  form?.querySelectorAll('button,input').forEach((el) => { el.disabled = !!on; });
  if (createBtn) createBtn.disabled = !!on;
};
const calm = () => {
  document.querySelectorAll('.rb-overlay:not([data-rb-keep]),.rb-blocker:not([data-rb-keep])').forEach((el) => {
    el.style.pointerEvents = 'none';
    el.setAttribute('aria-hidden','true');
  });
};
const fail = (error) => {
  console.warn(error);
  lock(false);
  document.body.classList.remove('auth-checking');
  say(error?.message || 'Tap In blocked. Check Profile Lock.');
};

function destination(found) {
  return safeNextRoute(found?.route || next || '/', '/');
}

async function finish(user) {
  if (!user) throw new Error('Tap In did not return a user.');
  calm();
  say('Locking Profile, Avatar, and XP...');
  const found = await ensureTapInFoundation(user, { next });
  try { await loadCurrentXp(); } catch (_) {}
  const go = destination(found);
  say('Tapped In. Opening Rich Bizness...');
  location.replace(go);
}

async function checkReturned() {
  const url = new URL(location.href);
  const returnedFromEmail = url.hash.includes('access_token') || url.searchParams.has('code') || url.searchParams.get('type') === 'signup';
  if (!returnedFromEmail) return false;
  const session = await supabase.auth.getSession();
  if (session.data?.session?.user) { await finish(session.data.session.user); return true; }
  const user = await supabase.auth.getUser();
  if (user.data?.user) { await finish(user.data.user); return true; }
  lock(false);
  say('Confirmed. Tap In to finish.');
  document.body.classList.remove('auth-checking');
  return true;
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  lock(true);
  calm();
  say('Opening portal...');
  try {
    const result = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
    if (result.error) throw result.error;
    try { await awardXp('daily_tap_in', { section: 'auth' }); } catch (_) {}
    await finish(result.data.user);
  } catch (error) { fail(error); }
});

createBtn?.addEventListener('click', async () => {
  lock(true);
  calm();
  say('Creating Rich identity...');
  try {
    const mail = email.value.trim();
    const pass = password.value;
    const name = displayName.value.trim() || mail.split('@')[0] || 'Rich Bizness User';
    if (!mail || !pass) throw new Error('Email and password required.');
    const result = await supabase.auth.signUp({
      email: mail,
      password: pass,
      options: {
        emailRedirectTo: `${location.origin}/auth.html?next=${encodeURIComponent(next)}`,
        data: { display_name: name, username: slugName(name) },
      },
    });
    if (result.error) throw result.error;
    if (!result.data.user || !result.data.session) {
      lock(false);
      say('Check email, then confirm to Tap In.');
      return;
    }
    try { await awardXp('daily_tap_in', { section: 'auth' }); } catch (_) {}
    await finish(result.data.user);
  } catch (error) { fail(error); }
});

loadCurrentXp().catch(() => {});
calm();

(async () => {
  document.body.classList.add('auth-checking');
  say('Checking Tap In status...');
  try {
    if (await checkReturned()) return;
    const session = await supabase.auth.getSession();
    if (session.data?.session?.user) { await finish(session.data.session.user); return; }
    document.body.classList.remove('auth-checking');
    lock(false);
    say('Tap In Ready.');
  } catch (error) { fail(error); }
})();
