import { supabase } from './supabase-client.js';
import { ensureTapInFoundation, slugName, safeNextRoute } from './rb-identity.js?v=profile-avatar-separate-1';
import { loadCurrentXp, awardXp } from './rb-xp.js?v=xp-idempotent-1';

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

function destination(found) { return safeNextRoute(found?.route || next || '/', '/'); }

async function finish(user) {
  if (!user) throw new Error('Tap In did not return a user.');
  calm();
  say('Locking Profile, Avatar, and XP...');
  const found = await ensureTapInFoundation(user, { next });
  try { await loadCurrentXp(); } catch (_) {}
  say('Tapped In. Opening Rich Bizness...');
  location.replace(destination(found));
}

async function signInNow(mail, pass) {
  const result = await supabase.auth.signInWithPassword({ email: mail, password: pass });
  if (result.error) throw result.error;
  if (!result.data?.user) throw new Error('Tap In did not return a user.');
  return result.data.user;
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
    const user = await signInNow(email.value.trim(), password.value);
    try { await awardXp('daily_tap_in', { section: 'auth' }); } catch (_) {}
    await finish(user);
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
    const directUser = result.data?.session?.user || result.data?.user;
    if (result.data?.session?.user) {
      try { await awardXp('daily_tap_in', { section: 'auth' }); } catch (_) {}
      await finish(result.data.session.user);
      return;
    }
    if (directUser) {
      try {
        say('ID created. Opening portal...');
        const user = await signInNow(mail, pass);
        try { await awardXp('daily_tap_in', { section: 'auth' }); } catch (_) {}
        await finish(user);
        return;
      } catch (_) {
        lock(false);
        say('ID created. Check email, confirm it, then Tap In.');
        return;
      }
    }
    lock(false);
    say('Check email, then confirm to Tap In.');
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