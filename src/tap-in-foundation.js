import { supabase } from './supabase-client.js';
import { ensureTapInFoundation, slugName, safeNextRoute } from './rb-identity.js?v=identity-owner-2';
import { loadXp, awardXp } from './rb-xp.js?v=auth-owner-1';

const form = document.getElementById('authForm');
const createBtn = document.getElementById('createBtn');
const status = document.getElementById('status');
const email = document.getElementById('email');
const password = document.getElementById('password');
const displayName = document.getElementById('displayName');
const params = new URL(location.href).searchParams;
const next = safeNextRoute(params.get('next') || '/', '/');
let finishing = false;
let finishFlight = null;

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
  finishing = false;
  finishFlight = null;
  lock(false);
  document.body.classList.remove('auth-checking');
  say(error?.message || 'Tap In blocked. Check Profile Lock.');
};

function destination(found) { return safeNextRoute(found?.route || next || '/', '/'); }

async function finish(user) {
  if (finishFlight) return finishFlight;
  if (!user) throw new Error('Tap In did not return a user.');

  finishing = true;
  finishFlight = (async () => {
    calm();
    lock(true);
    say('Locking Profile, Avatar, and XP...');

    const found = await ensureTapInFoundation(user, { next });
    await awardXp('daily_tap_in', { section: 'auth' }).catch(() => null);
    await loadXp(user.id).catch(() => null);

    say('Tapped In. Opening Rich Bizness...');
    location.replace(destination(found));
    return found;
  })();

  try {
    return await finishFlight;
  } catch (error) {
    fail(error);
    throw error;
  }
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

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data?.session?.user) {
    await finish(data.session.user);
    return true;
  }

  lock(false);
  say('Confirmed. Tap In to finish.');
  document.body.classList.remove('auth-checking');
  return true;
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (finishing) return;
  lock(true);
  calm();
  say('Opening portal...');
  try {
    const user = await signInNow(email.value.trim(), password.value);
    await finish(user);
  } catch (error) {
    if (!finishFlight) fail(error);
  }
});

createBtn?.addEventListener('click', async () => {
  if (finishing) return;
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
    if (result.data?.session?.user) {
      await finish(result.data.session.user);
      return;
    }

    lock(false);
    say('ID created. Check email, confirm it, then Tap In.');
  } catch (error) {
    fail(error);
  }
});

calm();

(async () => {
  document.body.classList.add('auth-checking');
  say('Checking Tap In status...');
  try {
    if (await checkReturned()) return;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data?.session?.user) {
      await finish(data.session.user);
      return;
    }
    document.body.classList.remove('auth-checking');
    lock(false);
    say('Tap In Ready.');
  } catch (error) {
    if (!finishFlight) fail(error);
  }
})();