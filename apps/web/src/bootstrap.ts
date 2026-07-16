import { initializeAuth } from './core/auth/auth-store';
import { getPageRegistration } from './route-loader';

export async function bootstrap(): Promise<void> {
  const page = document.body.dataset.page ?? 'home';
  const registration = getPageRegistration(page);

  if (!registration) {
    throw new Error(`No page controller registered for ${page}`);
  }

  if (registration.auth !== 'public') {
    const auth = await initializeAuth();
    if (registration.auth === 'required' && !auth.user) {
      const next = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
      location.replace(`/tap-in.html?next=${next}`);
      return;
    }
  }

  const module = await registration.load();
  await module.mount();
}
