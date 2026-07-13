import { initializeAuth } from './core/auth/auth-store';
import { mountPortalPage } from './pages/portal/portal.page';
import { mountTapInPage } from './pages/tap-in/tap-in.page';
import { mountProfilePage } from './pages/profile/profile.page';
import { mountGamingPage } from './pages/gaming/gaming.page';

export async function bootstrap(): Promise<void> {
  const page = document.body.dataset.page;

  switch (page) {
    case 'tap-in':
      await mountTapInPage();
      return;
    case 'profile':
      await initializeAuth();
      await mountProfilePage();
      return;
    case 'gaming':
      await initializeAuth();
      await mountGamingPage();
      return;
    case 'portal':
    default:
      await initializeAuth();
      await mountPortalPage();
  }
}
