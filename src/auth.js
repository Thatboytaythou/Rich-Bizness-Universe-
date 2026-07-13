import { supabase } from './supabase-client.js';

const $ = (id) => document.getElementById(id);
const state = { mode: 'signin', busy: false, recovering: false, listener: null };

function safeInternalPath(raw) {
  const value = String(raw || '').trim();
  if (!value || value.startsWith('//')) return null;
  return /^\/[a-z0-9/_-]*(?:\.html)?(?:\?[a-z0-9_=&%.-]*)?$/i.test(value) ? value : null;
}

function requestedNext() {
  return safeInternalPath(new URLSearchParams(location.search).get('next'));
}

function say(message, error = false) {
  const el = $('authStatus');
  if (!el) return;
  el.textContent = message;
  el.dataset.error = error ? 'true' : 'false';
}

function value(id) {
  return String($(id)?.value || '').trim();
}

function setBusy(on) {
  state.busy = on;
  document.querySelectorAll('button,input').forEach((el) => {
    if (el.id !== 'signOutButton') el.disabled = on;
  });
}

function renderMode() {
  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode));
  });
  $('nameField').hidden = state.mode !== 'signup';
  $('confirmField').hidden = state.mode !== 'signup';
  $('passwordField').hidden = state.mode === 'recover';
  $('password').required = state.mode !== 'recover';
  $('submitButton').textContent = state.mode === 'signin'
    ? 'TAP IN'
    : state.mode === 'signup'
      ? 'CREATE RICH ID'
      : 'SEND RECOVERY LINK';
  $('recoveryPanel').hidden = !state.recovering;
  say(
    state.recovering
      ? 'RECOVERY SESSION READY'
      : state.mode === 'signin'
        ? 'RICH ACCESS READY'
        : state.mode === 'signup'
          ? 'CREATE YOUR RICH ID'
          : 'RECOVER YOUR ACCESS'
  );
}

async function ensureProfile(user) {
  if (!user) return '/auth.html';

  const { data, error } = await supabase
    .from('profiles')
    .select('id,onboarding_state,has_avatar,has_profile_identity,last_route')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const displayName = String(
      user.user_metadata?.display_name || user.email?.split('@')[0] || 'Rich Bizness User'
    ).slice(0, 80);

    const { error: createError } = await supabase.from('profiles').upsert({
      id: user.id,
      display_name: displayName,
      username: `rich_${user.id.slice(0, 8)}`,
      onboarding_state: 'identity',
      has_avatar: false,
      has_profile_identity: false,
      last_route: '/onboarding.html'
    }, { onConflict: 'id' });

    if (createError) throw createError;
    return '/onboarding.html';
  }

  if (data.onboarding_state !== 'complete' || !data.has_profile_identity) {
    return '/onboarding.html';
  }

  const next = requestedNext();
  if (next && !['/auth.html', '/onboarding.html'].includes(next)) return next;

  const lastRoute = safeInternalPath(data.last_route);
  if (lastRoute && !['/auth.html', '/onboarding.html'].includes(lastRoute)) return lastRoute;

  return '/profile.html';
}

async function submit(event) {
  event.preventDefault();
  if (!supabase || state.busy || state.recovering) return;

  const email = value('email').toLowerCase();
  const password = value('password');
  const confirm = value('confirmPassword');
  const displayName = value('displayName');

  if (!email) return say('ENTER A VALID EMAIL', true);
  setBusy(true);

  try {
    if (state.mode === 'recover') {
      const redirectTo = `${location.origin}/auth.html?recovery=1`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      say('RECOVERY LINK SENT. CHECK YOUR EMAIL.');
      return;
    }

    if (password.length < 8) throw new Error('USE AT LEAST 8 CHARACTERS');

    if (state.mode === 'signup') {
      if (password !== confirm) throw new Error('PASSWORDS DO NOT MATCH');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/auth.html?verified=1${requestedNext() ? `&next=${encodeURIComponent(requestedNext())}` : ''}`,
          data: { display_name: displayName || 'Rich Bizness User' }
        }
      });
      if (error) throw error;
      if (data.session) {
        location.assign(await ensureProfile(data.user));
        return;
      }
      say('CHECK YOUR EMAIL TO VERIFY YOUR RICH ID');
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    location.assign(await ensureProfile(data.user));
  } catch (error) {
    say(error.message || 'RICH ACCESS FAILED', true);
  } finally {
    setBusy(false);
  }
}

async function savePassword() {
  const password = value('newPassword');
  const confirm = value('newPasswordConfirm');
  if (password.length < 8) return say('USE AT LEAST 8 CHARACTERS', true);
  if (password !== confirm) return say('PASSWORDS DO NOT MATCH', true);

  setBusy(true);
  const { error } = await supabase.auth.updateUser({ password });
  setBusy(false);
  if (error) return say(error.message, true);

  state.recovering = false;
  renderMode();
  say('PASSWORD UPDATED. YOUR SESSION IS SECURE.');
}

async function resendVerification() {
  const email = value('email').toLowerCase();
  if (!email) return say('ENTER YOUR EMAIL FIRST', true);
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${location.origin}/auth.html?verified=1` }
  });
  say(error ? error.message : 'VERIFICATION EMAIL SENT', Boolean(error));
}

async function boot() {
  if (!supabase) return say('SUPABASE ENV VARIABLES REQUIRED', true);

  const params = new URLSearchParams(location.search);
  state.recovering = params.get('recovery') === '1' || location.hash.includes('type=recovery');
  renderMode();

  const { data: { session } } = await supabase.auth.getSession();
  $('signOutButton').hidden = !session;

  state.listener = supabase.auth.onAuthStateChange((event, current) => {
    if (event === 'PASSWORD_RECOVERY') {
      state.recovering = true;
      renderMode();
    }
    if (event === 'SIGNED_OUT') $('signOutButton').hidden = true;
    if (event === 'SIGNED_IN') $('signOutButton').hidden = false;
    if (event === 'TOKEN_REFRESHED') say('SESSION REFRESHED');
  }).data.subscription;

  if (params.get('verified') === '1' && session?.user && !state.recovering) {
    say('EMAIL VERIFIED. OPENING YOUR RICH ID.');
    location.replace(await ensureProfile(session.user));
    return;
  }

  if (session?.user && params.get('continue') === '1' && !state.recovering) {
    location.replace(await ensureProfile(session.user));
  }
}

document.querySelectorAll('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    if (state.busy) return;
    state.mode = button.dataset.mode;
    state.recovering = false;
    renderMode();
  });
});

$('authForm')?.addEventListener('submit', submit);
$('savePassword')?.addEventListener('click', savePassword);
$('resendVerification')?.addEventListener('click', resendVerification);
$('signOutButton')?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.replace('/auth.html');
});
addEventListener('pagehide', () => state.listener?.unsubscribe());
boot();