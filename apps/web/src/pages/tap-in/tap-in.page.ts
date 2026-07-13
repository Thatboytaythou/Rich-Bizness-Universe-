import { safeInternalRoute } from '@rb/config/routes';
import { supabase } from '../../core/supabase/client';

export async function mountTapInPage(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('Missing #app mount');

  app.innerHTML = `
    <main class="auth-shell">
      <a class="brand" href="/"><span>RB</span><strong>RICH BIZNESS</strong></a>
      <section class="auth-card">
        <p class="eyebrow">ONE ID • EVERY ROUTE</p>
        <h1>TAP IN.</h1>
        <form id="authForm">
          <input id="displayName" name="displayName" autocomplete="name" placeholder="Display name" />
          <input id="email" name="email" type="email" autocomplete="email" required placeholder="Email" />
          <input id="password" name="password" type="password" minlength="8" required placeholder="Password" />
          <div class="actions">
            <button name="mode" value="signin" type="submit">SIGN IN</button>
            <button name="mode" value="signup" type="submit">CREATE ID</button>
          </div>
          <button id="recoverButton" type="button">RECOVER PASSWORD</button>
        </form>
        <p id="authStatus" role="status">RICH ACCESS READY</p>
      </section>
    </main>`;

  const form = document.querySelector<HTMLFormElement>('#authForm');
  const status = document.querySelector<HTMLParagraphElement>('#authStatus');
  const email = document.querySelector<HTMLInputElement>('#email');
  const password = document.querySelector<HTMLInputElement>('#password');
  const displayName = document.querySelector<HTMLInputElement>('#displayName');
  if (!form || !status || !email || !password || !displayName) throw new Error('Tap In form failed to mount');

  const next = safeInternalRoute(new URLSearchParams(location.search).get('next'));
  const setStatus = (message: string, error = false) => {
    status.textContent = message;
    status.dataset.error = String(error);
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitter = event.submitter as HTMLButtonElement | null;
    const mode = submitter?.value ?? 'signin';
    const credentials = { email: email.value.trim(), password: password.value };
    const result = mode === 'signup'
      ? await supabase.auth.signUp({ ...credentials, options: { data: { display_name: displayName.value.trim() || 'Rich Member' } } })
      : await supabase.auth.signInWithPassword(credentials);

    if (result.error) return setStatus(result.error.message, true);
    if (mode === 'signup' && !result.data.session) return setStatus('CHECK YOUR EMAIL TO VERIFY YOUR RICH ID');
    location.assign(next);
  });

  document.querySelector<HTMLButtonElement>('#recoverButton')?.addEventListener('click', async () => {
    if (!email.value.trim()) return setStatus('ENTER YOUR EMAIL FIRST', true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.value.trim(), {
      redirectTo: `${location.origin}/tap-in.html?mode=recovery`
    });
    setStatus(error?.message ?? 'PASSWORD RESET LINK SENT', Boolean(error));
  });
}
