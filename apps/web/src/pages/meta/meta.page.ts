import { ROUTES } from '@rb/config/routes';
import { mountSectionPage } from '../shared/section-page';

export const mount = () => mountSectionPage({
  title: 'Meta',
  route: ROUTES.meta,
  table: 'meta_worlds',
  emptyMessage: 'No Meta worlds are available.'
});
