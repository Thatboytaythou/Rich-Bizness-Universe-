import { initializeAuth } from './core/auth/auth-store';
import { loadPageModule } from './route-loader';
import { mountPortalPage } from './pages/portal/portal.page';
import { mountTapInPage } from './pages/tap-in/tap-in.page';
import { mountProfilePage } from './pages/profile/profile.page';
import { mountGamingPage } from './pages/gaming/gaming.page';

const PUBLIC_PAGES = new Set(['portal', 'tap-in', 'profile']);

export async function bootstrap(): Promise<void> {
  const page = document.body.dataset.page ?? 'portal';

  if (!PUBLIC_PAGES.has(page)) await initializeAuth();

  switch (page) {
    case 'tap-in':
      await mountTapInPage();
      return;
    case 'profile':
      await initializeAuth();
      await mountProfilePage();
      return;
    case 'gaming':
      await mountGamingPage();
      return;
    case 'portal':
      await initializeAuth();
      await mountPortalPage();
      return;
    default: {
      const module = await loadPageModule(page);
      if (!module) throw new Error(`No page controller registered for ${page}`);
      await module.mount();
    }
  }
}
