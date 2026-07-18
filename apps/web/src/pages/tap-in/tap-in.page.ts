import { safeInternalRoute } from '@rb/config/routes';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import './tap-in.elite.css';

const OWNER = 'rich-bizness-tap-in-v2';
const esc = (value: string | null | undefined) => (value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char] ?? char));
const usernameFrom = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'rich_member';

export async function mountTapInPage(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('Missing #app mount');
  if (app.dataset.pageOwner === OWNER) return;
  app.replaceChildren();
  app.dataset.pageOwner = OWNER;

  const params = new URLSearchParams(location.search);
  const next = safeInternalRoute(params.get('next'));
  const recoveryMode = params.get('mode') === 'recovery';
  const reason = params.get('reason');
  const auth = getAuthSnapshot();
  if (auth.session && !recoveryMode) {
    location.replace(next);
    return;
  }

  const controller = new AbortController();
  const { signal } = controller;
  window.addEventListener('pagehide', () => controller.abort(), { once: true });

  app.innerHTML = `
    <main class="auth-shell" data-auth-state="ready">
      <div class="auth-media" aria-hidden="true"></div>
      <div class="auth-grid" aria-hidden="true"></div>
      <div class="auth-atmosphere" aria-hidden="true"><i></i><i></i><i></i></div>
      <a class="auth-back" href="/" aria-label="Back to Rich Bizness home">←</a>
      <section class="auth-visual">
        <div class="auth-mark"><span>RB</span><b></b><i></i></div>
        <p>RICH BIZNESS LLC • SECURE ACCESS</p>
        <h1>TAP INTO<br>YOUR EMPIRE.</h1>
        <span class="auth-visual-copy">One protected identity unlocks your full creator universe, avatar, XP, money, live rooms, messages, games and ownership tools.</span>
        <div class="auth-route-strip"><span>PROFILE LOCK</span><span>AVATAR</span><span>WE LIT 🔥</span><span>STORE</span><span>META</span></div>
      </section>
      <section class="auth-card">
        <div class="auth-card-scan" aria-hidden="true"></div>
        <header>
          <p class="eyebrow">RICH ID • GLOBAL ACCESS</p>
          <h2>${recoveryMode ? 'GET YOUR ACCESS BACK' : 'TAP IN'}</h2>
          <span>${recoveryMode ? 'Lock a new password to your verified Rich ID.' : 'One verified Rich ID controls your Portal, profile, avatar, XP, money, creator tools, rooms and the entire universe.'}</span>
        </header>
        ${recoveryMode ? `
          <form id="recoveryForm" class="auth-form">
            <label>NEW PASSWORD<div class="auth-input"><input id="newPassword" type="password" minlength="8" autocomplete="new-password" required placeholder="8 characters minimum"><button type="button" data-toggle-password="newPassword">SHOW</button></div></label>
            <button id="recoverySubmit" class="auth-primary" type="submit">LOCK IT IN</button>
          </form>
        ` : `
          <div class="auth-tabs" role="tablist" aria-label="Rich ID access mode">
            <button class="active" type="button" role="tab" aria-selected="true" data-auth-mode="signin">TAP IN</button>
            <button type="button" role="tab" aria-selected="false" data-auth-mode="signup">CREATE RICH ID</button>
          </div>
          <form id="authForm" class="auth-form">
            <label id="displayNameLabel" hidden>WHAT THEY CALL YOU?<div class="auth-input"><input id="displayName" name="displayName" autocomplete="name" maxlength="80" placeholder="ThatboyTayThou"></div></label>
            <label>EMAIL<div class="auth-input"><input id="email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" required placeholder="you@example.com"></div></label>
            <label>PASSWORD<div class="auth-input"><input id="password" name="password" type="password" minlength="8" required autocomplete="current-password" placeholder="8 characters minimum"><button type="button" data-toggle-password="password">SHOW</button></div></label>
            <button id="submitButton" class="auth-primary" type="submit">TAP IN</button>
            <button id="recoverButton" class="auth-link" type="button">I CAN’T GET IN</button>
          </form>
        `}
        <p id="authStatus" class="auth-status" role="status" aria-live="polite">${reason === 'session' ? 'YOUR SESSION EXPIRED — TAP BACK IN' : 'SECURE GATEWAY READY'}</p>
        <footer><span>PROFILE LOCK</span><i></i><span>VERIFIED SESSION</span><i></i><span>RICH LEVEL</span><i></i><span>EMPIRE</span></footer>
      </section>
    </main>`;

  const shell = app.querySelector<HTMLElement>('.auth-shell');
  const status = app.querySelector<HTMLParagraphElement>('#authStatus');
  if (!shell || !status) throw new Error('Tap In gateway failed to mount');

  const setStatus = (message: string, error = false, busy = false) => {
    status.textContent = message;
    status.dataset.error = String(error);
    shell.dataset.authState = error ? 'error' : busy ? 'busy' : 'ready';
  };

  app.querySelectorAll<HTMLButtonElement>('[data-toggle-password]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = app.querySelector<HTMLInputElement>(`#${button.dataset.togglePassword}`);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      button.textContent = input.type === 'password' ? 'SHOW' : 'HIDE';
      button.setAttribute('aria-pressed', String(input.type === 'text'));
    }, { signal });
  });

  if (recoveryMode) {
    const form = app.querySelector<HTMLFormElement>('#recoveryForm');
    const password = app.querySelector<HTMLInputElement>('#newPassword');
    const submit = app.querySelector<HTMLButtonElement>('#recoverySubmit');
    if (!form || !password || !submit) throw new Error('Recovery form failed to mount');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      submit.disabled = true;
      setStatus('LOCKIN’ YOUR NEW ACCESS...', false, true);
      const { error } = await supabase.auth.updateUser({ password: password.value });
      submit.disabled = false;
      if (error) return setStatus(error.message, true);
      setStatus('ACCESS LOCKED — YOU TAPPED IN');
      window.setTimeout(() => location.replace(next || '/profile.html'), 500);
    }, { signal });
    return;
  }

  let mode: 'signin' | 'signup' = 'signin';
  let pending = false;
  const form = app.querySelector<HTMLFormElement>('#authForm');
  const email = app.querySelector<HTMLInputElement>('#email');
  const password = app.querySelector<HTMLInputElement>('#password');
  const displayName = app.querySelector<HTMLInputElement>('#displayName');
  const displayNameLabel = app.querySelector<HTMLElement>('#displayNameLabel');
  const submitButton = app.querySelector<HTMLButtonElement>('#submitButton');
  const recoverButton = app.querySelector<HTMLButtonElement>('#recoverButton');
  if (!form || !email || !password || !displayName || !displayNameLabel || !submitButton || !recoverButton) throw new Error('Tap In form failed to mount');

  app.querySelectorAll<HTMLButtonElement>('[data-auth-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      if (pending) return;
      mode = button.dataset.authMode === 'signup' ? 'signup' : 'signin';
      app.querySelectorAll<HTMLButtonElement>('[data-auth-mode]').forEach((node) => {
        const active = node === button;
        node.classList.toggle('active', active);
        node.setAttribute('aria-selected', String(active));
      });
      displayNameLabel.hidden = mode !== 'signup';
      displayName.required = mode === 'signup';
      password.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
      submitButton.textContent = mode === 'signup' ? 'BUILD MY RICH ID' : 'TAP IN';
      setStatus(mode === 'signup' ? 'BUILD YOUR VERIFIED PROFILE LOCK' : 'SECURE GATEWAY READY');
    }, { signal });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (pending || !form.reportValidity()) return;
    pending = true;
    submitButton.disabled = true;
    recoverButton.disabled = true;
    setStatus(mode === 'signup' ? 'BUILDIN’ YOUR RICH ID...' : 'VERIFYIN’ YOUR RICH ID...', false, true);

    const credentials = { email: email.value.trim().toLowerCase(), password: password.value };
    const chosenName = displayName.value.trim();
    const username = usernameFrom(chosenName || credentials.email.split('@')[0]);
    const result = mode === 'signup'
      ? await supabase.auth.signUp({
          ...credentials,
          options: {
            emailRedirectTo: `${location.origin}/tap-in.html?next=${encodeURIComponent(next)}`,
            data: { display_name: chosenName, username }
          }
        })
      : await supabase.auth.signInWithPassword(credentials);

    pending = false;
    submitButton.disabled = false;
    recoverButton.disabled = false;
    if (result.error) return setStatus(result.error.message, true);
    if (mode === 'signup' && !result.data.session) return setStatus('CHECK YOUR EMAIL — THEN TAP BACK IN');

    const activeSession = result.data.session;
    if (activeSession) {
      const user = activeSession.user;
      const fallbackName = chosenName || String(user.user_metadata.display_name ?? user.email?.split('@')[0] ?? 'Rich Member');
      const existing = await supabase.from('profiles').select('id,display_name,username').eq('id', user.id).maybeSingle();
      if (existing.error) return setStatus('YOU TAPPED IN, BUT PROFILE LOCK NEEDS A RETRY', true);

      const profileResult = existing.data
        ? await supabase.from('profiles').update({ online_status: 'online', updated_at: new Date().toISOString() }).eq('id', user.id)
        : await supabase.from('profiles').insert({
            id: user.id,
            display_name: fallbackName,
            username: usernameFrom(String(user.user_metadata.username ?? fallbackName)),
            online_status: 'online',
            has_avatar: false,
            updated_at: new Date().toISOString()
          });
      if (profileResult.error) return setStatus('YOU TAPPED IN, BUT PROFILE LOCK NEEDS A RETRY', true);
    }

    setStatus(`WELCOME BACK ${esc(chosenName || credentials.email.split('@')[0]).toUpperCase()} — VERIFIED`);
    window.setTimeout(() => location.replace(next), 300);
  }, { signal });

  recoverButton.addEventListener('click', async () => {
    if (pending) return;
    if (!email.value.trim()) return setStatus('DROP YOUR EMAIL FIRST', true);
    pending = true;
    recoverButton.disabled = true;
    submitButton.disabled = true;
    setStatus('SENDING YOUR GET-BACK-IN LINK...', false, true);
    const redirect = `${location.origin}/tap-in.html?mode=recovery&next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.value.trim().toLowerCase(), { redirectTo: redirect });
    pending = false;
    recoverButton.disabled = false;
    submitButton.disabled = false;
    setStatus(error?.message ?? 'CHECK YOUR EMAIL — YOUR LINK ON THE WAY', Boolean(error));
  }, { signal });
}
