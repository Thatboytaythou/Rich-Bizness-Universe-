import { ROUTES } from '@rb/config/routes';
import { mountSectionPage } from '../shared/section-page';

export const mount = () => mountSectionPage({
  title: 'Store',
  route: ROUTES.store,
  table: 'products',
  emptyMessage: 'No products are listed.'
});
