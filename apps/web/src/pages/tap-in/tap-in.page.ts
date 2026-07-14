import { safeInternalRoute } from '@rb/config/routes';
import { supabase } from '../../core/supabase/client';

const esc = (value: string | null | undefined) => (value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char] ?? char));

export async function mountTapInPage(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('Missing #app mount');

  const params = new URLSearchParams(location.search);
  const next = safeInternalRoute(params.get('next'));
  const recoveryMode = params.get('mode') === 'recovery';
  const reason = params.get('reason');
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) session = (await supabase.auth.refreshSession()).data.session;
  if (session && !recoveryMode) {
    location.replace(next);
    return;
  }

  app.innerHTML = `
    <main class="auth-shell">
      <div class="auth-atmosphere" aria-hidden="true"><i></i><i></i><i></i></div>
      <a class="auth-back" href="/" aria-label="Back to portal">←</a>
      <section class="auth-visual">
        <div class="auth-mark"><span>RB</span></div>
        <p>RICH BIZNESS LLC</p>
        <h1>TAP INTO<br>YOUR EMPIRE.</h1>
        <div class="auth-route-strip"><span>PROFILE LOCK</span><span>AVATAR</span><span>WE LIT🔥</span><span>STORE</span><span>META</span></div>
      </section>
      <section class="auth-card">
        <header>
          <p class="eyebrow">RICH ID • GLOBAL ACCESS</p>
          <h2>${recoveryMode ? 'GET YOUR ACCESS BACK' : 'TAP IN'}</h2>
          <span>${recoveryMode ? 'Lock a new password to your Rich ID.' : 'One Rich ID controls your profile, avatar, XP, money, creator tools, rooms and the whole universe.'}</span>
        </header>
        ${recoveryMode ? `
          <form id="recoveryForm" class="auth-form">
            <label>NEW PASSWORD<div class="auth-input"><input id="newPassword" type="password" minlength="8" autocomplete="new-password" required placeholder="8 characters minimum"><button type="button" data-toggle-password="newPassword">SHOW</button></div></label>
            <button class="auth-primary" type="submit">LOCK IT IN</button>
          </form>
        ` : `
          <div class="auth-tabs" role="tablist">
            <button class="active" type="button" data-auth-mode="signin">TAP IN</button>
            <button type="button" data-auth-mode="signup">CREATE RICH ID</button>
          </div>
          <form id="authForm" class="auth-form">
            <label id="displayNameLabel" hidden>WHAT THEY CALL YOU?<div class="auth-input"><input id="displayName" name="displayName" autocomplete="name" maxlength="80" placeholder="ThatboyTayThou"></div></label>
            <label>EMAIL<div class="auth-input"><input id="email" name="email" type="email" autocomplete="email" required placeholder="you@example.com"></div></label>
            <label>PASSWORD<div class="auth-input"><input id="password" name="password" type="password" minlength="8" required autocomplete="current-password" placeholder="8 characters minimum"><button type="button" data-toggle-password="password">SHOW</button></div></label>
            <button id="submitButton" class="auth-primary" type="submit">TAP IN</button>
            <button id="recoverButton" class="auth-link" type="button">I CAN’T GET IN</button>
          </form>
        `}
        <p id="authStatus" class="auth-status" role="status">${reason === 'session' ? 'YOUR SESSION EXPIRED — TAP BACK IN' : 'TAP IN READY'}</p>
        <footer><span>PROFILE LOCK</span><i></i><span>TAPPED IN</span><i></i><span>RICH LEVEL</span><i></i><span>EMPIRE</span></footer>
      </section>
    </main>`;

  const status = document.querySelector<HTMLParagraphElement>('#authStatus');
  if (!status) throw new Error('Tap In status failed to mount');
  const setStatus = (message: string, error = false) => {
    status.textContent = message;
    status.dataset.error = String(error);
  };

  document.querySelectorAll<HTMLButtonElement>('[data-toggle-password]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.querySelector<HTMLInputElement>(`#${button.dataset.togglePassword}`);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      button.textContent = input.type === 'password' ? 'SHOW' : 'HIDE';
    });
  });

  if (recoveryMode) {
    const form = document.querySelector<HTMLFormElement>('#recoveryForm');
    const password = document.querySelector<HTMLInputElement>('#newPassword');
    if (!form || !password) throw new Error('Recovery form failed to mount');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setStatus('LOCKIN’ YOUR NEW ACCESS...');
      const { error } = await supabase.auth.updateUser({ password: password.value });
      if (error) return setStatus(error.message, true);
      setStatus('ACCESS LOCKED — YOU TAPPED IN');
      window.setTimeout(() => location.assign('/profile.html'), 700);
    });
    return;
  }

  let mode: 'signin' | 'signup' = 'signin';
  const form = document.querySelector<HTMLFormElement>('#authForm');
  const email = document.querySelector<HTMLInputElement>('#email');
  const password = document.querySelector<HTMLInputElement>('#password');
  const displayName = document.querySelector<HTMLInputElement>('#displayName');
  const displayNameLabel = document.querySelector<HTMLElement>('#displayNameLabel');
  const submitButton = document.querySelector<HTMLButtonElement>('#submitButton');
  if (!form || !email || !password || !displayName || !displayNameLabel || !submitButton) throw new Error('Tap In form failed to mount');

  document.querySelectorAll<HTMLButtonElement>('[data-auth-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      mode = button.dataset.authMode === 'signup' ? 'signup' : 'signin';
      document.querySelectorAll('[data-auth-mode]').forEach((node) => node.classList.toggle('active', node === button));
      displayNameLabel.hidden = mode !== 'signup';
      displayName.required = mode === 'signup';
      password.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
      submitButton.textContent = mode === 'signup' ? 'BUILD MY RICH ID' : 'TAP IN';
      setStatus(mode === 'signup' ? 'BUILD YOUR PROFILE LOCK' : 'TAP IN READY');
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    setStatus(mode === 'signup' ? 'BUILDIN’ YOUR RICH ID...' : 'CHECKIN’ YOUR RICH ID...');
    const credentials = { email: email.value.trim(), password: password.value };
    const username = displayName.value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    const result = mode === 'signup'
      ? await supabase.auth.signUp({ ...credentials, options: { emailRedirectTo: `${location.origin}/tap-in.html?next=${encodeURIComponent(next)}`, data: { display_name: displayName.value.trim(), username } } })
      : await supabase.auth.signInWithPassword(credentials);

    submitButton.disabled = false;
    if (result.error) return setStatus(result.error.message, true);
    if (mode === 'signup' && !result.data.session) return setStatus('CHECK YOUR EMAIL — THEN TAP BACK IN');

    const activeSession = result.data.session;
    if (activeSession) {
      const chosenName = displayName.value.trim() || String(activeSession.user.user_metadata.display_name ?? activeSession.user.email?.split('@')[0] ?? 'Rich Member');
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: activeSession.user.id,
        display_name: chosenName,
        username: String(activeSession.user.user_metadata.username ?? chosenName.toLowerCase().replace(/[^a-z0-9_]+/g, '_')),
        online_status: 'online',
        has_avatar: false,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
      if (profileError) return setStatus('YOU TAPPED IN, BUT PROFILE LOCK NEEDS A RETRY', true);
    }

    setStatus(`WELCOME BACK ${esc(displayName.value.trim() || email.value.split('@')[0]).toUpperCase()} — TAPPED IN`);
    window.setTimeout(() => location.assign(next), 450);
  });

  document.querySelector<HTMLButtonElement>('#recoverButton')?.addEventListener('click', async () => {
    if (!email.value.trim()) return setStatus('DROP YOUR EMAIL FIRST', true);
    setStatus('SENDING YOUR GET-BACK-IN LINK...');
    const { error } = await supabase.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: `${location.origin}/tap-in.html?mode=recovery` });
    setStatus(error?.message ?? 'CHECK YOUR EMAIL — YOUR LINK ON THE WAY', Boolean(error));
  });
}
