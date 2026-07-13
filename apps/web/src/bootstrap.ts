import { initializeAuth } from './core/auth/auth-store';
import { mountPortalPage } from './pages/portal/portal.page';
import { mountTapInPage } from './pages/tap-in/tap-in.page';

export async function bootstrap(): Promise<void> {
  const page = document.body.dataset.page;

  switch (page) {
    case 'tap-in':
      await mountTapInPage();
      return;
    case 'portal':
    default:
      await initializeAuth();
      await mountPortalPage();
  }
}
