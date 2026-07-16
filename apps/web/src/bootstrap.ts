import { initializeAuth } from './core/auth/auth-store';
import { getPageDefinition } from './route-loader';

export async function bootstrap(): Promise<void> {
  const page = document.body.dataset.page ?? 'portal';
  const definition = getPageDefinition(page);

  if (!definition) {
    throw new Error(`No page controller registered for ${page}`);
  }

  if (definition.initializeAuth) {
    await initializeAuth();
  }

  const module = await definition.load();
  await module.mount();
}
